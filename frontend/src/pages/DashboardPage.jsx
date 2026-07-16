import React, { useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { apiService } from '../services/api';
import { Upload, FileText, Database, BookOpen, Hash, RefreshCw, Languages, Trash2, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { documents, refreshDocuments, setSelectedFile, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const totalDocs = documents.length;
  const totalPages = documents.reduce((acc, curr) => acc + (curr.pages || 0), 0);
  const totalWords = documents.reduce((acc, curr) => acc + (curr.word_count || 0), 0);
  const totalReadTime = documents.reduce((acc, curr) => acc + (curr.reading_time_min || 0), 0);
  const detectedLanguages = Array.from(new Set(documents.map(d => d.language))).filter(Boolean).join(', ') || 'None';

  const validateFiles = (files) => {
    const validFiles = [];
    const maxBytes = 20 * 1024 * 1024;
    for (let file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) { showToast(`Skipped '${file.name}': Not a PDF file.`, 'error'); continue; }
      if (file.size > maxBytes) { showToast(`Skipped '${file.name}': Exceeds 20MB limit.`, 'error'); continue; }
      validFiles.push(file);
    }
    return validFiles;
  };

  const handleUpload = async (rawFiles) => {
    const filesToUpload = validateFiles(rawFiles);
    if (filesToUpload.length === 0) return;
    setUploading(true);
    setProgress(0);
    showToast(`Uploading and processing ${filesToUpload.length} document(s)...`, 'info');
    try {
      const result = await apiService.uploadFiles(filesToUpload, (percent) => setProgress(percent));
      await refreshDocuments();
      showToast('Document(s) successfully parsed and indexed.', 'success');
      if (result?.documents?.length > 0) {
        setSelectedFile(result.documents[0].filename);
        navigate('/chat');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to complete document ingestion.', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => { if (e.target.files?.[0]) handleUpload(e.target.files); };
  const handleUploadZoneClick = () => fileInputRef.current?.click();
  const handleChatWithDoc = (filename) => () => { setSelectedFile(filename); navigate('/chat'); };

  const handleClearDocs = async () => {
    if (window.confirm('Delete all uploaded documents and clear vector indexes?')) {
      try {
        await apiService.clearUploadedDocs();
        refreshDocuments();
        showToast('All documents removed.', 'info');
      } catch { showToast('Failed to clear documents.', 'error'); }
    }
  };

  const stats = [
    { title: 'Documents', val: totalDocs, icon: FileText, color: 'text-[#54C750]', bg: 'bg-[#54C750]/10' },
    { title: 'Total Pages', val: totalPages, icon: Hash, color: 'text-[#54C750]', bg: 'bg-[#54C750]/10' },
    { title: 'Read Time', val: `${totalReadTime}m`, icon: BookOpen, color: 'text-[#54C750]', bg: 'bg-[#54C750]/10' },
    { title: 'Languages', val: detectedLanguages, icon: Languages, color: 'text-[#54C750]', bg: 'bg-[#54C750]/10', truncate: true },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#060C06]">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F0F2F0]">Document Library</h1>
            <p className="text-sm text-[#5B5B5B] mt-1">Upload PDFs to build your AI knowledge base.</p>
          </div>
          {totalDocs > 0 && (
            <button
              onClick={handleClearDocs}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:-translate-y-0.5 hover:shadow-md active:scale-95 border border-red-500/20 rounded-xl"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </button>
          )}
        </div>

        {/* Stats */}
        {totalDocs > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat, idx) => (
              <div key={idx} className="card p-4 flex items-center gap-3 animate-fade-up">
                <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#5B5B5B] uppercase tracking-wider font-semibold">{stat.title}</div>
                  <div className={`text-base font-bold text-[#F0F2F0] ${stat.truncate ? 'truncate' : ''}`}>{stat.val}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
          onClick={handleUploadZoneClick}
          className={`relative rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer border ${
            isDragActive
              ? 'border-[#54C750]/50 bg-[#54C750]/5 shadow-lg shadow-[#54C750]/10'
              : 'border-[#3E3F3E] hover:border-[#54C750]/30 hover:bg-[#54C750]/3 bg-[#1E1E1E]'
          }`}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept=".pdf" className="hidden" />

          {uploading ? (
            <div className="w-full max-w-xs text-center space-y-4">
              <RefreshCw className="h-8 w-8 text-[#54C750] animate-spin mx-auto" />
              <div>
                <p className="text-sm text-[#F0F2F0] font-medium">Processing document...</p>
                <p className="text-xs text-[#5B5B5B] mt-1">Extracting text and building vector index.</p>
              </div>
              <div className="w-full bg-[#3E3F3E] h-1 rounded-full overflow-hidden">
                <div className="bg-[#54C750] h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#5B5B5B]">{progress}%</p>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="inline-flex p-3 bg-[#54C750]/10 rounded-xl border border-[#54C750]/20">
                <Upload className="h-6 w-6 text-[#54C750]" />
              </div>
              <div>
                <p className="text-sm text-[#F0F2F0]/80">
                  <span className="font-medium text-[#54C750]">Upload a PDF</span> or drag and drop
                </p>
                <p className="text-xs text-[#5B5B5B] mt-1">Max 20MB · Standard & scanned PDFs supported</p>
              </div>
            </div>
          )}
        </div>

        {/* Document Cards */}
        {totalDocs > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#5B5B5B] uppercase tracking-wider">Indexed Documents ({totalDocs})</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {documents.map((doc, idx) => (
                <motion.div
                  key={doc.filename}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card p-5 flex flex-col gap-4 group animate-fade-up"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-[#54C750]/10 rounded-xl shrink-0 border border-[#54C750]/20">
                        <FileText className="h-4 w-4 text-[#54C750]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-[#F0F2F0] truncate" title={doc.original_filename}>
                          {doc.original_filename}
                        </h3>
                        <p className="text-xs text-[#5B5B5B] mt-0.5">
                          {doc.file_size} · {new Date(doc.upload_time).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#54C750]/10 text-[#54C750] border border-[#54C750]/20 shrink-0">
                      Indexed
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#3E3F3E]/50 text-center">
                    {[['Pages', doc.pages], ['Words', doc.word_count?.toLocaleString()], ['Read', `${doc.reading_time_min}m`]].map(([label, val]) => (
                      <div key={label}>
                        <div className="text-[9px] text-[#5B5B5B] uppercase tracking-wider font-semibold">{label}</div>
                        <div className="text-sm font-bold text-[#F0F2F0] mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>

                  {doc.top_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.top_keywords.map((kw, kIdx) => (
                        <span key={kIdx} className="text-[10px] bg-[#54C750]/5 text-[#5B5B5B] px-2 py-0.5 rounded-full border border-[#3E3F3E] hover:border-[#54C750]/30 hover:text-[#54C750]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleChatWithDoc(doc.filename)}
                    className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-[#54C750] bg-[#54C750]/10 hover:bg-[#54C750]/20 hover:shadow-md active:scale-95 rounded-xl border border-[#54C750]/20 opacity-0 group-hover:opacity-100"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat with this document
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
