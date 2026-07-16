import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../App';
import { apiService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, FileText, Bot, User, Copy, Download,
  HelpCircle, Loader2, Sparkles, Plus
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'What is the main subject of this document?',
  'What are the key findings or core insights?',
  'Summarize the important numbers and metrics.',
  'Are there any action items or recommendations?',
];

export default function ChatPage() {
  const {
    documents,
    activeSessionId,
    setActiveSessionId,
    selectedFile,
    refreshSessions,
    refreshDocuments,
    showToast,
  } = useContext(AppContext);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('mmr');
  const [filterFilename, setFilterFilename] = useState(selectedFile || '');
  const [activeCitations, setActiveCitations] = useState([]);
  const [highlightedCitationId, setHighlightedCitationId] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMounted = useRef(false);

  useEffect(() => { setFilterFilename(selectedFile || ''); }, [selectedFile]);

  useEffect(() => {
    if (activeSessionId) {
      loadSessionHistory(activeSessionId);
    } else if (isMounted.current) {
      setMessages([]);
      setActiveCitations([]);
      setFilterFilename('');
    }
    isMounted.current = true;
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputText]);

  const loadSessionHistory = async (sessionId) => {
    setLoading(true);
    try {
      const history = await apiService.getSessionHistory(sessionId);
      setMessages(history);
      const assistantMsgs = history.filter(m => m.role === 'assistant');
      if (assistantMsgs.length > 0) {
        setActiveCitations(assistantMsgs[assistantMsgs.length - 1].citations || []);
      } else {
        setActiveCitations([]);
      }
      if (history[0]?.filename) setFilterFilename(history[0].filename);
    } catch {
      showToast('Failed to load session history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (textToSend) => {
    if (!textToSend.trim() || loading) return;
    if (documents.length === 0) { showToast('Please upload a PDF document first.', 'error'); return; }
    const currentText = textToSend;
    setInputText('');
    setHighlightedCitationId(null);
    setMessages(prev => [...prev,
      { role: 'user', content: currentText, timestamp: new Date().toISOString() },
      { role: 'assistant', content: '', timestamp: new Date().toISOString(), citations: [] }
    ]);
    setLoading(true);
    let completeText = '';
    try {
      await apiService.streamChat({
        question: currentText,
        sessionId: activeSessionId || '',
        searchType,
        filterFilename: filterFilename || null,
        onCitations: (citations) => {
          setActiveCitations(citations);
          setMessages(prev => { const copy = [...prev]; const last = copy[copy.length - 1]; if (last) last.citations = citations; return copy; });
        },
        onChunk: (token) => {
          completeText += token;
          setMessages(prev => { const copy = [...prev]; const last = copy[copy.length - 1]; if (last) last.content = completeText; return copy; });
        },
        onError: (err) => { showToast(`Stream Error: ${err}`, 'error'); setLoading(false); },
        onDone: async (finalSessionId) => {
          setLoading(false);
          if (!activeSessionId) setActiveSessionId(finalSessionId);
          await refreshSessions();
        },
      });
    } catch {
      showToast('Failed to connect to the assistant server.', 'error');
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length === 0) { showToast('Only PDF files are allowed.', 'error'); return; }
    setUploadingFiles(validFiles.map(f => f.name));
    try {
      const result = await apiService.uploadFiles(validFiles);
      await refreshDocuments();
      await refreshSessions();
      if (result?.documents?.length > 0) setFilterFilename(result.documents[0].filename);
      showToast('Document(s) indexed successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Upload failed.', 'error');
    } finally {
      setUploadingFiles([]);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(inputText); }
  };

  const handleCopyText = (content) => {
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard.', 'success');
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    let html = `<html><body><h1>Chat Session</h1><p>Generated: ${new Date().toLocaleString()}</p><hr/>`;
    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      html += `<h3>${role}</h3><p>${msg.content.replace(/\n/g, '<br/>')}</p><hr/>`;
    });
    html += '</body></html>';
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `chat_${activeSessionId || 'session'}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded transcript.', 'success');
  };

  const handleCitationClick = (citation) => {
    setHighlightedCitationId(citation.id);
    document.getElementById(`citation-card-${citation.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const selectedDocStats = documents.find(d => d.filename === filterFilename) || null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-g-bg">

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* Top bar */}
        <div className="h-12 px-4 flex items-center justify-end bg-g-sidebar shrink-0">
          <div className="flex items-center gap-2">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="text-xs bg-g-card text-g-accent rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-g-accent"
            >
              <option value="mmr">MMR</option>
              <option value="similarity">Similarity</option>
            </select>

            {messages.length > 0 && (
              <button
                onClick={handleDownloadChat}
                className="p-1.5 hover:bg-g-accent/10 hover:scale-110 active:scale-90 rounded-lg text-g-muted hover:text-g-accent"
                title="Download Chat"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-g-bg">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 pb-8">
              <div className="mb-8 text-center">
                <div className="inline-flex p-4 bg-g-accent/15 rounded-2xl mb-4 animate-pulse-glow">
                  <Sparkles className="h-8 w-8 text-g-accent" />
                </div>
                <h2 className="text-2xl font-semibold text-g-text mb-1">Ask your documents</h2>
                <p className="text-sm text-g-muted">
                  {documents.length === 0 ? 'Upload a PDF to get started.' : 'Ask anything about your uploaded documents.'}
                </p>
              </div>

              {documents.length > 0 && (
                <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(q)}
                      className="card p-4 text-left text-sm text-g-muted hover:text-g-text active:scale-95 animate-fade-up"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-g-accent/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-g-accent" />
                    </div>
                  )}

                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-g-accent/20 text-g-text rounded-3xl rounded-br-lg px-5 py-3' : 'text-g-text'}`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                    ) : (
                      <div>
                        {!msg.content && loading && index === messages.length - 1 ? (
                          <div className="flex gap-1.5 py-3 px-1">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}

                        {msg.citations && msg.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3">
                            {msg.citations.map((cit) => (
                              <button
                                key={cit.id}
                                onClick={() => handleCitationClick(cit)}
                                className="text-[10px] bg-g-accent/10 hover:bg-g-accent/20 hover:scale-105 active:scale-95 hover:text-g-accent text-g-accent/70 px-2 py-0.5 rounded-full font-mono"
                              >
                                [{cit.id}] p.{cit.page}
                              </button>
                            ))}
                          </div>
                        )}

                        {msg.content && (
                          <button
                            onClick={() => handleCopyText(msg.content)}
                            className="mt-2 p-1 hover:bg-g-accent/10 hover:scale-110 active:scale-90 rounded-lg text-g-muted hover:text-g-accent"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-g-border flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-g-text" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="px-4 pb-4 pt-2 shrink-0 bg-g-sidebar">
          <div className="max-w-3xl mx-auto">
            {(uploadingFiles.length > 0 || (selectedDocStats && activeSessionId)) && (
              <div className="flex flex-wrap gap-2 mb-2">
                {uploadingFiles.length > 0 ? (
                  uploadingFiles.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-g-card rounded-xl text-xs text-g-accent">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-g-accent shrink-0" />
                      <span className="truncate max-w-[160px]">{name}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-g-card rounded-xl text-xs text-g-accent">
                    <FileText className="h-3.5 w-3.5 text-g-accent shrink-0" />
                    <span className="truncate max-w-[200px]">{selectedDocStats.original_filename}</span>
                  </div>
                )}
              </div>
            )}
            <div className="relative flex items-end gap-2 bg-g-card rounded-2xl px-4 py-3 shadow-card focus-within:shadow-accent-sm">
              <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="p-1 hover:bg-g-accent/10 hover:scale-110 active:scale-90 rounded-lg text-g-muted hover:text-g-accent shrink-0"
                title="Upload PDF"
              >
                <Plus className="h-4 w-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={1}
                placeholder={documents.length === 0 ? 'Upload a PDF to start chatting...' : 'Message DocAssistant...'}
                className="flex-1 bg-transparent text-sm text-g-text placeholder-g-muted resize-none focus:outline-none max-h-40 leading-relaxed"
              />
              <button
                onClick={() => handleSend(inputText)}
                disabled={loading || !inputText.trim()}
                className="p-2 btn-accent active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-center text-[10px] text-g-muted mt-2">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>

      {/* RIGHT CITATIONS PANEL */}
      <div className="w-72 h-full flex flex-col bg-g-sidebar shrink-0 hidden lg:flex">
        <div className="p-4 shrink-0">
          <h3 className="text-xs font-semibold text-g-muted uppercase tracking-wider">Source Context</h3>
          {selectedDocStats && (
            <div className="mt-3 p-3 bg-g-card rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-g-accent text-xs font-medium truncate">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{selectedDocStats.original_filename}</span>
              </div>
              <div className="text-[10px] text-g-muted flex gap-3">
                <span>{selectedDocStats.pages}p</span>
                <span>{selectedDocStats.file_size}</span>
                <span>{selectedDocStats.word_count?.toLocaleString()} words</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeCitations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-xs gap-2">
              <HelpCircle className="h-6 w-6 text-g-border" />
              <p className="text-g-muted">Source excerpts appear here after a response.</p>
            </div>
          ) : (
            activeCitations.map((cit) => (
              <div
                key={cit.id}
                id={`citation-card-${cit.id}`}
                className={`p-3 rounded-xl text-xs space-y-2 cursor-pointer ${
                  highlightedCitationId === cit.id
                    ? 'bg-g-accent/10 shadow-accent-sm'
                    : 'card'
                }`}
                onClick={() => setHighlightedCitationId(cit.id)}
              >
                <div className="flex items-center justify-between text-[10px] text-g-muted font-mono">
                  <span className="bg-g-accent/10 text-g-accent px-1.5 py-0.5 rounded">SRC [{cit.id}]</span>
                  <span>p.{cit.page}</span>
                </div>
                <p className="text-g-muted leading-relaxed italic line-clamp-4">"{cit.text}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
