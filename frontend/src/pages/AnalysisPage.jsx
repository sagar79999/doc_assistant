import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { apiService } from '../services/api';
import {
  FileText, Calendar, Hash, Users, Building,
  Lightbulb, ListTodo, GraduationCap, HelpCircle,
  Clock, Sparkles, AlertCircle, RefreshCw, Key, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { documents, selectedFile, setSelectedFile, showToast } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('summaries');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [extraData, setExtraData] = useState(null);
  const [openFaqIdx, setOpenFaqIdx] = useState(null);

  useEffect(() => {
    if (selectedFile) {
      triggerAnalysis(false);
    } else {
      setSummaryData(null);
      setExtraData(null);
    }
  }, [selectedFile]);

  const triggerAnalysis = async (forceRegenerate = false) => {
    if (!selectedFile) return;
    setLoading(true);
    setOpenFaqIdx(null);
    if (forceRegenerate) showToast('Regenerating document insights...', 'info');
    try {
      const [summaryRes, questionsRes] = await Promise.all([
        apiService.generateSummary(selectedFile),
        apiService.generateQuestions(selectedFile)
      ]);
      setSummaryData(summaryRes);
      setExtraData(questionsRes);
      if (forceRegenerate) showToast('Analysis regenerated successfully.', 'success');
    } catch (err) {
      setSummaryData(null);
      setExtraData(null);
      showToast(err.response?.data?.detail || 'Failed to analyze document.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'summaries', label: 'Summary', icon: FileText },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'timeline', label: 'Timeline', icon: ListTodo },
    { id: 'glossary', label: 'Glossary', icon: GraduationCap },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  ];

  const Card = ({ children, className = '' }) => (
    <div className={`card p-5 ${className}`}>{children}</div>
  );

  const SectionTitle = ({ icon: Icon, label, color = 'text-g-accent' }) => (
    <h3 className="font-semibold text-sm text-[#F0F2F0] flex items-center gap-2 mb-4">
      <Icon className={`h-4 w-4 ${color}`} />{label}
    </h3>
  );

  return (
    <div className="h-full overflow-y-auto bg-g-bg">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F0F2F0] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-g-accent" />
              Document Analysis
            </h1>
            <p className="text-sm text-[#5B5B5B] mt-1">Summaries, insights, glossary, timelines and FAQs.</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedFile || ''}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="text-sm bg-[#1E1E1E] border border-[#3E3F3E] text-[#F0F2F0] rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-g-accent max-w-xs"
            >
              {documents.length === 0
                ? <option value="">No files uploaded</option>
                : documents.map(d => <option key={d.filename} value={d.filename}>{d.original_filename}</option>)
              }
            </select>

            {selectedFile && (
              <button
                onClick={() => triggerAnalysis(true)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-g-accent bg-g-accent/10 hover:bg-g-accent/20 hover:shadow-md hover:-translate-y-0.5 active:scale-95 border border-g-accent/20 rounded-xl"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Re-Analyze
              </button>
            )}
          </div>
        </div>

        {/* No docs warning */}
        {documents.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-[#1E1E1E] border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>No documents found. <span className="underline cursor-pointer text-g-accent" onClick={() => navigate('/')}>Upload PDFs</span> first.</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 text-g-accent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#F0F2F0]">Analyzing document...</p>
              <p className="text-xs text-[#5B5B5B] mt-1">First-time generation may take 20–30 seconds.</p>
            </div>
          </div>
        ) : summaryData && extraData ? (
          <div className="space-y-5">

            {/* Keywords bar */}
            {extraData.keywords?.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap bg-[#1E1E1E] border border-[#3E3F3E] rounded-xl px-4 py-3">
                <span className="text-[10px] font-semibold text-[#5B5B5B] uppercase tracking-wider flex items-center gap-1">
                  <Key className="h-3 w-3 text-g-accent" /> Keywords
                </span>
                {extraData.keywords.slice(0, 10).map((kw, i) => (
                  <span key={i} className="text-xs bg-g-accent/10 text-g-accent px-2.5 py-0.5 rounded-full border border-g-accent/20">{kw}</span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-g-border/50 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-g-accent text-g-accent'
                      : 'border-transparent text-g-muted hover:text-g-text hover:border-g-border'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'summaries' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-4">
                    <Card>
                      <SectionTitle icon={FileText} label="Detailed Summary" />
                      <p className="text-sm text-[#F0F2F0]/80 leading-relaxed whitespace-pre-line">{summaryData.detailed_summary}</p>
                    </Card>
                    <Card>
                      <SectionTitle icon={Sparkles} label="Executive Summary" color="text-amber-500" />
                      <p className="text-sm text-[#F0F2F0]/80 leading-relaxed whitespace-pre-line">{extraData.executive_summary}</p>
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <Card>
                      <h4 className="text-[10px] font-semibold text-[#5B5B5B] uppercase tracking-wider mb-3">Short Abstract</h4>
                      <p className="text-xs text-[#5B5B5B] leading-relaxed italic">"{summaryData.short_summary}"</p>
                    </Card>
                    <Card>
                      <h4 className="text-[10px] font-semibold text-[#5B5B5B] uppercase tracking-wider mb-3">Core Takeaways</h4>
                      <ul className="space-y-2">
                        {summaryData.bullet_summary?.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-g-accent shrink-0 mt-1.5" />
                            <span className="leading-relaxed text-[#F0F2F0]/80">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Card>
                      <SectionTitle icon={Lightbulb} label="Key Insights" color="text-amber-500" />
                      <ul className="space-y-3">
                        {summaryData.key_insights?.map((ins, i) => (
                          <li key={i} className="flex gap-3 text-sm text-[#F0F2F0]/80 leading-relaxed">
                            <span className="font-bold text-g-accent shrink-0">{i + 1}.</span>
                            <span>{ins}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                    {summaryData.important_numbers?.length > 0 && (
                      <Card>
                        <SectionTitle icon={Hash} label="Numbers & Metrics" color="text-blue-500" />
                        <div className="space-y-2">
                          {summaryData.important_numbers.map((num, i) => (
                            <div key={i} className="text-xs text-[#F0F2F0]/70 bg-g-accent/5 rounded-lg px-3 py-2 border border-g-accent/10">{num}</div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                  <div className="space-y-4">
                    {summaryData.important_dates?.length > 0 && (
                      <Card>
                        <SectionTitle icon={Calendar} label="Important Dates" color="text-blue-600" />
                        <div className="space-y-2">
                          {summaryData.important_dates.map((d, i) => (
                            <div key={i} className="text-xs text-[#F0F2F0]/70 bg-g-accent/5 rounded-lg px-3 py-2 border border-g-accent/10">{d}</div>
                          ))}
                        </div>
                      </Card>
                    )}
                    <Card>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-[10px] font-semibold text-[#5B5B5B] uppercase tracking-wider flex items-center gap-1 mb-3">
                            <Users className="h-3 w-3 text-g-accent" /> People
                          </h4>
                          <ul className="space-y-1.5">
                            {summaryData.important_people?.map((p, i) => (
                              <li key={i} className="text-xs text-[#F0F2F0]/70 truncate" title={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-semibold text-[#5B5B5B] uppercase tracking-wider flex items-center gap-1 mb-3">
                            <Building className="h-3 w-3 text-g-accent" /> Orgs
                          </h4>
                          <ul className="space-y-1.5">
                            {summaryData.important_organizations?.map((o, i) => (
                              <li key={i} className="text-xs text-[#F0F2F0]/70 truncate" title={o}>{o}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Card>
                  </div>
                </motion.div>
              )}

              {activeTab === 'timeline' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <SectionTitle icon={ListTodo} label="Action Items" color="text-emerald-500" />
                    <div className="space-y-3">
                      {extraData.action_items?.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-[#F0F2F0]/80">
                          <input type="checkbox" defaultChecked={false} className="mt-0.5 h-4 w-4 rounded border-[#3E3F3E] bg-[#1E1E1E] text-g-accent focus:ring-g-accent" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <SectionTitle icon={Clock} label="Document Timeline" color="text-blue-500" />
                    {extraData.timeline?.length > 0 ? (
                      <div className="relative border-l border-g-accent/30 pl-4 space-y-5">
                        {extraData.timeline.map((event, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-g-accent border-2 border-[#1E1E1E]" />
                            <div className="text-[10px] font-bold text-g-accent font-mono uppercase">{event.date}</div>
                            <div className="text-xs text-[#F0F2F0]/70 mt-0.5 leading-relaxed">{event.event}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#5B5B5B] text-center py-6">No chronological timeline found.</p>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === 'glossary' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {extraData.important_definitions?.length > 0 && (
                    <Card>
                      <SectionTitle icon={GraduationCap} label="Core Concepts" color="text-blue-600" />
                      <div className="grid md:grid-cols-2 gap-3">
                        {extraData.important_definitions.map((def, i) => (
                          <div key={i} className="text-xs text-[#F0F2F0]/70 bg-g-accent/5 rounded-xl px-3 py-2.5 border border-g-accent/10 leading-relaxed">{def}</div>
                        ))}
                      </div>
                    </Card>
                  )}
                  {extraData.glossary?.length > 0 && (
                    <Card>
                      <SectionTitle icon={FileText} label="Glossary of Terms" />
                      <div className="grid md:grid-cols-3 gap-3">
                        {extraData.glossary.map((item, i) => (
                          <div key={i} className="bg-g-accent/5 border border-g-accent/15 rounded-xl p-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-g-accent uppercase tracking-wide font-mono">{item.term}</div>
                            <p className="text-xs text-[#5B5B5B] leading-relaxed">{item.definition}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}

              {activeTab === 'faqs' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-2">
                  {extraData.faqs?.map((faq, i) => (
                    <div key={i} className="bg-[#1E1E1E] border border-[#3E3F3E] rounded-xl overflow-hidden hover:border-g-accent/20">
                      <button
                        onClick={() => setOpenFaqIdx(openFaqIdx === i ? null : i)}
                        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-[#F0F2F0]/80 hover:text-g-accent hover:bg-g-accent/5 active:bg-g-accent/10 text-left"
                      >
                        <span>{faq.question}</span>
                        {openFaqIdx === i
                          ? <ChevronUp className="h-4 w-4 text-g-accent shrink-0 ml-3" />
                          : <ChevronDown className="h-4 w-4 text-[#5B5B5B] shrink-0 ml-3" />
                        }
                      </button>
                      {openFaqIdx === i && (
                        <div className="px-5 pb-4 text-xs text-[#5B5B5B] leading-relaxed border-t border-[#3E3F3E]/50 pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-24 flex flex-col items-center gap-4 border-2 border-dashed border-[#3E3F3E]/50 rounded-2xl">
            <div className="p-4 bg-g-accent/10 rounded-2xl border border-g-accent/20">
              <FileText className="h-8 w-8 text-g-accent/40" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-[#5B5B5B]">No analysis yet</h3>
              <p className="text-xs text-[#5B5B5B]/60 mt-1">Select a document and click Re-Analyze to generate insights.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
