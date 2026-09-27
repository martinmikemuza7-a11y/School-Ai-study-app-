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

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'short_essay';

export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  bloomLevel: BloomLevel;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  markingPoints?: string[]; // Key scoring criteria for short_essay questions
  sampleAnswer?: string; // Model exemplar answer for short_essay questions
  acceptableAnswers?: string[]; // Variations/synonyms for short_answer questions
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
