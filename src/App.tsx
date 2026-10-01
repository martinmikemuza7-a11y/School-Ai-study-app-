import React, { useEffect, useState } from 'react';
import { DiagnosticsView } from './components/DiagnosticsView';
import { Header, NavigationTab } from './components/Header';
import { MaterialsView } from './components/MaterialsView';
import { PastPapersView } from './components/PastPapersView';
import { QuizView } from './components/QuizView';
import { RagExplorerView } from './components/RagExplorerView';
import { StudyPlannerView } from './components/StudyPlannerView';
import { TutorView } from './components/TutorView';
import { api, getActiveUserId, setActiveUserId } from './lib/api';
import { Course, Folder, User } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null | 'all'>('all');
  const [activeTab, setActiveTab] = useState<NavigationTab>('tutor');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [initialPastPaperForExam, setInitialPastPaperForExam] = useState<string | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial user load
  useEffect(() => {
    loadUserAndCourses();
  }, []);

  const loadUserAndCourses = async () => {
    try {
      const authRes = await api.getMe();
      setCurrentUser(authRes.user);
      setAvailableUsers(authRes.availableUsers || []);

      const courseRes = await api.getCourses();
      const list = courseRes.courses || [];
      setCourses(list);
      if (list.length > 0) {
        setActiveCourse(list[0]);
        loadFoldersForCourse(list[0].id);
      } else {
        setActiveCourse(null);
        setFolders([]);
      }
    } catch (err) {
      console.error('Error loading initial state:', err);
    }
  };

  const loadFoldersForCourse = async (courseId: string) => {
    try {
      const res = await api.getFolders(courseId);
      setFolders(res.folders || []);
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const handleSwitchUser = (userId: string) => {
    setActiveUserId(userId);
    const targetUser = availableUsers.find((u) => u.id === userId);
    if (targetUser) setCurrentUser(targetUser);
    setActiveFolderId('all');
    // Reload courses for newly selected user to ensure multi-tenant isolation
    api.getCourses().then((res) => {
      const list = res.courses || [];
      setCourses(list);
      if (list.length > 0) {
        setActiveCourse(list[0]);
        loadFoldersForCourse(list[0].id);
      } else {
        setActiveCourse(null);
        setFolders([]);
      }
    });
  };

  const handleSelectCourse = (course: Course) => {
    setActiveCourse(course);
    setActiveFolderId('all');
    loadFoldersForCourse(course.id);
  };

  const handleCreateCourse = async (data: { title: string; code: string; description: string; color: string }) => {
    try {
      const res = await api.createCourse(data);
      const updatedList = [res.course, ...courses];
      setCourses(updatedList);
      setActiveCourse(res.course);
      setActiveFolderId('all');
      setFolders([]);
    } catch (err) {
      console.error('Create course failed:', err);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!activeCourse) return;
    try {
      const res = await api.createFolder(activeCourse.id, { name });
      setFolders((prev) => [...prev, res.folder]);
      setActiveFolderId(res.folder.id);
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  };

  const handleLaunchExamWithPaper = (paperId: string) => {
    setInitialPastPaperForExam(paperId);
    setActiveTab('study');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      <Header
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSwitchUser={handleSwitchUser}
        courses={courses}
        activeCourse={activeCourse}
        onSelectCourse={handleSelectCourse}
        folders={folders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onCreateCourse={handleCreateCourse}
        onCreateFolder={handleCreateFolder}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOnline={isOnline}
      />

      <main className="flex-1 pb-12">
        {activeTab === 'tutor' && (
          <TutorView
            activeCourse={activeCourse}
            activeFolderId={activeFolderId}
            folders={folders}
            onSelectFolder={setActiveFolderId}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialsView
            activeCourse={activeCourse}
            folders={folders}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
            onRefreshFolders={() => {
              if (activeCourse) loadFoldersForCourse(activeCourse.id);
            }}
          />
        )}

        {activeTab === 'past_papers' && (
          <PastPapersView
            activeCourse={activeCourse}
            folders={folders}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
            onLaunchExamWithPaper={handleLaunchExamWithPaper}
          />
        )}

        {activeTab === 'study' && (
          <QuizView
            activeCourse={activeCourse}
            folders={folders}
            activeFolderId={activeFolderId}
            initialPastPaperId={initialPastPaperForExam}
          />
        )}

        {activeTab === 'calendar' && (
          <StudyPlannerView
            activeCourse={activeCourse}
            courses={courses}
            folders={folders}
          />
        )}

        {activeTab === 'rag' && (
          <RagExplorerView
            activeCourse={activeCourse}
            folders={folders}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
          />
        )}

        {activeTab === 'diagnostics' && <DiagnosticsView />}
      </main>
    </div>
  );
}
