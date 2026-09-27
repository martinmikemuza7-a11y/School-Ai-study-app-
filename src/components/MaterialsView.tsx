import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Database,
  Edit2,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Layers,
  MoreVertical,
  MoveRight,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, DocumentChunk, Folder, Material } from '../types';

interface MaterialsViewProps {
  activeCourse: Course | null;
  folders: Folder[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onRefreshFolders: () => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  activeCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onRefreshFolders,
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [targetUploadFolderId, setTargetUploadFolderId] = useState<string | null>(
    activeFolderId === 'all' ? null : activeFolderId
  );
  const [isUploading, setIsUploading] = useState(false);

  // Folder editing / deleting modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newCreatedFolderName, setNewCreatedFolderName] = useState('');
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [reassignTargetFolderId, setReassignTargetFolderId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Chunk inspection modal
  const [inspectingMaterial, setInspectingMaterial] = useState<Material | null>(null);
  const [materialChunks, setMaterialChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Moving document state
  const [movingMaterialId, setMovingMaterialId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCourse) return;
    loadMaterials();
  }, [activeCourse?.id, activeFolderId]);

  useEffect(() => {
    setTargetUploadFolderId(activeFolderId === 'all' ? null : activeFolderId);
  }, [activeFolderId]);

  const loadMaterials = async () => {
    if (!activeCourse) return;
    setIsLoading(true);
    try {
      const res = await api.getMaterials(activeCourse.id, activeFolderId);
      setMaterials(res.materials || []);
    } catch (err) {
      console.error('Failed to load materials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || isUploading) return;

    setIsUploading(true);
    try {
      if (uploadTab === 'file' && selectedFile) {
        await api.uploadMaterialFile(activeCourse.id, targetUploadFolderId, selectedFile);
      } else if (uploadTab === 'text' && pastedText.trim()) {
        const filename = pastedTitle.trim() ? `${pastedTitle.trim().replace(/\s+/g, '_')}.txt` : 'Study_Notes.txt';
        await api.uploadMaterialText(activeCourse.id, targetUploadFolderId, filename, pastedText.trim());
      }
      setShowUploadModal(false);
      setSelectedFile(null);
      setPastedTitle('');
      setPastedText('');
      await loadMaterials();
      onRefreshFolders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Upload note: ${msg}`, isError: true });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMoveDocument = async (materialId: string, newFolderId: string | null) => {
    try {
      await api.moveMaterial(materialId, newFolderId);
      setFeedbackMessage({ text: 'Document moved to folder successfully.' });
      await loadMaterials();
      onRefreshFolders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage({ text: `Move document note: ${msg}`, isError: true });
    } finally {
      setMovingMaterialId(null);
    }
  };

  const handleDeleteMaterial = async (id: string, filename: string) => {
    try {
      await api.deleteMaterial(id);
      setFeedbackMessage({ text: `Removed "${filename}".` });
      await loadMaterials();
      onRefreshFolders();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !newFolderName.trim()) return;
    try {
      await api.updateFolder(folderToRename.id, { name: newFolderName.trim() });
      setFolderToRename(null);
      setNewFolderName('');
      onRefreshFolders();
    } catch (err) {
      console.error('Rename folder failed:', err);
    }
  };

  const handleDeleteFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToDelete) return;
    try {
      // Reassign to preserve documents
      await api.deleteFolder(folderToDelete.id, reassignTargetFolderId);
      if (activeFolderId === folderToDelete.id) {
        onSelectFolder('all');
      }
      setFolderToDelete(null);
      setReassignTargetFolderId(null);
      onRefreshFolders();
      await loadMaterials();
    } catch (err) {
      console.error('Delete folder failed:', err);
    }
  };

  const handleInspectChunks = async (mat: Material) => {
    setInspectingMaterial(mat);
    setIsLoadingChunks(true);
    try {
      const res = await api.getMaterialChunks(mat.id);
      setMaterialChunks(res.chunks || []);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  if (!activeCourse) return null;

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMessage.isError
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="font-bold px-2 py-0.5 ml-2 cursor-pointer hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Folder Directory & Isolation Scope */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FolderIcon className="w-4 h-4 text-indigo-600" />
                Study Folders
              </span>
              <button
                onClick={() => {
                  setNewCreatedFolderName('');
                  setShowCreateFolderModal(true);
                }}
                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                title="Create New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            <nav className="space-y-1 text-xs">
              {/* All Documents */}
              <button
                onClick={() => onSelectFolder('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeFolderId === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-4 h-4" />
                  All Documents
                </span>
              </button>

              {/* Root / Unassigned */}
              <button
                onClick={() => onSelectFolder(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeFolderId === null
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4" />
                  Root / Unassigned
                </span>
              </button>

              {/* Folders List */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {folders.map((folder) => {
                  const isSelected = activeFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        onClick={() => onSelectFolder(folder.id)}
                        className="flex items-center gap-2 truncate text-left flex-1"
                      >
                        <FolderIcon
                          className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`}
                        />
                        <span className="truncate">{folder.name}</span>
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToRename(folder);
                            setNewFolderName(folder.name);
                          }}
                          className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white' : 'text-slate-400'}`}
                          title="Rename Folder"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete(folder);
                            setReassignTargetFolderId(null);
                          }}
                          className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white' : 'text-slate-400'}`}
                          title="Delete Folder (Preserving Documents)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
              💡 <strong>Folder Isolation:</strong> When you select a specific folder, RAG queries and tutor responses only retrieve chunks indexed within that folder.
            </div>
          </div>
        </div>

        {/* Right Main Panel: Documents in Selected Scope */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {activeFolderId === 'all'
                    ? 'All Course Materials'
                    : activeFolderId === null
                    ? 'Root / Unassigned Documents'
                    : currentFolder?.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {materials.length} {materials.length === 1 ? 'document' : 'documents'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeFolderId === 'all'
                  ? 'Viewing all uploaded resources across all course folders'
                  : 'Vector search and AI Tutor are strictly constrained to this folder'}
              </p>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Document
            </button>
          </div>

          {/* Materials List */}
          {isLoading ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading documents & vector status...</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Documents in this Scope</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Upload your lecture notes, textbook chapters, or PDF slides to generate vector embeddings and enable grounded AI tutoring.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                Upload First Material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((mat) => {
                const folderObj = folders.find((f) => f.id === mat.folderId);
                return (
                  <div
                    key={mat.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top status & tags */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                            mat.hasEmbeddings
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : mat.status === 'processing' || mat.status === 'indexing_vectors'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <Database className="w-3 h-3" />
                          {mat.hasEmbeddings ? 'Vector Indexed' : mat.status}
                        </span>

                        <span className="text-[11px] text-slate-400">
                          {(mat.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      {/* Title & file */}
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1" title={mat.title}>
                        {mat.title}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-mono mb-2">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{mat.filename}</span>
                      </p>

                      {/* Folder Badge & Details */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 mb-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium">
                          📁 {folderObj ? folderObj.name : 'Root / Unassigned'}
                        </span>
                        <span>•</span>
                        <span>{mat.chunkCount} chunks</span>
                        <span>•</span>
                        <span>{mat.extractedTextLength.toLocaleString()} chars</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Move Folder Dropdown */}
                        <div className="relative">
                          <select
                            value={mat.folderId || 'null'}
                            onChange={(e) => {
                              const val = e.target.value === 'null' ? null : e.target.value;
                              handleMoveDocument(mat.id, val);
                            }}
                            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-indigo-500 max-w-[130px] truncate"
                            title="Move to another folder"
                          >
                            <option value="null">Root (Unassigned)</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                📁 {f.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Inspect Chunks */}
                        <button
                          onClick={() => handleInspectChunks(mat)}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Inspect Chunks and Provenance"
                        >
                          Chunks ({mat.chunkCount})
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteMaterial(mat.id, mat.filename)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Upload Document */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Upload Course Material</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Folder Selector */}
            <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Study Folder:
              </label>
              <select
                value={targetUploadFolderId || 'null'}
                onChange={(e) => setTargetUploadFolderId(e.target.value === 'null' ? null : e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="null">📄 Root / Unassigned</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Chunks from this document will be indexed strictly under this folder.
              </p>
            </div>

            {/* Upload Method Tabs */}
            <div className="flex gap-2 border-b border-slate-200 mb-4 pb-2">
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  uploadTab === 'file' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Upload File (PDF / TXT / MD)
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('text')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  uploadTab === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Paste Lecture Notes
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadTab === 'file' ? (
                <div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-500 transition cursor-pointer bg-slate-50">
                    <input
                      type="file"
                      id="fileInput"
                      accept=".pdf,.txt,.md,.markdown,.json,.csv,.py,.ts,.js"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="fileInput" className="cursor-pointer block">
                      <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                      <span className="text-xs font-bold text-slate-800 block">
                        {selectedFile ? selectedFile.name : 'Click to select or drag document'}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        PDF, Markdown, Plain Text, Code, or Notes (Up to 25MB)
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Chapter 4 Lecture Transcription"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Text</label>
                    <textarea
                      rows={5}
                      placeholder="Paste clean syllabus, notes, formulas, or excerpts..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (uploadTab === 'file' && !selectedFile) || (uploadTab === 'text' && !pastedText.trim())}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processing & Embedding Chunks...
                    </>
                  ) : (
                    'Process & Index Vector Chunks'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Folder */}
      {folderToRename && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Rename Folder</h3>
            <form onSubmit={handleRenameFolderSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Folder with Safe Document Preservation */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Delete Folder "{folderToDelete.name}"
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              <strong>Document Preservation Guarantee:</strong> Existing documents will never be deleted when a folder is removed. Choose where you want to reassign existing documents:
            </p>
            <form onSubmit={handleDeleteFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reassign Documents To:
                </label>
                <select
                  value={reassignTargetFolderId || 'null'}
                  onChange={(e) => setReassignTargetFolderId(e.target.value === 'null' ? null : e.target.value)}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="null">Root / Unassigned</option>
                  {folders
                    .filter((f) => f.id !== folderToDelete.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Delete Folder & Preserve Documents
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chunks Inspector */}
      {inspectingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chunk Inspector: {inspectingMaterial.filename}
                </h3>
                <p className="text-xs text-slate-500">
                  {materialChunks.length} clean chunks • Status: {inspectingMaterial.status}
                </p>
              </div>
              <button
                onClick={() => setInspectingMaterial(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingChunks ? (
                <div className="text-center py-10">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading chunk representations...</p>
                </div>
              ) : materialChunks.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No chunks found for this material.</p>
              ) : (
                materialChunks.map((chunk, idx) => (
                  <div
                    key={chunk.chunkId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="font-bold text-indigo-600">
                        Chunk #{idx + 1} ({chunk.chunkId})
                      </span>
                      <span>Page/Slide {chunk.pageOrSlide}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          chunk.embedding
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {chunk.embedding ? `Vector (${chunk.embedding.length} dims)` : 'Lexical Only'}
                      </span>
                    </div>
                    <div className="text-slate-800 leading-relaxed font-sans bg-white p-2.5 rounded-lg border border-slate-200">
                      {chunk.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectingMaterial(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Create Folder */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create New Folder</h3>
            <p className="text-xs text-slate-500 mb-3">Folders provide isolated retrieval scopes in {activeCourse.code}.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCreatedFolderName.trim()) return;
                try {
                  await api.createFolder(activeCourse.id, { name: newCreatedFolderName.trim() });
                  setShowCreateFolderModal(false);
                  setNewCreatedFolderName('');
                  onRefreshFolders();
                  setFeedbackMessage({ text: 'Folder created successfully.' });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  setFeedbackMessage({ text: `Create folder note: ${msg}`, isError: true });
                }
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="text"
                  placeholder="e.g. Cognitive Psychology, Week 3"
                  value={newCreatedFolderName}
                  onChange={(e) => setNewCreatedFolderName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
