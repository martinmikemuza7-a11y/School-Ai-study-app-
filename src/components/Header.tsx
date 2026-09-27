import React, { useState } from 'react';
import { BookOpen, Check, ChevronDown, Cpu, Folder, Layers, Plus, RefreshCw, Shield, Sparkles, User as UserIcon, Wifi, WifiOff } from 'lucide-react';
import { Course, Folder as FolderType, User } from '../types';

interface HeaderProps {
  currentUser: User | null;
  availableUsers: User[];
  onSwitchUser: (userId: string) => void;
  courses: Course[];
  activeCourse: Course | null;
  onSelectCourse: (course: Course) => void;
  folders: FolderType[];
  activeFolderId: string | null | 'all';
  onSelectFolder: (folderId: string | null | 'all') => void;
  onCreateCourse: (data: { title: string; code: string; description: string; color: string }) => void;
  onCreateFolder: (name: string) => void;
  activeTab: 'tutor' | 'materials' | 'rag' | 'quiz' | 'diagnostics';
  onSelectTab: (tab: 'tutor' | 'materials' | 'rag' | 'quiz' | 'diagnostics') => void;
  isOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  availableUsers,
  onSwitchUser,
  courses,
  activeCourse,
  onSelectCourse,
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateCourse,
  onCreateFolder,
  activeTab,
  onSelectTab,
  isOnline,
}) => {
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#3b82f6');
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim() || !newCourseCode.trim()) return;
    onCreateCourse({
      title: newCourseTitle.trim(),
      code: newCourseCode.trim(),
      description: newCourseDesc.trim(),
      color: newCourseColor,
    });
    setNewCourseTitle('');
    setNewCourseCode('');
    setNewCourseDesc('');
    setShowCourseModal(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setShowFolderModal(false);
  };

  const activeFolderName =
    activeFolderId === 'all'
      ? 'All Folders (Course Wide)'
      : activeFolderId === null
      ? 'Root (Unassigned)'
      : folders.find((f) => f.id === activeFolderId)?.name || 'Selected Folder';

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Top tier: App title, User switcher, Course switcher, Connectivity */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">Study Buddy AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                Vector RAG v2
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Folder-Isolated Embeddings • Grounded Gemini 3.8 Tutor
            </p>
          </div>
        </div>

        {/* Course & Folder Quick Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Course Selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <span className="px-2 font-medium text-slate-500">Course:</span>
            <select
              value={activeCourse?.id || ''}
              onChange={(e) => {
                const selected = courses.find((c) => c.id === e.target.value);
                if (selected) onSelectCourse(selected);
              }}
              className="bg-white border-0 text-slate-800 font-semibold rounded px-2 py-1 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[180px] truncate"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCourseModal(true)}
              title="Add Course"
              className="ml-1 p-1 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Active Folder Selector (Quick Isolation switch) */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <span className="px-2 font-medium text-slate-500 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              Folder:
            </span>
            <select
              value={activeFolderId === null ? 'null' : activeFolderId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') onSelectFolder('all');
                else if (val === 'null') onSelectFolder(null);
                else onSelectFolder(val);
              }}
              className="bg-white border-0 text-slate-800 font-semibold rounded px-2 py-1 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[170px] truncate"
            >
              <option value="all">📂 All Folders</option>
              <option value="null">📄 Root / Unassigned</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowFolderModal(true)}
              title="Create Folder in this Course"
              className="ml-1 p-1 text-slate-600 hover:text-amber-600 hover:bg-white rounded transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* User Multi-Tenant Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <span className="px-2 font-medium text-slate-500 flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5 text-slate-600" />
              User:
            </span>
            <select
              value={currentUser?.id || ''}
              onChange={(e) => onSwitchUser(e.target.value)}
              className="bg-white border-0 text-slate-800 font-semibold rounded px-2 py-1 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Connectivity Status */}
          <div
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isOnline ? 'Online: Live Vector RAG & Gemini active' : 'Offline: Local cache active'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline Cache'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center justify-between overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-4 py-2">
          <button
            onClick={() => onSelectTab('tutor')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'tutor'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Study Tutor
          </button>

          <button
            onClick={() => onSelectTab('materials')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'materials'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Folder className="w-4 h-4" />
            Materials & Folders
          </button>

          <button
            onClick={() => onSelectTab('rag')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'rag'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Vector RAG Explorer
          </button>

          <button
            onClick={() => onSelectTab('quiz')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'quiz'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Active Recall Quiz
          </button>

          <button
            onClick={() => onSelectTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'diagnostics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            Architecture Diagnostics
          </button>
        </nav>

        {/* Current Active Isolation Scope Banner */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 py-1 px-3 bg-slate-50 rounded-md border border-slate-200">
          <Shield className="w-3.5 h-3.5 text-indigo-600" />
          <span>Active RAG Scope:</span>
          <span className="font-semibold text-slate-800">
            {activeCourse?.code} • {activeFolderName}
          </span>
        </div>
      </div>

      {/* Modal: Create Course */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Course</h3>
            <p className="text-xs text-slate-500 mb-4">
              Courses provide top-level isolation for your documents and vector embeddings.
            </p>
            <form onSubmit={handleCreateCourseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  placeholder="e.g. CS-224N or BIO-101"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  placeholder="e.g. Natural Language Processing with Deep Learning"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief synopsis of topics covered..."
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Color</label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewCourseColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        newCourseColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Isolated Study Folder</h3>
            <p className="text-xs text-slate-500 mb-4">
              Folders isolate documents and chunk retrieval within {activeCourse?.code}.
            </p>
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 3: Vector Spaces, or Week 2: Midterm Prep"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
