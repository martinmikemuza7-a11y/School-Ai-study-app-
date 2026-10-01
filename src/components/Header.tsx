import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Cpu,
  FileText,
  Folder,
  Layers,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Timer,
  User as UserIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Course, Folder as FolderType, User } from '../types';
import { VectorSyncIndicator } from './VectorSyncIndicator';

export type NavigationTab =
  | 'tutor'
  | 'materials'
  | 'past_papers'
  | 'study'
  | 'calendar'
  | 'rag'
  | 'diagnostics';

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
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
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
                Vector RAG
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Folder Isolation • Past Papers • Grounded AI Tutor
            </p>
          </div>
        </div>

        {/* Course & Folder Quick Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Course Selector */}
          <div className="relative group">
            <select
              aria-label="Select course"
              value={activeCourse?.id || ''}
              onChange={(e) => {
                const selected = courses.find((c) => c.id === e.target.value);
                if (selected) onSelectCourse(selected);
              }}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer transition shadow-2xs"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowCourseModal(true)}
            title="Create new isolated course"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Active Folder Selector */}
          {activeCourse && (
            <div className="relative group">
              <select
                aria-label="Select folder"
                value={activeFolderId === null ? 'null' : activeFolderId || 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  onSelectFolder(val === 'all' ? 'all' : val === 'null' ? null : val);
                }}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs sm:text-sm font-medium rounded-xl pl-3 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer transition shadow-2xs"
              >
                <option value="all">📂 Scope: All Folders</option>
                <option value="null">📁 Unassigned (Course Root)</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    📁 {folder.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeCourse && (
            <button
              onClick={() => setShowFolderModal(true)}
              title="Create new folder in course"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs"
            >
              <Folder className="w-4 h-4 text-indigo-600" />
            </button>
          )}

          {/* Real-time Vector Sync Progress Indicator */}
          {activeCourse && (
            <VectorSyncIndicator
              activeCourse={activeCourse}
              activeFolderId={activeFolderId}
              folders={folders}
              onNavigateToTab={onSelectTab}
            />
          )}

          {/* User Multi-Tenant Switcher */}
          <div className="relative group ml-1">
            <select
              aria-label="Switch User Persona"
              value={currentUser?.id || ''}
              onChange={(e) => onSwitchUser(e.target.value)}
              className="appearance-none bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 text-indigo-900 text-xs sm:text-sm font-semibold rounded-xl pl-8 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer transition shadow-2xs"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.name} ({u.email.split('@')[0]})
                </option>
              ))}
            </select>
            <UserIcon className="w-4 h-4 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-4 h-4 text-indigo-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Network Status Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center justify-between overflow-x-auto no-scrollbar py-1">
        <nav className="flex space-x-1 sm:space-x-2 py-1">
          <button
            onClick={() => onSelectTab('tutor')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tutor'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Tutor
          </button>

          <button
            onClick={() => onSelectTab('materials')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'materials'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Folder className="w-4 h-4" />
            Materials & Notes
          </button>

          <button
            onClick={() => onSelectTab('past_papers')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'past_papers'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Past Papers
          </button>

          <button
            onClick={() => onSelectTab('study')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'study'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Exam Generator & Mock
          </button>

          <button
            onClick={() => onSelectTab('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Study Calendar & Timer
          </button>

          <button
            onClick={() => onSelectTab('rag')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'rag'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            RAG Explorer
          </button>

          <button
            onClick={() => onSelectTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            Diagnostics
          </button>
        </nav>

        {/* Current Active Isolation Scope Banner */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 py-1 px-3 bg-slate-50 rounded-md border border-slate-200">
          <Shield className="w-3.5 h-3.5 text-indigo-600" />
          <span>Active Scope:</span>
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
                  placeholder="e.g. Week 1: Optimization Basics"
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
