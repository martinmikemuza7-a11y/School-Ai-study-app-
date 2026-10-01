import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Folder,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder as FolderType, VectorSyncStatus } from '../types';

interface VectorSyncIndicatorProps {
  activeCourse: Course | null;
  activeFolderId: string | null | 'all';
  folders: FolderType[];
  onNavigateToTab?: (tab: 'materials' | 'rag') => void;
  className?: string;
}

export const VectorSyncIndicator: React.FC<VectorSyncIndicatorProps> = ({
  activeCourse,
  activeFolderId,
  folders,
  onNavigateToTab,
  className = '',
}) => {
  const [status, setStatus] = useState<VectorSyncStatus | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(100);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders (Course Wide)'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  // Load vector sync status whenever folder or course changes
  useEffect(() => {
    if (!activeCourse) {
      setStatus(null);
      return;
    }

    // Trigger visual scan transition
    setIsScanning(true);
    setAnimatedProgress(15);

    const timer = setTimeout(() => {
      setAnimatedProgress(65);
    }, 150);

    fetchSyncStatus(true).finally(() => {
      clearTimeout(timer);
      setTimeout(() => {
        setIsScanning(false);
      }, 350);
    });

    return () => {
      clearTimeout(timer);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeCourse?.id, activeFolderId]);

  const fetchSyncStatus = async (initial = false) => {
    if (!activeCourse) return;
    try {
      const res = await api.getVectorSyncStatus(activeCourse.id, activeFolderId);
      setStatus(res);
      setAnimatedProgress(res.syncPercentage);

      // If still indexing or processing, poll until complete
      if (res.syncState === 'indexing') {
        if (!pollTimerRef.current) {
          pollTimerRef.current = setInterval(() => {
            fetchSyncStatus(false);
          }, 1800);
        }
      } else {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch (err) {
      console.error('Failed to fetch vector sync status:', err);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  };

  const handleManualResync = async () => {
    if (!activeCourse || isResyncing) return;
    setIsResyncing(true);
    setAnimatedProgress(20);

    try {
      await api.triggerVectorResync(activeCourse.id, activeFolderId);
      setAnimatedProgress(85);
      await fetchSyncStatus(false);
    } catch (err) {
      console.error('Resync failed:', err);
    } finally {
      setTimeout(() => {
        setIsResyncing(false);
      }, 400);
    }
  };

  if (!activeCourse) return null;

  const totalChunks = status?.totalChunks ?? 0;
  const embeddedChunks = status?.embeddedChunks ?? 0;
  const totalDocs = status?.totalDocuments ?? 0;
  const isReady = status?.syncState === 'synced';
  const isEmpty = status?.syncState === 'empty' || totalDocs === 0;
  const isIndexing = isScanning || isResyncing || status?.syncState === 'indexing';
  const isError = status?.syncState === 'error';

  return (
    <>
      {/* Trigger Button / Indicator Pill */}
      <div className={`relative inline-flex items-center ${className}`}>
        <button
          onClick={() => setShowModal(true)}
          type="button"
          title={`Vector Index Status for ${activeFolderName}: Click for details`}
          className={`group flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer shadow-2xs select-none ${
            isIndexing
              ? 'bg-indigo-50/90 text-indigo-900 border-indigo-200 hover:bg-indigo-100/90'
              : isReady
              ? 'bg-emerald-50/80 text-emerald-900 border-emerald-200/90 hover:bg-emerald-100/80'
              : isEmpty
              ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
          }`}
        >
          {/* Status Icon */}
          <div className="relative flex items-center justify-center">
            {isIndexing ? (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            ) : isReady ? (
              <div className="relative flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                <span className="w-2 h-2 rounded-full bg-emerald-600 relative" />
              </div>
            ) : isEmpty ? (
              <Database className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>

          {/* Sync Label & Metrics */}
          <div className="flex flex-col text-left leading-tight">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="tracking-tight">
                {isIndexing
                  ? 'Syncing Vectors...'
                  : isReady
                  ? 'Vector Index Ready'
                  : isEmpty
                  ? 'Vector Index Idle'
                  : 'Sync Notice'}
              </span>
              {isReady && (
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                  100%
                </span>
              )}
            </div>

            <span className="text-[10px] text-slate-500 truncate max-w-[130px] sm:max-w-[170px]">
              {isIndexing
                ? `Syncing (${animatedProgress}%)...`
                : isReady
                ? `${embeddedChunks} chunk${embeddedChunks === 1 ? '' : 's'} indexed`
                : isEmpty
                ? '0 docs in scope'
                : `${totalDocs} docs • attention needed`}
            </span>
          </div>

          {/* Mini progress bar when syncing */}
          {isIndexing && (
            <div className="w-8 h-1.5 bg-indigo-100 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${animatedProgress}%` }}
              />
            </div>
          )}
        </button>
      </div>

      {/* Detailed Vector Sync & Scope Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Vector Index & Sync Progress
                  </h3>
                  <p className="text-xs text-slate-500">
                    Course: <strong className="text-slate-700 font-semibold">{activeCourse.code}</strong> • Scope: <strong className="text-indigo-600 font-semibold">{activeFolderName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              {/* Overall Sync Health Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col gap-3 ${
                  isReady
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : isIndexing
                    ? 'bg-indigo-50/70 border-indigo-200'
                    : isEmpty
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isReady ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isIndexing ? (
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : isEmpty ? (
                      <Folder className="w-5 h-5 text-slate-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}

                    <div>
                      <span className="font-bold text-slate-900 block text-sm">
                        {isReady
                          ? 'Vector Database Synchronized'
                          : isIndexing
                          ? 'Synchronizing Vector Embeddings...'
                          : isEmpty
                          ? 'No Documents in this Scope'
                          : 'Index Attention Required'}
                      </span>
                      <span className="text-xs text-slate-600">
                        {isReady
                          ? 'All text chunks are embedded in 768-dim vector space and verified for RAG grounding.'
                          : isIndexing
                          ? 'Extracting text and generating dense vector embeddings for this folder.'
                          : isEmpty
                          ? 'Upload lecture notes, slides, or syllabus files into this folder to enable AI grounding.'
                          : 'Some files in this folder experienced indexing or readability issues.'}
                      </span>
                    </div>
                  </div>

                  <span className="text-lg font-black text-slate-900 ml-2">
                    {animatedProgress}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isReady
                        ? 'bg-emerald-600'
                        : isIndexing
                        ? 'bg-indigo-600 animate-pulse'
                        : isEmpty
                        ? 'bg-slate-300'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${animatedProgress}%` }}
                  />
                </div>
              </div>

              {/* Scope Isolation Guarantee Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800">
                    Strict Folder Isolation Active
                  </span>
                  <p className="mt-0.5">
                    When you query the AI Tutor or generate exams in{' '}
                    <strong className="text-indigo-600">{activeFolderName}</strong>, RAG retrieval strictly isolates search chunks to this folder, preventing cross-topic contamination.
                  </p>
                </div>
              </div>

              {/* Vector Key Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Documents
                  </span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {totalDocs}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Total Chunks
                  </span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {totalChunks}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Vector Chunks
                  </span>
                  <span className="text-base font-bold text-emerald-600 mt-0.5 block">
                    {embeddedChunks}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Dimensions
                  </span>
                  <span className="text-base font-bold text-indigo-600 mt-0.5 block">
                    {status?.vectorDimensions || 768}d
                  </span>
                </div>
              </div>

              {/* Document Vector Breakdown List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Documents in Scope ({status?.documents?.length || 0})
                  </span>
                  {status?.lastSyncedAt && (
                    <span className="text-[11px] text-slate-400">
                      Verified {new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {status?.documents && status.documents.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    {status.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white hover:bg-slate-50/70 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 truncate block">
                              {doc.filename}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {doc.chunkCount} chunk{doc.chunkCount === 1 ? '' : 's'} • {(doc.extractedTextLength || 0).toLocaleString()} chars
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {doc.status === 'ready' && doc.hasEmbeddings ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Indexed ({doc.embeddedChunksCount}/{doc.chunkCount})
                            </span>
                          ) : doc.status === 'indexing_vectors' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Indexing Vectors
                            </span>
                          ) : doc.status === 'error' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Error
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {doc.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500">
                    <Database className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    <p className="font-medium">No documents uploaded to this folder yet.</p>
                    <p className="text-[11px] mt-0.5 text-slate-400">
                      Upload PDF lecture notes or markdown files to start indexing.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <button
                onClick={handleManualResync}
                disabled={isResyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isResyncing ? 'animate-spin' : ''}`} />
                <span>{isResyncing ? 'Re-verifying...' : 'Re-verify Vector Index'}</span>
              </button>

              <div className="flex items-center gap-2">
                {onNavigateToTab && (
                  <>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToTab('materials');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Manage Files</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToTab('rag');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition cursor-pointer shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Open RAG Explorer</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
