import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AppContext } from '../../App';
import { apiService } from '../../services/api';
import { FileText, Trash2, Plus, Menu, Database, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const {
    documents, refreshDocuments,
    sessions, refreshSessions,
    activeSessionId, setActiveSessionId,
    sidebarOpen, setSidebarOpen,
    showToast, healthStatus
  } = useContext(AppContext);

  const navigate = useNavigate();

  const handleNewChat = () => { setActiveSessionId(null); navigate('/chat'); };
  const handleSelectSession = (id) => { setActiveSessionId(id); navigate('/chat'); };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      const session = sessions.find(s => s.session_id === sessionId);
      await apiService.clearSessionHistory(sessionId);
      if (session?.filename) { await apiService.deleteDocument(session.filename); await refreshDocuments(); }
      if (activeSessionId === sessionId) setActiveSessionId(null);
      refreshSessions();
      showToast('Conversation deleted.', 'info');
    } catch { showToast('Failed to delete conversation.', 'error'); }
  };

  const handleWipeDatabase = async () => {
    if (window.confirm('Delete all documents, vector stores, and conversation histories?')) {
      try {
        await apiService.clearUploadedDocs();
        await apiService.clearAllHistory();
        setActiveSessionId(null);
        refreshDocuments(); refreshSessions();
        showToast('All system files and databases purged.', 'success');
        navigate('/');
      } catch { showToast('Purge operation failed.', 'error'); }
    }
  };

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 260 : 64 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="h-full bg-g-sidebar text-g-text flex flex-col z-20 shrink-0 select-none overflow-hidden"
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 shrink-0">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 font-bold text-sm"
            >
              <div className="p-1.5 bg-g-accent/20 rounded-lg animate-pulse-glow">
                <Sparkles className="h-3.5 w-3.5 text-g-accent" />
              </div>
              <span className="text-g-text tracking-wide">DocAssistant</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-g-muted hover:text-g-accent hover:bg-g-accent/10 hover:scale-110 active:scale-95 ml-auto"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-2 py-2.5 shrink-0">
        <button
          onClick={handleNewChat}
          className={`btn-accent w-full flex items-center gap-3 px-3 py-2.5 text-sm ${!sidebarOpen ? 'justify-center' : ''}`}
          title="New Chat"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                New Chat
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">

        {/* Nav Links */}
        <div className="space-y-0.5">
          {[{ to: '/analysis', icon: FileText, label: 'Summaries' }].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  isActive ? 'nav-active' : 'nav-item'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </div>

        {/* Recent Chats */}
        <AnimatePresence>
          {sidebarOpen && sessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-[10px] font-bold text-g-muted uppercase tracking-widest px-3 mb-2">Recent</p>
              <div className="space-y-0.5">
                {sessions.map((session, i) => (
                  <motion.div
                    key={session.session_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    onClick={() => handleSelectSession(session.session_id)}
                    className={`group relative flex items-center px-3 py-2 rounded-xl text-sm cursor-pointer ${
                      activeSessionId === session.session_id
                        ? 'nav-active'
                        : 'nav-item'
                    }`}
                  >
                    <span className="truncate flex-1 text-xs pr-6">{session.title}</span>
                    <button
                      onClick={(e) => handleDeleteSession(e, session.session_id)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/20 hover:scale-110 active:scale-90 text-g-muted hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-2 space-y-1 shrink-0">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-g-muted"
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${healthStatus.status === 'healthy' ? 'bg-g-accent animate-pulse' : 'bg-red-400'}`} />
              <span>{healthStatus.status === 'healthy' ? 'Server Online' : 'Server Offline'}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={handleWipeDatabase}
          className="w-full flex items-center justify-center p-2 rounded-xl text-g-muted hover:text-red-400 hover:bg-red-500/10 hover:scale-105 active:scale-95"
          title="Purge Database"
        >
          <Database className="h-4 w-4" />
        </button>
      </div>
    </motion.aside>
  );
}
