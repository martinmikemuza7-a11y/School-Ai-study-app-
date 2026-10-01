import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Filter,
  Layers,
  Percent,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, DocumentChunk, Folder } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

interface RagExplorerViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
}

export const RagExplorerView: React.FC<RagExplorerViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
}) => {
  const [query, setQuery] = useState('gradient descent learning rate optimization');
  const [topK, setTopK] = useState(4);
  const [forceLexical, setForceLexical] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<{
    results: { chunk: DocumentChunk; score: number; matchType: 'vector' | 'lexical' | 'hybrid' }[];
    matchType: 'vector' | 'lexical' | 'hybrid';
    totalChunksInScope: number;
  } | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCourse || !query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.testRetrieve({
        query: query.trim(),
        courseId: activeCourse.id,
        folderId: activeFolderId,
        topK,
        forceLexical,
      });
      setResults(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Retrieval note: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders (Course Wide)'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  if (!activeCourse) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                Vector RAG Engine
              </span>
              <span className="text-xs text-slate-300">Model: gemini-embedding-2-preview</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Vector Search & Scope Isolation Tester</h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Test semantic cosine similarity ranking, verify strict folder isolation barriers, and test automatic lexical fallback side-by-side.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <VectorSyncIndicator
              activeCourse={activeCourse}
              activeFolderId={activeFolderId}
              folders={folders}
            />

            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10 text-xs">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Isolation: <strong>{activeFolderName}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Error / Status Alert Banner */}
      {errorMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-amber-600 hover:text-amber-900 font-bold px-2 py-0.5 ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Query & Configuration Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search query or concept to test vector similarity..."
                className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Embedding & Searching...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Execute RAG Query
                </>
              )}
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
            {/* Folder Isolation Scope Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Folder Scope:
              </label>
              <select
                value={activeFolderId === null ? 'null' : activeFolderId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') onSelectFolder('all');
                  else if (val === 'null') onSelectFolder(null);
                  else onSelectFolder(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 cursor-pointer"
              >
                <option value="all">📂 All Course Folders (Global)</option>
                <option value="null">📄 Root / Unassigned Only</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Top K */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Top Chunks (Top-K):</span>
                <span className="text-indigo-600 font-bold">{topK}</span>
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer mt-1"
              />
            </div>

            {/* Force Lexical Fallback Checkbox */}
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="forceLexical"
                checked={forceLexical}
                onChange={(e) => setForceLexical(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="forceLexical" className="text-slate-700 font-medium cursor-pointer">
                Force Lexical Fallback (Test without vector embeddings)
              </label>
            </div>
          </div>
        </form>
      </div>

      {/* Retrieval Output Results */}
      {results && (
        <div className="space-y-4">
          {/* Metadata banner */}
          <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500">Retrieval Mode: </span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    results.matchType === 'vector' || results.matchType === 'hybrid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {results.matchType.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Scope Chunks: </span>
                <span className="font-semibold text-slate-800">{results.totalChunksInScope} searched</span>
              </div>
              <div>
                <span className="text-slate-500">Retrieved: </span>
                <span className="font-semibold text-slate-800">{results.results.length} chunks</span>
              </div>
            </div>

            <span className="text-slate-500 text-[11px]">
              🔒 Chunks strictly filtered by ownerId and {activeFolderName}
            </span>
          </div>

          {/* Results Grid */}
          {results.results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-700">No matching chunks found in this folder scope.</p>
              <p className="text-xs text-slate-500 mt-1">
                Try broadening your query, switching to "All Folders", or uploading documents to this folder.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.results.map((res, idx) => {
                const chunk = res.chunk;
                const scorePercent = Math.round(res.score * 100);
                const folderObj = folders.find((f) => f.id === chunk.folderId);

                return (
                  <div
                    key={chunk.chunkId || idx}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition space-y-2"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                          #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{chunk.filename}</span>
                          <span className="text-slate-400 font-normal">• Page/Slide {chunk.pageOrSlide}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          {scorePercent}% Match
                        </span>
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, scorePercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Folder Scope Provenance Tag */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                        📁 {folderObj ? folderObj.name : 'Root / Unassigned'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">ID: {chunk.chunkId}</span>
                      <span>•</span>
                      <span>~{chunk.tokenEstimate} tokens</span>
                    </div>

                    {/* Excerpt Body */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans">
                      {chunk.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
