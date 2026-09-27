import fs from 'fs';
import path from 'path';
import { Course, DocumentChunk, Folder, Material, QuizQuestion, TutorMessage, User, UserProgress } from './types.js';

interface DatabaseSchema {
  users: User[];
  courses: Course[];
  folders: Folder[];
  materials: Material[];
  chunks: DocumentChunk[];
  progress: UserProgress[];
  tutorMessages: (TutorMessage & { courseId: string; folderId: string | null; ownerId: string })[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'study_buddy_db.json');

// In-memory cache synced with atomic disk writes
let db: DatabaseSchema = {
  users: [],
  courses: [],
  folders: [],
  materials: [],
  chunks: [],
  progress: [],
  tutorMessages: [],
};

let isInitialized = false;
let lastLoadedMtime = 0;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveDbToDisk() {
  ensureDataDir();
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    if (fs.existsSync(DB_FILE)) {
      lastLoadedMtime = fs.statSync(DB_FILE).mtimeMs;
    }
  } catch (err) {
    console.error('[DB] Failed to persist database:', err);
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }
}

export function initDb(forceReload = false) {
  ensureDataDir();

  if (fs.existsSync(DB_FILE)) {
    try {
      const stat = fs.statSync(DB_FILE);
      if (forceReload || !isInitialized || stat.mtimeMs > lastLoadedMtime) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        db = JSON.parse(raw);
        lastLoadedMtime = stat.mtimeMs;
        isInitialized = true;
      }
    } catch (err) {
      console.error('[DB] Corrupt database file, re-seeding default workspace:', err);
      seedDefaultData();
    }
  } else if (!isInitialized) {
    seedDefaultData();
  }
}

function seedDefaultData() {
  console.log('[DB] Seeding default workspace for Study Buddy AI...');
  const user1: User = {
    id: 'user_alex',
    name: 'Alex Morgan',
    email: 'alex.morgan@university.edu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  };

  const user2: User = {
    id: 'user_taylor',
    name: 'Dr. Taylor Reed',
    email: 'taylor.reed@lab.org',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  };

  const course1: Course = {
    id: 'course_ml_101',
    ownerId: 'user_alex',
    title: 'Machine Learning & Neural Architectures',
    code: 'CS-482',
    description: 'Foundations of statistical learning, gradient descent optimization, backpropagation, and transformer attention mechanisms.',
    color: '#3b82f6',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  };

  const course2: Course = {
    id: 'course_bio_202',
    ownerId: 'user_alex',
    title: 'Molecular Genetics & CRISPR',
    code: 'BIO-310',
    description: 'Structure of nucleic acids, transcriptional regulation, DNA repair pathways, and gene-editing CRISPR-Cas9 systems.',
    color: '#10b981',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  };

  // User 2 isolated course
  const courseUser2: Course = {
    id: 'course_taylor_private',
    ownerId: 'user_taylor',
    title: 'Quantum Information & Algorithms',
    code: 'PHYS-601',
    description: 'Superposition, entanglement, quantum Fourier transform, and Shor’s algorithm.',
    color: '#8b5cf6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Folders for course 1
  const folder1: Folder = {
    id: 'folder_ml_week1',
    courseId: 'course_ml_101',
    ownerId: 'user_alex',
    name: 'Week 1: Gradient Descent & Loss Functions',
    color: '#60a5fa',
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  };

  const folder2: Folder = {
    id: 'folder_ml_week2',
    courseId: 'course_ml_101',
    ownerId: 'user_alex',
    name: 'Week 2: Deep Networks & Backpropagation',
    color: '#a855f7',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  };

  // Folder for course 2
  const folderBio: Folder = {
    id: 'folder_bio_crispr',
    courseId: 'course_bio_202',
    ownerId: 'user_alex',
    name: 'CRISPR Cas9 Mechanisms',
    color: '#34d399',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  };

  // Materials
  const mat1: Material = {
    id: 'doc_gradient_descent',
    courseId: 'course_ml_101',
    folderId: 'folder_ml_week1',
    ownerId: 'user_alex',
    title: 'Lecture 1: Gradient Descent & Convex Optimization',
    filename: 'Lecture1_Optimization_Basics.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 42500,
    extractedTextLength: 2150,
    chunkCount: 3,
    status: 'ready',
    hasEmbeddings: false,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  };

  const mat2: Material = {
    id: 'doc_backprop_notes',
    courseId: 'course_ml_101',
    folderId: 'folder_ml_week2',
    ownerId: 'user_alex',
    title: 'Lecture 2: Chain Rule & Computational Graphs',
    filename: 'Backpropagation_Derivations.txt',
    mimeType: 'text/plain',
    sizeBytes: 18400,
    extractedTextLength: 1820,
    chunkCount: 3,
    status: 'ready',
    hasEmbeddings: false,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  };

  const matBio: Material = {
    id: 'doc_crispr_overview',
    courseId: 'course_bio_202',
    folderId: 'folder_bio_crispr',
    ownerId: 'user_alex',
    title: 'CRISPR-Cas9 Guide RNA & PAM Sequences',
    filename: 'CRISPR_Targeting_Overview.md',
    mimeType: 'text/markdown',
    sizeBytes: 15200,
    extractedTextLength: 1600,
    chunkCount: 2,
    status: 'ready',
    hasEmbeddings: false,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  };

  // Seeded chunks with clean text and clear provenance
  const chunks: DocumentChunk[] = [
    {
      chunkId: 'chk_ml_w1_1',
      documentId: 'doc_gradient_descent',
      filename: 'Lecture1_Optimization_Basics.pdf',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week1',
      ownerId: 'user_alex',
      pageOrSlide: 1,
      chunkIndex: 0,
      text: 'Gradient descent is a first-order iterative optimization algorithm for finding a local minimum of a differentiable function. In machine learning, we seek parameter weights theta that minimize empirical risk L(theta) over training dataset D. The update rule is theta_{t+1} = theta_t - eta * nabla L(theta_t), where eta is the learning rate hyperparameter.',
      sourceExcerpt: 'Gradient descent is a first-order iterative optimization algorithm for finding a local minimum of a differentiable function. Update rule: theta_{t+1} = theta_t - eta * nabla L(theta_t)...',
      tokenEstimate: 75,
    },
    {
      chunkId: 'chk_ml_w1_2',
      documentId: 'doc_gradient_descent',
      filename: 'Lecture1_Optimization_Basics.pdf',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week1',
      ownerId: 'user_alex',
      pageOrSlide: 2,
      chunkIndex: 1,
      text: 'Stochastic Gradient Descent (SGD) computes the gradient estimate on randomly sampled minibatches B rather than the entire dataset. This reduces per-iteration computational complexity from O(N) to O(|B|), while injecting stochastic noise that often helps gradient descent escape saddle points and shallow local minima.',
      sourceExcerpt: 'Stochastic Gradient Descent (SGD) computes gradient estimates on randomly sampled minibatches B rather than the entire dataset...',
      tokenEstimate: 68,
    },
    {
      chunkId: 'chk_ml_w1_3',
      documentId: 'doc_gradient_descent',
      filename: 'Lecture1_Optimization_Basics.pdf',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week1',
      ownerId: 'user_alex',
      pageOrSlide: 3,
      chunkIndex: 2,
      text: 'Momentum and Adaptive Optimizers: Standard SGD can oscillate severely in ravines where the surface curves much more steeply in one dimension. Momentum accelerates SGD in the relevant direction and dampens oscillations by incorporating an exponentially decaying moving average of past gradients: v_t = gamma * v_{t-1} + eta * nabla L.',
      sourceExcerpt: 'Momentum accelerates SGD in the relevant direction and dampens oscillations by incorporating an exponentially decaying moving average...',
      tokenEstimate: 72,
    },
    {
      chunkId: 'chk_ml_w2_1',
      documentId: 'doc_backprop_notes',
      filename: 'Backpropagation_Derivations.txt',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week2',
      ownerId: 'user_alex',
      pageOrSlide: 1,
      chunkIndex: 0,
      text: 'Backpropagation is reverse-mode automatic differentiation applied to computational graphs. Forward propagation computes the activations of each layer: a^{(l)} = sigma(z^{(l)}), where z^{(l)} = W^{(l)} * a^{(l-1)} + b^{(l)}. During backward propagation, the error signal delta^{(l)} is passed backwards from the output layer to calculate partial derivatives dL/dW.',
      sourceExcerpt: 'Backpropagation is reverse-mode automatic differentiation applied to computational graphs. Forward prop computes activations...',
      tokenEstimate: 78,
    },
    {
      chunkId: 'chk_ml_w2_2',
      documentId: 'doc_backprop_notes',
      filename: 'Backpropagation_Derivations.txt',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week2',
      ownerId: 'user_alex',
      pageOrSlide: 2,
      chunkIndex: 1,
      text: 'Vanishing and Exploding Gradients: When deep neural networks use saturating activation functions such as Sigmoid or Tanh, the derivative approaches zero as the input magnitude grows large. Repeated multiplication of values less than 1 through L layers causes the gradient signal to shrink exponentially, preventing early layers from learning.',
      sourceExcerpt: 'Vanishing and Exploding Gradients: When deep neural networks use saturating activation functions such as Sigmoid or Tanh...',
      tokenEstimate: 70,
    },
    {
      chunkId: 'chk_ml_w2_3',
      documentId: 'doc_backprop_notes',
      filename: 'Backpropagation_Derivations.txt',
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week2',
      ownerId: 'user_alex',
      pageOrSlide: 3,
      chunkIndex: 2,
      text: 'Modern remedies for vanishing gradients include non-saturating activation functions like ReLU (Rectified Linear Unit), Leaky ReLU, GELU, residual skip connections (ResNets), and Layer / Batch Normalization which stabilizes internal activation distributions.',
      sourceExcerpt: 'Modern remedies for vanishing gradients include non-saturating activations like ReLU, residual skip connections (ResNets), and Normalization...',
      tokenEstimate: 60,
    },
    {
      chunkId: 'chk_bio_1',
      documentId: 'doc_crispr_overview',
      filename: 'CRISPR_Targeting_Overview.md',
      courseId: 'course_bio_202',
      folderId: 'folder_bio_crispr',
      ownerId: 'user_alex',
      pageOrSlide: 1,
      chunkIndex: 0,
      text: 'CRISPR-Cas9 is a prokaryotic adaptive immune system repurposed for targeted genome editing. The system requires two core components: the Cas9 endonuclease enzyme and a single guide RNA (sgRNA). The sgRNA contains a 20-nucleotide spacer sequence that guides Cas9 to the complementary target DNA site.',
      sourceExcerpt: 'CRISPR-Cas9 is a prokaryotic adaptive immune system repurposed for targeted genome editing. Core components: Cas9 endonuclease and sgRNA...',
      tokenEstimate: 65,
    },
    {
      chunkId: 'chk_bio_2',
      documentId: 'doc_crispr_overview',
      filename: 'CRISPR_Targeting_Overview.md',
      courseId: 'course_bio_202',
      folderId: 'folder_bio_crispr',
      ownerId: 'user_alex',
      pageOrSlide: 2,
      chunkIndex: 1,
      text: 'The Protospacer Adjacent Motif (PAM) is a short DNA sequence (typically 5-NGG-3 for Streptococcus pyogenes Cas9) situated directly downstream of the target DNA region. Cas9 will only bind and cleave the DNA if the correct PAM sequence is present, introducing a double-strand break (DSB) 3-4 nucleotides upstream of the PAM.',
      sourceExcerpt: 'The Protospacer Adjacent Motif (PAM) is a short DNA sequence (5-NGG-3 for SpCas9) directly downstream of the target DNA region...',
      tokenEstimate: 70,
    },
  ];

  db = {
    users: [user1, user2],
    courses: [course1, course2, courseUser2],
    folders: [folder1, folder2, folderBio],
    materials: [mat1, mat2, matBio],
    chunks,
    progress: [
      {
        userId: 'user_alex',
        courseId: 'course_ml_101',
        totalQuestionsAnswered: 12,
        correctAnswers: 10,
        streakDays: 4,
        lastStudiedAt: new Date().toISOString(),
        topicMastery: {
          Optimization: 85,
          'Neural Networks': 75,
        },
      },
    ],
    tutorMessages: [],
  };

  saveDbToDisk();
}

// ----------------- USER HELPERS -----------------
export function getUsers(): User[] {
  initDb();
  return db.users;
}

export function getUser(userId: string): User | undefined {
  initDb();
  return db.users.find((u) => u.id === userId);
}

// ----------------- COURSE HELPERS -----------------
export function getCourses(userId: string): Course[] {
  initDb();
  return db.courses.filter((c) => c.ownerId === userId);
}

export function getCourse(userId: string, courseId: string): Course | null {
  initDb();
  const course = db.courses.find((c) => c.id === courseId);
  if (!course || course.ownerId !== userId) return null;
  return course;
}

export function createCourse(userId: string, data: { title: string; code: string; description?: string; color?: string }): Course {
  initDb();
  const newCourse: Course = {
    id: `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ownerId: userId,
    title: data.title.trim(),
    code: data.code.trim().toUpperCase(),
    description: data.description?.trim() || '',
    color: data.color || '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.courses.push(newCourse);
  saveDbToDisk();
  return newCourse;
}

export function updateCourse(
  userId: string,
  courseId: string,
  data: Partial<Pick<Course, 'title' | 'code' | 'description' | 'color'>>
): Course | null {
  initDb();
  const index = db.courses.findIndex((c) => c.id === courseId && c.ownerId === userId);
  if (index === -1) return null;

  db.courses[index] = {
    ...db.courses[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveDbToDisk();
  return db.courses[index];
}

export function deleteCourse(userId: string, courseId: string): boolean {
  initDb();
  const index = db.courses.findIndex((c) => c.id === courseId && c.ownerId === userId);
  if (index === -1) return false;

  db.courses.splice(index, 1);
  // Cascade delete folders, materials, chunks, progress
  db.folders = db.folders.filter((f) => f.courseId !== courseId || f.ownerId !== userId);
  db.materials = db.materials.filter((m) => m.courseId !== courseId || m.ownerId !== userId);
  db.chunks = db.chunks.filter((ch) => ch.courseId !== courseId || ch.ownerId !== userId);
  db.progress = db.progress.filter((p) => p.courseId !== courseId || p.userId !== userId);
  db.tutorMessages = db.tutorMessages.filter((t) => t.courseId !== courseId || t.ownerId !== userId);

  saveDbToDisk();
  return true;
}

// ----------------- FOLDER HELPERS (Real Folder Organization) -----------------
export function getFolders(userId: string, courseId: string): Folder[] {
  initDb();
  // Authorization check: ensure user owns the course
  const course = getCourse(userId, courseId);
  if (!course) return [];
  return db.folders.filter((f) => f.courseId === courseId && f.ownerId === userId);
}

export function getFolder(userId: string, folderId: string): Folder | null {
  initDb();
  const folder = db.folders.find((f) => f.id === folderId);
  if (!folder || folder.ownerId !== userId) return null;
  return folder;
}

export function createFolder(
  userId: string,
  courseId: string,
  data: { name: string; color?: string; icon?: string }
): Folder | null {
  initDb();
  const course = getCourse(userId, courseId);
  if (!course) return null;

  const newFolder: Folder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    courseId,
    ownerId: userId,
    name: data.name.trim(),
    color: data.color || course.color,
    icon: data.icon || 'folder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.folders.push(newFolder);
  saveDbToDisk();
  return newFolder;
}

export function updateFolder(
  userId: string,
  folderId: string,
  data: Partial<Pick<Folder, 'name' | 'color' | 'icon'>>
): Folder | null {
  initDb();
  const index = db.folders.findIndex((f) => f.id === folderId && f.ownerId === userId);
  if (index === -1) return null;

  db.folders[index] = {
    ...db.folders[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveDbToDisk();
  return db.folders[index];
}

/**
 * Delete folder while preserving documents!
 * Reassigns materials in this folder to reassignToFolderId or null (Root / Unassigned).
 */
export function deleteFolder(userId: string, folderId: string, reassignToFolderId?: string | null): boolean {
  initDb();
  const folder = db.folders.find((f) => f.id === folderId && f.ownerId === userId);
  if (!folder) return false;

  // Validate target reassign folder if provided
  let safeReassignId: string | null = null;
  if (reassignToFolderId) {
    const targetFolder = db.folders.find(
      (f) => f.id === reassignToFolderId && f.courseId === folder.courseId && f.ownerId === userId
    );
    if (targetFolder) {
      safeReassignId = targetFolder.id;
    }
  }

  // Preserve documents: Reassign folderId
  for (const m of db.materials) {
    if (m.folderId === folderId && m.ownerId === userId) {
      m.folderId = safeReassignId;
      m.updatedAt = new Date().toISOString();
    }
  }

  // Also reassign chunks
  for (const c of db.chunks) {
    if (c.folderId === folderId && c.ownerId === userId) {
      c.folderId = safeReassignId;
    }
  }

  // Delete folder record
  db.folders = db.folders.filter((f) => f.id !== folderId);
  saveDbToDisk();
  return true;
}

// ----------------- MATERIAL / DOCUMENT HELPERS -----------------
export function getMaterials(
  userId: string,
  courseId: string,
  folderId?: string | null | 'all'
): Material[] {
  initDb();
  const course = getCourse(userId, courseId);
  if (!course) return [];

  let list = db.materials.filter((m) => m.courseId === courseId && m.ownerId === userId);
  if (folderId !== undefined && folderId !== 'all') {
    list = list.filter((m) => m.folderId === folderId);
  }
  return list;
}

export function getMaterial(userId: string, materialId: string): Material | null {
  initDb();
  const mat = db.materials.find((m) => m.id === materialId);
  if (!mat || mat.ownerId !== userId) return null;
  return mat;
}

export function addMaterial(material: Material): Material {
  initDb();
  db.materials.push(material);
  saveDbToDisk();
  return material;
}

export function updateMaterial(
  userId: string,
  materialId: string,
  data: Partial<Material>
): Material | null {
  initDb();
  const index = db.materials.findIndex((m) => m.id === materialId && m.ownerId === userId);
  if (index === -1) return null;

  db.materials[index] = {
    ...db.materials[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveDbToDisk();
  return db.materials[index];
}

/**
 * Move document to a different folder (or root course level)
 * Updates both the material record and all related chunk records.
 */
export function moveMaterial(
  userId: string,
  materialId: string,
  targetFolderId: string | null
): Material | null {
  initDb();
  const mat = db.materials.find((m) => m.id === materialId && m.ownerId === userId);
  if (!mat) return null;

  if (targetFolderId !== null) {
    const targetFolder = db.folders.find(
      (f) => f.id === targetFolderId && f.courseId === mat.courseId && f.ownerId === userId
    );
    if (!targetFolder) {
      throw new Error('Target folder not found in this course or not owned by user.');
    }
  }

  mat.folderId = targetFolderId;
  mat.updatedAt = new Date().toISOString();

  // Update chunks
  for (const c of db.chunks) {
    if (c.documentId === materialId && c.ownerId === userId) {
      c.folderId = targetFolderId;
    }
  }

  saveDbToDisk();
  return mat;
}

export function deleteMaterial(userId: string, materialId: string): boolean {
  initDb();
  const index = db.materials.findIndex((m) => m.id === materialId && m.ownerId === userId);
  if (index === -1) return false;

  db.materials.splice(index, 1);
  db.chunks = db.chunks.filter((c) => c.documentId !== materialId || c.ownerId !== userId);
  saveDbToDisk();
  return true;
}

// ----------------- CHUNKS & VECTOR RETRIEVAL RECORDS -----------------
export function addChunks(chunks: DocumentChunk[]) {
  initDb();
  db.chunks.push(...chunks);
  saveDbToDisk();
}

export function updateChunkEmbedding(chunkId: string, embedding: number[]) {
  initDb();
  const c = db.chunks.find((chunk) => chunk.chunkId === chunkId);
  if (c) {
    c.embedding = embedding;
  }
}

export function saveChunksAndSync(chunks: DocumentChunk[]) {
  initDb();
  // Upsert or replace by chunkId
  const chunkMap = new Map<string, DocumentChunk>();
  for (const c of db.chunks) chunkMap.set(c.chunkId, c);
  for (const c of chunks) chunkMap.set(c.chunkId, c);
  db.chunks = Array.from(chunkMap.values());
  saveDbToDisk();
}

export interface ChunkFilter {
  userId: string;
  courseId: string;
  folderId?: string | null | 'all' | string[];
  documentId?: string;
}

export function getFilteredChunks(filter: ChunkFilter): DocumentChunk[] {
  initDb();
  return db.chunks.filter((c) => {
    // 1. Strict user/owner isolation
    if (c.ownerId !== filter.userId) return false;

    // 2. Strict course isolation
    if (c.courseId !== filter.courseId) return false;

    // 3. Document filter
    if (filter.documentId && c.documentId !== filter.documentId) return false;

    // 4. Folder isolation
    if (filter.folderId === undefined || filter.folderId === 'all') {
      return true; // all folders in this course
    }
    if (Array.isArray(filter.folderId)) {
      return filter.folderId.includes(c.folderId as string);
    }
    return c.folderId === filter.folderId;
  });
}

// ----------------- TUTOR MESSAGES -----------------
export function getTutorMessages(userId: string, courseId: string, folderId?: string | null) {
  initDb();
  return db.tutorMessages.filter((t) => {
    if (t.ownerId !== userId || t.courseId !== courseId) return false;
    if (folderId !== undefined) return t.folderId === folderId;
    return true;
  });
}

export function addTutorMessage(
  msg: TutorMessage & { courseId: string; folderId: string | null; ownerId: string }
) {
  initDb();
  db.tutorMessages.push(msg);
  saveDbToDisk();
}

export function clearTutorMessages(userId: string, courseId: string, folderId?: string | null) {
  initDb();
  db.tutorMessages = db.tutorMessages.filter((t) => {
    if (t.ownerId !== userId || t.courseId !== courseId) return true;
    if (folderId !== undefined) return t.folderId !== folderId;
    return false;
  });
  saveDbToDisk();
}

// ----------------- PROGRESS -----------------
export function getUserProgress(userId: string, courseId: string): UserProgress {
  initDb();
  let p = db.progress.find((item) => item.userId === userId && item.courseId === courseId);
  if (!p) {
    p = {
      userId,
      courseId,
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
      streakDays: 1,
      lastStudiedAt: new Date().toISOString(),
      topicMastery: {},
    };
    db.progress.push(p);
    saveDbToDisk();
  }
  return p;
}

export function recordQuizAnswer(userId: string, courseId: string, isCorrect: boolean, topic?: string): UserProgress {
  initDb();
  const p = getUserProgress(userId, courseId);
  p.totalQuestionsAnswered += 1;
  if (isCorrect) p.correctAnswers += 1;
  p.lastStudiedAt = new Date().toISOString();

  if (topic) {
    const current = p.topicMastery[topic] || 50;
    p.topicMastery[topic] = Math.max(0, Math.min(100, isCorrect ? current + 10 : current - 5));
  }

  saveDbToDisk();
  return p;
}
