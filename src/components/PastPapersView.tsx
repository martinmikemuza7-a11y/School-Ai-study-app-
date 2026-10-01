import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder, PastPaper, PastPaperQuestionStructure } from '../types';

interface PastPapersViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onLaunchExamWithPaper?: (paperId: string) => void;
}

export function PastPapersView({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onLaunchExamWithPaper,
}: PastPapersViewProps) {
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PastPaper | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders'
      : activeFolderId === null
      ? 'General Course Level'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  useEffect(() => {
    if (activeCourse) {
      loadPastPapers();
    }
  }, [activeCourse, activeFolderId]);

  const loadPastPapers = async () => {
    if (!activeCourse) return;
    setIsLoading(true);
    try {
      const res = await api.getPastPapers(activeCourse.id, activeFolderId);
      setPastPapers(res.pastPapers || []);
    } catch (err: unknown) {
      console.error('Failed to load past papers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCourse) return;

    setIsUploading(true);
    setUploadError(null);

    const folderTarget = activeFolderId === 'all' ? null : activeFolderId;

    try {
      const res = await api.uploadPastPaperFile(activeCourse.id, folderTarget, file);
      setPastPapers((prev) => [res.pastPaper, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePaper = async (id: string) => {
    try {
      await api.deletePastPaper(id);
      setPastPapers((prev) => prev.filter((p) => p.id !== id));
      if (selectedPaper?.id === id) setSelectedPaper(null);
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      console.error('Failed to delete past paper:', err);
    }
  };

  if (!activeCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm">
          <BookOpen className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Select a Course to View Past Papers</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose a course from the header dropdown to manage and practice with university past exam papers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Past Exam Papers</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              {activeCourse.code}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Official exams, residential tests, and midterm papers. Use them to calibrate AI exam style, marks, and question distributions.
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Extracting & Parsing Exam...' : 'Upload Past Paper'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Upload failed</p>
            <p className="mt-0.5 text-xs text-red-600">{uploadError}</p>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scope Filtering bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folder Scope:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onSelectFolder('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                activeFolderId === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Folders
            </button>
            <button
              onClick={() => onSelectFolder(null)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                activeFolderId === null
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Course Root
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => onSelectFolder(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                  activeFolderId === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Viewing: <strong className="text-slate-800 font-semibold">{activeFolderName}</strong> ({pastPapers.length} papers)
        </span>
      </div>

      {/* Paper List Grid */}
      {isLoading ? (
        <div className="text-center py-16">
          <Clock className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading past examination papers...</p>
        </div>
      ) : pastPapers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Past Papers in this Folder</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Upload past exam papers, residential test questionnaires, or promotional tests (PDF, Word, or scanned image scans).
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
          >
            <Upload className="w-4 h-4" />
            Upload First Exam Paper
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pastPapers.map((paper) => {
            const isSelected = selectedPaper?.id === paper.id;
            return (
              <div
                key={paper.id}
                className={`bg-white rounded-xl border transition shadow-xs flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <FileText className="w-5 h-5" />
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        paper.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : paper.status === 'processing'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}
                    >
                      {paper.status === 'ready' ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Ready
                        </>
                      ) : paper.status === 'processing' ? (
                        <>
                          <Clock className="w-3 h-3 animate-spin" /> Processing
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Error
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1" title={paper.title}>
                    {paper.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono line-clamp-1">{paper.filename}</p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block">Exam Term:</span>
                      <span className="font-medium text-slate-800">{paper.examTerm || 'Standard Exam'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Year:</span>
                      <span className="font-medium text-slate-800">{paper.year || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Pages:</span>
                      <span className="font-medium text-slate-800">{paper.pageCount} page(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Parsed Items:</span>
                      <span className="font-semibold text-indigo-600">
                        {paper.extractedQuestions?.length || 0} questions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedPaper(selectedPaper?.id === paper.id ? null : paper)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isSelected ? 'Hide Questions' : 'Inspect Structure'}
                  </button>

                  <div className="flex items-center gap-1">
                    {onLaunchExamWithPaper && (
                      <button
                        onClick={() => onLaunchExamWithPaper(paper.id)}
                        title="Generate Mock Exam calibrated with this paper's format"
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(paper.id)}
                      title="Delete past paper"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Past Paper Question Inspector Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedPaper.title}</h3>
                <p className="text-xs text-slate-500">
                  {selectedPaper.institution || 'University Examination'} • {selectedPaper.year || 'Exam'} • {selectedPaper.pageCount} Pages • {selectedPaper.extractedQuestions?.length || 0} Questions Parsed
                </p>
              </div>
              <button
                onClick={() => setSelectedPaper(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedPaper.extractedQuestions && selectedPaper.extractedQuestions.length > 0 ? (
                selectedPaper.extractedQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/40">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200/80 text-slate-700">
                          Q{q.questionNumber}
                        </span>
                        {q.section && (
                          <span className="text-[11px] font-semibold text-slate-500 uppercase">
                            {q.section}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.allocatedMarks && (
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {q.allocatedMarks} mark{q.allocatedMarks > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-medium text-slate-800">{q.prompt}</p>

                    {q.options && q.options.length > 0 && (
                      <div className="mt-2.5 pl-2 space-y-1 border-l-2 border-slate-200 text-xs text-slate-600">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx}>{opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">No structured questions parsed from this document.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Course: <strong className="text-slate-800">{activeCourse.title}</strong>
              </span>
              <div className="flex items-center gap-2">
                {onLaunchExamWithPaper && (
                  <button
                    onClick={() => {
                      const id = selectedPaper.id;
                      setSelectedPaper(null);
                      onLaunchExamWithPaper(id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Use For Mock Exam
                  </button>
                )}
                <button
                  onClick={() => setSelectedPaper(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation In-App Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-slate-900 text-base">Delete Past Exam Paper</h3>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure you want to remove this past paper? Its extracted questions will no longer be available for exam calibration.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePaper(deleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs"
              >
                Delete Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
