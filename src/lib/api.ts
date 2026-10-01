import {
  Course,
  DocumentChunk,
  Folder,
  Material,
  PastPaper,
  QuizQuestion,
  StudyCalendarEvent,
  StudySessionLog,
  TutorMessage,
  User,
  UserProgress,
  VectorSyncStatus,
} from '../types';

let currentUserId = localStorage.getItem('study_buddy_user_id') || 'user_alex';

export function getActiveUserId(): string {
  return currentUserId;
}

export function setActiveUserId(userId: string) {
  currentUserId = userId;
  localStorage.setItem('study_buddy_user_id', userId);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('x-user-id', currentUserId);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${res.status}`);
    }

    const data = await res.json();
    // Cache successful GET responses in localStorage for offline access
    if (options.method === undefined || options.method === 'GET') {
      try {
        localStorage.setItem(`cache:${currentUserId}:${endpoint}`, JSON.stringify(data));
      } catch {}
    }
    return data;
  } catch (error) {
    // If network error, check offline cache
    if (options.method === undefined || options.method === 'GET') {
      const cached = localStorage.getItem(`cache:${currentUserId}:${endpoint}`);
      if (cached) {
        console.warn(`[API] Serving offline cached data for ${endpoint}`);
        return JSON.parse(cached);
      }
    }
    throw error;
  }
}

export const api = {
  // Auth
  getMe: () => request<{ user: User; availableUsers: User[] }>('/auth/me'),

  // Courses
  getCourses: () => request<{ courses: Course[] }>('/courses'),
  getCourse: (id: string) => request<{ course: Course }>(`/courses/${id}`),
  createCourse: (data: { title: string; code: string; description?: string; color?: string }) =>
    request<{ course: Course }>('/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id: string, data: Partial<Course>) =>
    request<{ course: Course }>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: (id: string) =>
    request<{ success: boolean; message: string }>(`/courses/${id}`, { method: 'DELETE' }),

  // Folders (Requirement 1)
  getFolders: (courseId: string) => request<{ folders: Folder[] }>(`/courses/${courseId}/folders`),
  createFolder: (courseId: string, data: { name: string; color?: string; icon?: string }) =>
    request<{ folder: Folder }>(`/courses/${courseId}/folders`, { method: 'POST', body: JSON.stringify(data) }),
  updateFolder: (folderId: string, data: { name: string; color?: string; icon?: string }) =>
    request<{ folder: Folder }>(`/folders/${folderId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (folderId: string, reassignToFolderId?: string | null) =>
    request<{ success: boolean; message: string }>(`/folders/${folderId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reassignToFolderId }),
    }),

  // Materials & Documents
  getMaterials: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'root' : folderId || 'all';
    return request<{ materials: Material[] }>(`/materials?courseId=${courseId}&folderId=${folderParam}`);
  },
  getMaterialChunks: (materialId: string) =>
    request<{ chunks: DocumentChunk[] }>(`/materials/${materialId}/chunks`),
  uploadMaterialFile: (courseId: string, folderId: string | null, file: File) => {
    const formData = new FormData();
    formData.append('courseId', courseId);
    if (folderId) formData.append('folderId', folderId);
    formData.append('file', file);
    return request<{ material: Material }>('/materials/upload', {
      method: 'POST',
      body: formData,
    });
  },
  uploadMaterialText: (courseId: string, folderId: string | null, filename: string, text: string) =>
    request<{ material: Material }>('/materials/upload', {
      method: 'POST',
      body: JSON.stringify({ courseId, folderId, filename, text }),
    }),
  moveMaterial: (materialId: string, targetFolderId: string | null) =>
    request<{ material: Material; message: string }>(`/materials/${materialId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId: targetFolderId }),
    }),
  deleteMaterial: (id: string) =>
    request<{ success: boolean }>(`/materials/${id}`, { method: 'DELETE' }),

  // Vector RAG Testing & Search
  testRetrieve: (data: { query: string; courseId: string; folderId?: string | null | 'all'; topK?: number; forceLexical?: boolean }) =>
    request<{
      results: { chunk: DocumentChunk; score: number; matchType: 'vector' | 'lexical' | 'hybrid' }[];
      matchType: 'vector' | 'lexical' | 'hybrid';
      totalChunksInScope: number;
    }>('/rag/retrieve', { method: 'POST', body: JSON.stringify(data) }),

  // Tutor
  getTutorMessages: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'null' : folderId || 'all';
    return request<{ messages: TutorMessage[] }>(`/tutor/messages?courseId=${courseId}&folderId=${folderParam}`);
  },
  sendTutorChat: (data: { courseId: string; folderId?: string | null | 'all'; message: string; tutorStyle?: string }) =>
    request<{ message: TutorMessage; retrieval: any }>('/tutor/chat', { method: 'POST', body: JSON.stringify(data) }),
  clearTutorChat: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'null' : folderId || 'all';
    return request<{ success: boolean }>(`/tutor/messages?courseId=${courseId}&folderId=${folderParam}`, {
      method: 'DELETE',
    });
  },

  // Active Recall & Quiz / Exam Generation
  getCoverage: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'root' : folderId || 'all';
    return request<{
      eligibleMaterials: { id: string; filename: string; extractedTextLength: number; chunkCount: number }[];
      excludedMaterials: { filename: string; reason: string }[];
      totalReadableChunks: number;
      distinctPagesCount: number;
      distinctDocumentsCount: number;
    }>(`/learning/coverage?courseId=${courseId}&folderId=${folderParam}`);
  },
  getVectorSyncStatus: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'root' : folderId || 'all';
    return request<VectorSyncStatus>(`/learning/vector-sync-status?courseId=${courseId}&folderId=${folderParam}`);
  },
  triggerVectorResync: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'root' : folderId || 'all';
    return request<{ success: boolean; message: string; totalChunks: number; embeddedChunks: number }>(
      '/learning/vector-resync',
      {
        method: 'POST',
        body: JSON.stringify({ courseId, folderId: folderParam }),
      }
    );
  },
  generateQuiz: (data: {
    courseId: string;
    courseIds?: string[];
    folderId?: string | null | 'all';
    selectedDocumentIds?: string[];
    pastPaperIds?: string[];
    questionCount?: number;
    difficulty?: string;
    questionTypes?: string[];
    questionStyle?: string;
    topic?: string;
    isMockExam?: boolean;
  }) =>
    request<{
      questions: QuizQuestion[];
      coverage?: { documentId: string; filename: string; pagesCovered: number[]; totalChunksSampled: number }[];
      retrievedCount: number;
      validationSummary?: {
        eligibleDocuments: number;
        distinctPages: number;
        totalChunksSampled: number;
      };
    }>('/learning/generate-assessment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProgress: (courseId: string) => request<{ progress: UserProgress }>(`/learning/progress?courseId=${courseId}`),
  recordQuizAnswer: (data: { courseId: string; isCorrect: boolean; topic?: string }) =>
    request<{ progress: UserProgress }>('/learning/progress', { method: 'POST', body: JSON.stringify(data) }),

  // Past Papers
  getPastPapers: (courseId: string, folderId?: string | null | 'all') => {
    const folderParam = folderId === null ? 'root' : folderId || 'all';
    return request<{ pastPapers: PastPaper[] }>(`/courses/${courseId}/past-papers?folderId=${folderParam}`);
  },
  uploadPastPaperFile: (courseId: string, folderId: string | null, file: File, title?: string) => {
    const formData = new FormData();
    if (folderId) formData.append('folderId', folderId);
    if (title) formData.append('title', title);
    formData.append('file', file);
    return request<{ pastPaper: PastPaper }>(`/courses/${courseId}/past-papers/upload`, {
      method: 'POST',
      body: formData,
    });
  },
  getPastPaper: (id: string) => request<{ pastPaper: PastPaper }>(`/past-papers/${id}`),
  deletePastPaper: (id: string) => request<{ success: boolean; message: string }>(`/past-papers/${id}`, { method: 'DELETE' }),

  // Study Calendar & Sessions
  getCalendarEvents: () => request<{ events: StudyCalendarEvent[] }>('/calendar/events'),
  createCalendarEvent: (data: Partial<StudyCalendarEvent>) =>
    request<{ event: StudyCalendarEvent }>('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
  updateCalendarEvent: (id: string, data: Partial<StudyCalendarEvent>) =>
    request<{ event: StudyCalendarEvent }>(`/calendar/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCalendarEvent: (id: string) =>
    request<{ success: boolean }>(`/calendar/events/${id}`, { method: 'DELETE' }),
  getStudyLogs: () => request<{ logs: StudySessionLog[] }>('/study/logs'),
  logStudySession: (data: { courseId: string; folderId?: string | null; durationMinutes: number; notes?: string }) =>
    request<{ log: StudySessionLog }>('/study/logs', { method: 'POST', body: JSON.stringify(data) }),

  // Verification Suite
  runDiagnostics: () =>
    request<{
      allPassed: boolean;
      results: { testName: string; passed: boolean; details: string }[];
      environment: {
        geminiApiKeyPresent: boolean;
        embeddingModel: string;
        generationModel: string;
      };
    }>('/diagnostics/verify-rag', { method: 'POST' }),
};
