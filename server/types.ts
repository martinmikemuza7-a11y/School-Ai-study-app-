export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Course {
  id: string;
  ownerId: string;
  title: string;
  code: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  courseId: string;
  ownerId: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export type MaterialStatus = 'uploaded' | 'processing' | 'indexing_vectors' | 'ready' | 'error';

export type VectorSyncState = 'synced' | 'indexing' | 'empty' | 'error';

export interface DocumentVectorSyncInfo {
  id: string;
  filename: string;
  title: string;
  status: MaterialStatus;
  statusMessage?: string;
  chunkCount: number;
  embeddedChunksCount: number;
  hasEmbeddings: boolean;
  extractedTextLength: number;
  folderId: string | null;
  updatedAt: string;
}

export interface VectorSyncStatus {
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  folderId: string | null | 'all';
  folderName: string;
  totalDocuments: number;
  readyDocuments: number;
  indexingDocuments: number;
  errorDocuments: number;
  totalChunks: number;
  embeddedChunks: number;
  vectorDimensions: number;
  syncPercentage: number;
  syncState: VectorSyncState;
  isSynced: boolean;
  documents: DocumentVectorSyncInfo[];
  lastSyncedAt: string;
}

export interface Material {
  id: string;
  courseId: string;
  folderId: string | null; // null represents default root course materials
  ownerId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedTextLength: number;
  chunkCount: number;
  status: MaterialStatus;
  statusMessage?: string;
  hasEmbeddings: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PastPaperStatus = 'uploaded' | 'processing' | 'ready' | 'error';

export interface PastPaperQuestionStructure {
  questionNumber: string;
  section?: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  allocatedMarks?: number;
  markingGuide?: string;
  sourcePage?: number;
}

export interface PastPaper {
  id: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  year?: string;
  examTerm?: string;
  institution?: string;
  pageCount: number;
  extractedTextLength: number;
  extractedQuestions: PastPaperQuestionStructure[];
  status: PastPaperStatus;
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  pageOrSlide: number;
  chunkIndex: number;
  text: string;
  sourceExcerpt: string;
  embedding?: number[];
  tokenEstimate: number;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  matchType: 'vector' | 'lexical' | 'hybrid';
}

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  courseId: string;
  folderId: string | null;
  folderName?: string;
  pageOrSlide: number;
  sourceExcerpt: string;
  relevanceScore: number;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
  retrievalMetadata?: {
    courseId: string;
    folderId: string | null;
    totalChunksSearched: number;
    matchType: 'vector' | 'lexical' | 'hybrid';
    chunksRetrieved: number;
  };
}

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'short_essay'
  | 'fill_in_blank';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  allocatedMarks?: number;
  question: string;
  topic?: string;
  questionStyle?: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  markingPoints?: string[]; // Key scoring criteria for short_essay questions
  sampleAnswer?: string; // Model exemplar answer for short_essay questions
  acceptableAnswers?: string[]; // Variations/synonyms for short_answer / fill_in_blank questions
  citations: Citation[];
}

export interface UserProgress {
  userId: string;
  courseId: string;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  streakDays: number;
  lastStudiedAt: string;
  topicMastery: Record<string, number>;
}

export interface StudyCalendarEvent {
  id: string;
  userId: string;
  courseId: string;
  folderId?: string | null;
  title: string;
  description?: string;
  startTime: string; // ISO date string
  endTime: string;   // ISO date string
  durationMinutes: number;
  isRecurring: boolean;
  recurrenceRule?: 'daily' | 'weekly' | 'weekdays' | 'monthly';
  reminderMinutesBefore?: number;
  completed: boolean;
  createdAt: string;
}

export interface StudySessionLog {
  id: string;
  userId: string;
  courseId: string;
  folderId?: string | null;
  durationMinutes: number;
  completedAt: string;
  notes?: string;
}
