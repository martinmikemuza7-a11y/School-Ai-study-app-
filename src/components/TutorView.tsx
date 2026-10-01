import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Send,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Citation, Course, Folder, TutorMessage } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface TutorViewProps {
  activeCourse: Course | null;
  activeFolderId: string | null | 'all';
  folders: Folder[];
  onSelectFolder: (folderId: string | null | 'all') => void;
}

export const TutorView: React.FC<TutorViewProps> = ({
  activeCourse,
  activeFolderId,
  folders,
  onSelectFolder,
}) => {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tutorStyle, setTutorStyle] = useState<'direct' | 'socratic' | 'summary' | 'exam_prep'>('direct');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when course or folder changes
  useEffect(() => {
    if (!activeCourse) return;
    loadChatHistory();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadChatHistory = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.getTutorMessages(activeCourse.id, activeFolderId);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || !activeCourse || isLoading) return;

    const query = inputQuery.trim();
    setInputQuery('');

    // Optimistic user message
    const tempUserMsg: TutorMessage = {
      id: `temp_user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await api.sendTutorChat({
        courseId: activeCourse.id,
        folderId: activeFolderId,
        message: query,
        tutorStyle,
      });

      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, res.message]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorAssistantMsg: TutorMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error retrieving grounded knowledge: ${msg}. Please ensure documents are uploaded to this folder.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!activeCourse) return;
    try {
      await api.clearTutorChat(activeCourse.id, activeFolderId);
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Course Folders'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  // Suggested starter prompts based on course
  const starterPrompts = [
    'Explain the fundamental concept from our latest uploaded document.',
    'What are the key mathematical formulas or rules defined here?',
    'Summarize the core takeaways in 3 bullet points.',
    'Test my understanding with a challenging conceptual question.',
  ];

  if (!activeCourse) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8 m-6">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">No Course Selected</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
          Please select or create a course in the top header to begin your study session.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-140px)]">
      {/* Control bar: Folder isolation pill, Tutor style selector, Clear chat */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Active Isolation Indicator */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-800">Grounded Scope:</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200">
                {activeFolderName}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {activeFolderId === 'all'
                ? 'Searching across all folders in this course'
                : 'Strict vector isolation enabled: only chunks in this folder are retrieved'}
            </p>
          </div>
        </div>

        {/* Tutor Style Selector & Action buttons */}
        <div className="flex items-center gap-2">
          {/* Vector Sync Status Indicator */}
          <VectorSyncIndicator
            activeCourse={activeCourse}
            activeFolderId={activeFolderId}
            folders={folders}
          />

          <div className="flex items-center bg-slate-100 rounded-lg p-1 text-xs">
            <span className="px-1.5 font-medium text-slate-500">Style:</span>
            <select
              value={tutorStyle}
              onChange={(e: any) => setTutorStyle(e.target.value)}
              className="bg-white border-0 font-medium text-slate-800 rounded px-2 py-0.5 shadow-2xs cursor-pointer focus:ring-1 focus:ring-indigo-500"
            >
              <option value="direct">Direct Tutor</option>
              <option value="socratic">Socratic Coach</option>
              <option value="summary">Summary Notes</option>
              <option value="exam_prep">Exam Prep</option>
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs flex items-center gap-1"
              title="Clear Conversation"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages scroll area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-2xl border border-slate-200 p-4 space-y-4 shadow-inner">
        {messages.length === 0 && (
          <div className="text-center py-12 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              AI Study Tutor for {activeCourse.code}
            </h3>
            <p className="text-xs text-slate-600 mt-1 mb-6">
              Answers are generated strictly from verified chunks in <strong>{activeFolderName}</strong>.
              Gemini will always cite the exact document and page/slide.
            </p>

            {/* Quick Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputQuery(p);
                  }}
                  className="p-2.5 bg-white hover:bg-indigo-50/60 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium transition flex items-center justify-between group shadow-2xs"
                >
                  <span className="line-clamp-2">{p}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] opacity-75">
                <span className="font-semibold">
                  {msg.role === 'user' ? 'You' : 'Study Buddy AI'}
                </span>
                <div className="flex items-center gap-2">
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="hover:opacity-100 transition p-0.5 rounded"
                      title="Copy Answer"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Message Body */}
              <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* Retrieval Provenance & Citations */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-500" />
                      Verified Source Chunks ({msg.citations.length})
                    </span>
                    {msg.retrievalMetadata && (
                      <span className="text-[10px] text-slate-400">
                        {msg.retrievalMetadata.matchType === 'vector' ? 'Vector' : msg.retrievalMetadata.matchType === 'hybrid' ? 'Vector+Lexical' : 'Lexical'} Match
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((cite, i) => (
                      <button
                        key={cite.chunkId || i}
                        onClick={() => setSelectedCitation(cite)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] text-slate-700 font-medium transition group"
                      >
                        <FileText className="w-3 h-3 text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span className="max-w-[130px] truncate">{cite.filename}</span>
                        <span className="text-slate-400">• p.{cite.pageOrSlide}</span>
                        <span className="text-indigo-600 font-bold text-[10px]">
                          {Math.round(cite.relevanceScore * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 max-w-[85%] shadow-xs">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>Searching vector embeddings in {activeFolderName} & synthesizing grounded answer...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={`Ask about ${activeCourse.code} (${activeFolderName})...`}
          className="flex-1 text-xs sm:text-sm px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs font-medium text-slate-800"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </form>

      {/* Drawer / Modal: Source Citation Inspector */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in duration-200">
            <button
              onClick={() => setSelectedCitation(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{selectedCitation.filename}</h4>
                <p className="text-xs text-slate-500">
                  Page/Slide {selectedCitation.pageOrSlide} • Chunk: {selectedCitation.chunkId}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Retrieval Relevance Score:</span>
                <span className="font-bold text-emerald-600">
                  {Math.round(selectedCitation.relevanceScore * 100)}% Match
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Folder Isolation:</span>
                <span className="font-semibold text-slate-700">
                  {selectedCitation.folderId ? `Folder: ${selectedCitation.folderId}` : 'Root Document'}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Exact Verified Chunk Excerpt
              </label>
              <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono leading-relaxed max-h-56 overflow-y-auto">
                "{selectedCitation.sourceExcerpt}"
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Grounding guarantee: The AI tutor is strictly constrained to this excerpt and other retrieved chunks for its response.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedCitation(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
