import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import ChatPage from './pages/ChatPage';
import AnalysisPage from './pages/AnalysisPage';
import { apiService } from './services/api';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export const AppContext = createContext();

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [healthStatus, setHealthStatus] = useState({ status: 'unknown' });

  const refreshDocuments = async () => {
    try {
      const docs = await apiService.getUploadedDocs();
      setDocuments(docs);
      if (docs.length > 0 && !selectedFile) {
        setSelectedFile(docs[0].filename);
      }
    } catch {
      showToast('Failed to fetch uploaded documents list.', 'error');
    }
  };

  const refreshSessions = async () => {
    try {
      const data = await apiService.getSessions();
      setSessions(data);
    } catch {
      showToast('Failed to fetch session conversations.', 'error');
    }
  };

  const checkApiHealth = async () => {
    try {
      const data = await apiService.checkHealth();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({ status: 'unhealthy', detail: err.message });
    }
  };

  useEffect(() => {
    refreshDocuments();
    refreshSessions();
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const toastStyles = {
    error:   { bg: 'bg-[#1a0f0f] text-red-400',   icon: <XCircle className="h-4 w-4 text-red-400 shrink-0" /> },
    success: { bg: 'bg-[#13131f] text-g-accent',   icon: <CheckCircle className="h-4 w-4 text-g-accent shrink-0" /> },
    info:    { bg: 'bg-[#13131f] text-[#F0F2F0]',  icon: <Info className="h-4 w-4 text-g-accent shrink-0" /> },
  };

  return (
    <AppContext.Provider value={{
      documents, setDocuments, refreshDocuments,
      sessions, setSessions, refreshSessions,
      activeSessionId, setActiveSessionId,
      selectedFile, setSelectedFile,
      sidebarOpen, setSidebarOpen,
      toasts, showToast,
      healthStatus
    }}>
      <Router>
        <div className="flex h-screen w-screen overflow-hidden bg-g-bg text-g-text font-sans">
          <Sidebar />
          <main className="flex-1 flex flex-col h-full relative overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            {/* Toast Notifications */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
              {toasts.map((toast) => {
                const style = toastStyles[toast.type] || toastStyles.info;
                return (
                  <div
                    key={toast.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-card pointer-events-auto animate-slide-in backdrop-blur-md ${style.bg}`}
                  >
                    {style.icon}
                    <span className="text-sm flex-1 leading-relaxed">{toast.message}</span>
                    <button onClick={() => removeToast(toast.id)} className="text-g-muted hover:text-g-text shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </Router>
    </AppContext.Provider>
  );
}
