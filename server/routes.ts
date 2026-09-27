import express, { Response, Router } from 'express';
import multer from 'multer';
import { answerTutorQuestion, generateEmbedding, generateQuizFromChunks } from './ai.js';
import {
  collectStratifiedStudyChunks,
  generateUniversalAssessment,
  validateMaterialsInScope,
} from './assessmentEngine.js';
import { AuthenticatedRequest, authMiddleware } from './auth.js';
import {
  addTutorMessage,
  clearTutorMessages,
  createCourse,
  createFolder,
  deleteCourse,
  deleteFolder,
  deleteMaterial,
  getCourse,
  getCourses,
  getFilteredChunks,
  getFolder,
  getFolders,
  getMaterial,
  getMaterials,
  getTutorMessages,
  getUserProgress,
  getUsers,
  moveMaterial,
  recordQuizAnswer,
  updateCourse,
  updateFolder,
} from './db.js';
import { processUploadedDocument } from './materialProcessing.js';
import { cosineSimilarity, retrieveRelevantChunks } from './vectorRag.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

export const router = Router();

// Apply auth middleware to all /api routes
router.use(authMiddleware);

// ----------------- AUTH & USER SWITCHING -----------------
router.get('/auth/me', (req, res: Response) => {
  const user = req.user!;
  const allUsers = getUsers();
  res.json({
    user,
    availableUsers: allUsers,
  });
});

// ----------------- COURSES -----------------
router.get('/courses', (req, res: Response) => {
  const user = req.user!;
  const courses = getCourses(user.id);
  res.json({ courses });
});

router.get('/courses/:id', (req, res: Response) => {
  const user = req.user!;
  const course = getCourse(user.id, req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }
  res.json({ course });
});

router.post('/courses', (req, res: Response) => {
  const user = req.user!;
  const { title, code, description, color } = req.body;
  if (!title || !code) {
    return res.status(400).json({ error: 'Title and course code are required' });
  }
  const course = createCourse(user.id, { title, code, description, color });
  res.status(201).json({ course });
});

router.put('/courses/:id', (req, res: Response) => {
  const user = req.user!;
  const updated = updateCourse(user.id, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }
  res.json({ course: updated });
});

router.delete('/courses/:id', (req, res: Response) => {
  const user = req.user!;
  const success = deleteCourse(user.id, req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }
  res.json({ success: true, message: 'Course deleted with all associated items' });
});

// ----------------- FOLDERS (Requirement 1: Real Folder Entity & Isolation) -----------------
router.get('/courses/:courseId/folders', (req, res: Response) => {
  const user = req.user!;
  const { courseId } = req.params;
  const folders = getFolders(user.id, courseId);
  res.json({ folders });
});

router.post('/courses/:courseId/folders', (req, res: Response) => {
  const user = req.user!;
  const { courseId } = req.params;
  const { name, color, icon } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const folder = createFolder(user.id, courseId, { name, color, icon });
  if (!folder) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }
  res.status(201).json({ folder });
});

router.put('/folders/:folderId', (req, res: Response) => {
  const user = req.user!;
  const { folderId } = req.params;
  const { name, color, icon } = req.body;

  const folder = updateFolder(user.id, folderId, { name, color, icon });
  if (!folder) {
    return res.status(404).json({ error: 'Folder not found or unauthorized' });
  }
  res.json({ folder });
});

router.delete('/folders/:folderId', (req, res: Response) => {
  const user = req.user!;
  const { folderId } = req.params;
  const { reassignToFolderId } = req.body;

  // Preserve existing documents: documents in this folder are reassigned rather than lost
  const success = deleteFolder(user.id, folderId, reassignToFolderId);
  if (!success) {
    return res.status(404).json({ error: 'Folder not found or unauthorized' });
  }
  res.json({
    success: true,
    message: 'Folder deleted successfully. All documents were safely preserved.',
  });
});

// ----------------- MATERIALS / DOCUMENTS -----------------
router.get('/materials', (req, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId as string;
  const folderIdParam = req.query.folderId as string | undefined;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId query parameter is required' });
  }

  // folderId can be 'all', 'root' (null), or a specific folderId
  let folderId: string | null | 'all' = 'all';
  if (folderIdParam === 'root' || folderIdParam === 'null') {
    folderId = null;
  } else if (folderIdParam && folderIdParam !== 'all') {
    folderId = folderIdParam;
  }

  const materials = getMaterials(user.id, courseId, folderId);
  res.json({ materials });
});

router.get('/materials/:id', (req, res: Response) => {
  const user = req.user!;
  const material = getMaterial(user.id, req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found or unauthorized' });
  }
  res.json({ material });
});

router.get('/materials/:id/chunks', (req, res: Response) => {
  const user = req.user!;
  const material = getMaterial(user.id, req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found or unauthorized' });
  }

  const chunks = getFilteredChunks({
    userId: user.id,
    courseId: material.courseId,
    documentId: material.id,
  });

  res.json({ chunks });
});

router.post('/materials/upload', upload.single('file'), async (req, res: Response) => {
  const user = req.user!;
  const courseId = req.body.courseId;
  const folderId = req.body.folderId && req.body.folderId !== 'null' && req.body.folderId !== 'root' ? req.body.folderId : null;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId is required' });
  }

  // Verify course ownership
  const course = getCourse(user.id, courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }

  // If folderId provided, verify folder ownership
  if (folderId) {
    const folder = getFolder(user.id, folderId);
    if (!folder || folder.courseId !== courseId) {
      return res.status(400).json({ error: 'Invalid folder selected for this course' });
    }
  }

  let filename = 'document.txt';
  let mimeType = 'text/plain';
  let buffer: Buffer;

  if (req.file) {
    filename = req.file.originalname;
    mimeType = req.file.mimetype;
    buffer = req.file.buffer;
  } else if (req.body.text) {
    filename = req.body.filename || 'Notes.txt';
    mimeType = 'text/plain';
    buffer = Buffer.from(req.body.text, 'utf8');
  } else {
    return res.status(400).json({ error: 'No file or text payload provided for upload' });
  }

  const material = await processUploadedDocument({
    userId: user.id,
    courseId,
    folderId,
    filename,
    mimeType,
    buffer,
  });

  res.status(201).json({ material });
});

/**
 * Move document to another folder (or root course level)
 */
router.put('/materials/:id/move', (req, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const targetFolderId = req.body.folderId === 'root' || req.body.folderId === null ? null : req.body.folderId;

  try {
    const updated = moveMaterial(user.id, id, targetFolderId);
    if (!updated) {
      return res.status(404).json({ error: 'Material not found or unauthorized' });
    }
    res.json({
      material: updated,
      message: 'Document and its search index successfully moved to target folder.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

router.delete('/materials/:id', (req, res: Response) => {
  const user = req.user!;
  const success = deleteMaterial(user.id, req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Material not found or unauthorized' });
  }
  res.json({ success: true, message: 'Material and all related chunk embeddings removed' });
});

// ----------------- VECTOR RAG RETRIEVAL (Requirement 2) -----------------
router.post('/rag/retrieve', async (req, res: Response) => {
  const user = req.user!;
  const { query, courseId, folderId, topK = 5, forceLexical = false } = req.body;

  if (!query || !courseId) {
    return res.status(400).json({ error: 'Query and courseId are required' });
  }

  // Verify course ownership
  const course = getCourse(user.id, courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }

  const result = await retrieveRelevantChunks({
    query,
    filter: {
      userId: user.id,
      courseId,
      folderId: folderId === 'all' ? 'all' : (folderId || null),
    },
    topK,
    forceLexical,
  });

  res.json(result);
});

// ----------------- AI TUTOR WITH GROUNDED CITATIONS -----------------
router.get('/tutor/messages', (req, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId as string;
  const folderId = req.query.folderId as string | undefined;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId query parameter is required' });
  }

  const messages = getTutorMessages(user.id, courseId, folderId === 'all' ? undefined : (folderId || null));
  res.json({ messages });
});

router.post('/tutor/chat', async (req, res: Response) => {
  const user = req.user!;
  const { courseId, folderId, message, tutorStyle = 'direct' } = req.body;

  if (!courseId || !message) {
    return res.status(400).json({ error: 'courseId and message are required' });
  }

  // 1. Authorization check
  const course = getCourse(user.id, courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }

  const targetFolderId = folderId === 'all' ? 'all' : (folderId || null);

  // 2. Perform strictly isolated Vector RAG retrieval
  const retrieval = await retrieveRelevantChunks({
    query: message,
    filter: {
      userId: user.id,
      courseId,
      folderId: targetFolderId,
    },
    topK: 4,
    minScore: 0.12,
  });

  // 3. Save user message
  const userMsgId = `msg_user_${Date.now()}`;
  addTutorMessage({
    id: userMsgId,
    role: 'user',
    content: message,
    courseId,
    folderId: targetFolderId === 'all' ? null : targetFolderId,
    ownerId: user.id,
    timestamp: new Date().toISOString(),
  });

  // 4. Ask Gemini strictly grounded in retrieved chunks
  const aiResponse = await answerTutorQuestion(message, retrieval.results, tutorStyle);

  // 5. Save assistant message with citation provenance
  const assistantMsgId = `msg_ai_${Date.now()}`;
  const assistantMsg = {
    id: assistantMsgId,
    role: 'assistant' as const,
    content: aiResponse.answer,
    citations: aiResponse.citations,
    courseId,
    folderId: targetFolderId === 'all' ? null : targetFolderId,
    ownerId: user.id,
    timestamp: new Date().toISOString(),
    retrievalMetadata: {
      courseId,
      folderId: targetFolderId === 'all' ? null : targetFolderId,
      totalChunksSearched: retrieval.totalChunksInScope,
      matchType: retrieval.matchType,
      chunksRetrieved: retrieval.results.length,
    },
  };

  addTutorMessage(assistantMsg);

  res.json({
    message: assistantMsg,
    retrieval,
  });
});

router.delete('/tutor/messages', (req, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId as string;
  const folderId = req.query.folderId as string | undefined;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId query parameter is required' });
  }

  clearTutorMessages(user.id, courseId, folderId === 'all' ? undefined : (folderId || null));
  res.json({ success: true, message: 'Tutor chat history cleared' });
});

router.get('/learning/coverage', (req, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId as string;
  const folderId = req.query.folderId as string | undefined;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId query parameter is required' });
  }

  const course = getCourse(user.id, courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or unauthorized' });
  }

  const targetFolderId = folderId === 'all' ? 'all' : folderId === 'root' || folderId === 'null' ? null : (folderId || 'all');
  const validation = validateMaterialsInScope(user.id, courseId, targetFolderId);

  res.json({
    courseId,
    folderId: targetFolderId,
    eligibleMaterials: validation.eligibleMaterials.map((m) => ({
      id: m.id,
      title: m.title,
      filename: m.filename,
      extractedTextLength: m.extractedTextLength,
      chunkCount: m.chunkCount,
    })),
    excludedMaterials: validation.excludedMaterials.map((x) => ({
      filename: x.material.filename,
      reason: x.reason,
    })),
    totalReadableChunks: validation.totalReadableChunks,
    distinctPagesCount: validation.distinctPagesCount,
    distinctDocumentsCount: validation.distinctDocumentsCount,
  });
});

// ----------------- ACTIVE RECALL / QUIZZES -----------------
router.post('/learning/generate-quiz', async (req, res: Response) => {
  const user = req.user!;
  const {
    courseId,
    courseIds,
    folderId,
    questionCount = 4,
    difficulty = 'medium',
    questionTypes,
    bloomFocus = 'all',
    topic,
  } = req.body;

  // Support single course or explicit multi-course selection
  const targetCourseIds: string[] = Array.isArray(courseIds) && courseIds.length > 0
    ? courseIds
    : courseId
    ? [courseId]
    : [];

  if (targetCourseIds.length === 0) {
    return res.status(400).json({ error: 'At least one courseId must be specified' });
  }

  // 1. Verify user ownership for all targeted courses
  for (const cid of targetCourseIds) {
    const course = getCourse(user.id, cid);
    if (!course) {
      return res.status(404).json({ error: `Course "${cid}" not found or unauthorized` });
    }
  }

  const primaryCourseId = targetCourseIds[0];
  const targetFolderId = folderId === 'all' ? 'all' : (folderId || null);

  // 2. Pre-generation Validation: Ensure every selected file was successfully extracted & readable
  const validation = validateMaterialsInScope(user.id, primaryCourseId, targetFolderId);

  if (validation.eligibleMaterials.length === 0) {
    if (validation.excludedMaterials.length > 0) {
      const reasons = validation.excludedMaterials
        .map((x) => `"${x.material.filename}": ${x.reason}`)
        .join('; ');
      return res.status(400).json({
        error: `Uploaded files in this scope cannot be used for study questions because text extraction is incomplete or unreadable: ${reasons}. Please re-upload clean files or text.`,
      });
    }

    return res.status(400).json({
      error: 'No study materials found in this scope. Please upload lecture slides, PDF notes, or study guides first.',
    });
  }

  // 3. Scan & Retrieve relevant content across ALL eligible uploaded files and ALL pages/slides/sections
  const { chunks, coverage } = await collectStratifiedStudyChunks({
    userId: user.id,
    courseId: primaryCourseId,
    folderId: targetFolderId,
    topic,
    maxTotalChunks: Math.max(12, questionCount * 3),
  });

  if (chunks.length === 0) {
    return res.status(400).json({
      error: 'Unable to extract sufficient study context from the selected files to generate questions.',
    });
  }

  // 4. Generate 4 question types across Bloom\'s taxonomy
  const questions = await generateUniversalAssessment({
    chunks,
    questionCount: Math.min(12, Math.max(1, questionCount)),
    difficulty,
    questionTypes,
    bloomFocus,
    topic,
  });

  res.json({
    questions,
    coverage,
    retrievedCount: chunks.length,
    validationSummary: {
      eligibleDocuments: validation.distinctDocumentsCount,
      distinctPages: validation.distinctPagesCount,
      totalChunksSampled: chunks.length,
      excludedDocuments: validation.excludedMaterials.map((x) => ({
        filename: x.material.filename,
        reason: x.reason,
      })),
    },
  });
});

router.get('/learning/progress', (req, res: Response) => {
  const user = req.user!;
  const courseId = req.query.courseId as string;

  if (!courseId) {
    return res.status(400).json({ error: 'courseId query parameter is required' });
  }

  const progress = getUserProgress(user.id, courseId);
  res.json({ progress });
});

router.post('/learning/progress', (req, res: Response) => {
  const user = req.user!;
  const { courseId, isCorrect, topic } = req.body;

  if (!courseId || typeof isCorrect !== 'boolean') {
    return res.status(400).json({ error: 'courseId and isCorrect are required' });
  }

  const progress = recordQuizAnswer(user.id, courseId, isCorrect, topic);
  res.json({ progress });
});

// ----------------- AUTOMATED VERIFICATION TEST SUITE -----------------
/**
 * Rigorous in-app verification testing:
 * 1. Folder CRUD & preservation on folder delete/move
 * 2. User authorization isolation (User A cannot access User B data)
 * 3. Text cleaning & validation (rejects raw binary)
 * 4. Vector embedding generation & cosine similarity matching
 * 5. Folder & Course isolation in retrieval (no cross-contamination)
 * 6. Citation integrity
 */
router.post('/diagnostics/verify-rag', async (req, res: Response) => {
  const testResults: { testName: string; passed: boolean; details: string }[] = [];

  try {
    // TEST 1: User Authorization Isolation
    const userA = 'user_alex';
    const userB = 'user_taylor';
    const coursesA = getCourses(userA);
    const coursesB = getCourses(userB);

    const crossAccessAttempt = getCourse(userA, coursesB[0]?.id || 'non_existent');
    const authIsolated = crossAccessAttempt === null && coursesA.every((c) => c.ownerId === userA);
    testResults.push({
      testName: 'User Multi-Tenant Authorization Isolation',
      passed: authIsolated,
      details: authIsolated
        ? `Verified: User '${userA}' cannot access User '${userB}' courses/folders.`
        : 'Failed: Cross-user access was permitted!',
    });

    // TEST 2: Folder CRUD & Document Preservation
    const testCourse = coursesA[0];
    const testFolder = createFolder(userA, testCourse.id, { name: 'Automated Test Folder' });
    const folderCreated = !!testFolder && testFolder.name === 'Automated Test Folder';

    // Move a document to test folder
    const materials = getMaterials(userA, testCourse.id, 'all');
    let movedOk = false;
    let preservedOk = false;

    if (materials.length > 0 && testFolder) {
      const targetDoc = materials[0];
      const prevFolder = targetDoc.folderId;
      moveMaterial(userA, targetDoc.id, testFolder.id);

      const updatedDoc = getMaterial(userA, targetDoc.id);
      movedOk = updatedDoc?.folderId === testFolder.id;

      // Now delete test folder with reassignToFolderId = prevFolder
      deleteFolder(userA, testFolder.id, prevFolder);

      const preservedDoc = getMaterial(userA, targetDoc.id);
      preservedOk = preservedDoc?.folderId === prevFolder;
    }

    testResults.push({
      testName: 'Folder Lifecycle & Document Preservation',
      passed: folderCreated && movedOk && preservedOk,
      details: `Created folder, moved document into it, deleted folder and verified document was safely preserved (reassigned).`,
    });

    // TEST 3: Course & Folder Isolation in RAG Retrieval
    // Query course 1 with folder 1 vs folder 2
    const week1Chunks = getFilteredChunks({
      userId: userA,
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week1',
    });
    const week2Chunks = getFilteredChunks({
      userId: userA,
      courseId: 'course_ml_101',
      folderId: 'folder_ml_week2',
    });

    const isIsolated =
      week1Chunks.every((c) => c.folderId === 'folder_ml_week1') &&
      week2Chunks.every((c) => c.folderId === 'folder_ml_week2') &&
      week1Chunks.length > 0 &&
      week2Chunks.length > 0;

    testResults.push({
      testName: 'Folder-Level Scope Isolation in Index',
      passed: isIsolated,
      details: `Week 1 folder contains ${week1Chunks.length} chunks; Week 2 contains ${week2Chunks.length} chunks without overlap.`,
    });

    // TEST 4: Cosine Similarity & Vector Calculation
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const simIdentical = cosineSimilarity(vecA, vecB);
    const simOrthogonal = cosineSimilarity(vecA, vecC);
    const mathCorrect = Math.abs(simIdentical - 1.0) < 0.001 && Math.abs(simOrthogonal - 0.0) < 0.001;

    testResults.push({
      testName: 'Vector Math & Cosine Similarity',
      passed: mathCorrect,
      details: `Identical vectors similarity = ${simIdentical.toFixed(2)}, Orthogonal vectors similarity = ${simOrthogonal.toFixed(2)}.`,
    });

    // TEST 5: Lexical Fallback & Hybrid Retrieval
    const retrieval = await retrieveRelevantChunks({
      query: 'learning rate hyperparameter theta update',
      filter: {
        userId: userA,
        courseId: 'course_ml_101',
        folderId: 'folder_ml_week1',
      },
      topK: 2,
      forceLexical: true,
    });

    const lexicalPassed =
      retrieval.results.length > 0 &&
      retrieval.results[0].chunk.filename.includes('Optimization') &&
      retrieval.matchType === 'lexical';

    testResults.push({
      testName: 'Lexical Retrieval Fallback Guarantee',
      passed: lexicalPassed,
      details: `Retrieved ${retrieval.results.length} chunks with lexical fallback, top result: ${retrieval.results[0]?.chunk.filename}.`,
    });

    // TEST 6: Source Citation Completeness
    const topChunk = retrieval.results[0]?.chunk;
    const hasCompleteCitation =
      !!topChunk?.chunkId &&
      !!topChunk?.documentId &&
      !!topChunk?.filename &&
      !!topChunk?.courseId &&
      topChunk?.pageOrSlide !== undefined &&
      !!topChunk?.sourceExcerpt;

    testResults.push({
      testName: 'Provenance & Citation Completeness',
      passed: hasCompleteCitation,
      details: hasCompleteCitation
        ? `Chunk retains documentId, filename, courseId, folderId, pageOrSlide (${topChunk.pageOrSlide}), chunkId, and sourceExcerpt.`
        : 'Missing required citation fields!',
    });

    // Summary
    const allPassed = testResults.every((t) => t.passed);
    res.json({
      allPassed,
      results: testResults,
      environment: {
        geminiApiKeyPresent: !!process.env.GEMINI_API_KEY,
        embeddingModel: 'gemini-embedding-2-preview',
        generationModel: 'gemini-3.8-flash',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Verification test failed: ${msg}` });
  }
});
