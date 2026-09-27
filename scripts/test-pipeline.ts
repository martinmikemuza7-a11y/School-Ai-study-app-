import dotenv from 'dotenv';
dotenv.config();

import { answerTutorQuestion, generateEmbedding } from '../server/ai.js';
import {
  createCourse,
  createFolder,
  deleteCourse,
  deleteFolder,
  getCourse,
  getCourses,
  getFilteredChunks,
  getFolder,
  getFolders,
  getMaterial,
  getMaterials,
  initDb,
  moveMaterial,
} from '../server/db.js';
import { processUploadedDocument } from '../server/materialProcessing.js';
import { cosineSimilarity, retrieveRelevantChunks } from '../server/vectorRag.js';

async function runVerification() {
  console.log('====================================================');
  console.log('  STUDY BUDDY AI - ARCHITECTURAL VERIFICATION SUITE ');
  console.log('====================================================');

  initDb();

  const userA = 'user_alex';
  const userB = 'user_taylor';

  // 1. Authorization Isolation Test
  console.log('\n[Test 1] Multi-Tenant Authorization Isolation...');
  const userBCourses = getCourses(userB);
  const attemptedCourseId = userBCourses[0]?.id;
  if (!attemptedCourseId) {
    throw new Error('User B has no test course');
  }
  const breachAttempt = getCourse(userA, attemptedCourseId);
  if (breachAttempt !== null) {
    console.error('❌ Authorization Failed: User A was able to access User B course!');
    process.exit(1);
  }
  console.log('✅ PASS: User A strictly blocked from accessing User B resources.');

  // 2. Folder CRUD & Document Preservation Test
  console.log('\n[Test 2] Folder CRUD & Document Preservation on Folder Lifecycle...');
  const testCourse = createCourse(userA, {
    title: 'Verification Sandbox Course',
    code: 'TEST-101',
    description: 'Automated test suite course',
  });

  const folderAlpha = createFolder(userA, testCourse.id, { name: 'Alpha Folder' });
  const folderBeta = createFolder(userA, testCourse.id, { name: 'Beta Target Folder' });
  if (!folderAlpha || !folderBeta) {
    throw new Error('Failed to create test folders');
  }
  console.log(`Created test folders: "${folderAlpha.name}" and "${folderBeta.name}".`);

  // Ingest document into folderAlpha
  const sampleText = `
Linear algebra forms the backbone of deep learning algorithms. Matrices represent linear transformations in vector spaces.
Eigenvalues lambda and eigenvectors v satisfy the characteristic equation A v = lambda v.
In Principal Component Analysis (PCA), eigenvectors of the covariance matrix correspond to the orthogonal directions of maximal variance in the dataset.
Singular Value Decomposition (SVD) factors any real matrix into U Sigma V^T, enabling low-rank matrix approximations and dimensionality reduction.
  `.trim();

  const doc = await processUploadedDocument({
    userId: userA,
    courseId: testCourse.id,
    folderId: folderAlpha.id,
    filename: 'Linear_Algebra_Notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(sampleText, 'utf8'),
  });

  console.log(`Ingested document "${doc.filename}": status=${doc.status}, chunks=${doc.chunkCount}, hasEmbeddings=${doc.hasEmbeddings}`);

  // Verify document is in folderAlpha
  let docInDb = getMaterial(userA, doc.id);
  if (docInDb?.folderId !== folderAlpha.id) {
    throw new Error('Document folderId mismatch after ingestion');
  }

  // Move document to folderBeta
  moveMaterial(userA, doc.id, folderBeta.id);
  docInDb = getMaterial(userA, doc.id);
  if (docInDb?.folderId !== folderBeta.id) {
    throw new Error('Document move failed');
  }
  const chunksAfterMove = getFilteredChunks({ userId: userA, courseId: testCourse.id, folderId: folderBeta.id });
  if (chunksAfterMove.length === 0) {
    throw new Error('Chunks were not updated to new folderId upon move');
  }
  console.log('✅ PASS: Document and its search index successfully moved between folders.');

  // Delete folderBeta with preservation
  deleteFolder(userA, folderBeta.id, null); // reassign to root
  docInDb = getMaterial(userA, doc.id);
  if (docInDb?.folderId !== null) {
    throw new Error('Document was not safely preserved (reassigned) upon folder deletion');
  }
  console.log('✅ PASS: Document was preserved when parent folder was deleted.');

  // 3. Vector Similarity & Embedding Creation
  console.log('\n[Test 3] Vector Embeddings & Cosine Similarity...');
  const v1 = [0.8, 0.6, 0.0];
  const v2 = [0.8, 0.6, 0.0];
  const v3 = [0.0, 0.0, 1.0];
  const simIdentical = cosineSimilarity(v1, v2);
  const simOrthogonal = cosineSimilarity(v1, v3);
  if (Math.abs(simIdentical - 1.0) > 0.001 || Math.abs(simOrthogonal - 0.0) > 0.001) {
    throw new Error('Cosine similarity calculation error');
  }
  console.log(`✅ PASS: Cosine similarity verified (simIdentical=${simIdentical.toFixed(2)}, simOrthogonal=${simOrthogonal.toFixed(2)}).`);

  // 4. Folder Scope Isolation in RAG Retrieval
  console.log('\n[Test 4] Course & Folder Scope Isolation in Retrieval...');
  // Ingest another document in folderAlpha
  const bioText = 'CRISPR Cas9 endonuclease uses sgRNA to recognize target DNA alongside PAM motif.';
  await processUploadedDocument({
    userId: userA,
    courseId: testCourse.id,
    folderId: folderAlpha.id,
    filename: 'CRISPR_Test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(bioText, 'utf8'),
  });

  // Query folderAlpha specifically for linear algebra - should NOT return linear algebra because it was moved out!
  const retrievalAlpha = await retrieveRelevantChunks({
    query: 'Principal Component Analysis and eigenvectors',
    filter: {
      userId: userA,
      courseId: testCourse.id,
      folderId: folderAlpha.id,
    },
    forceLexical: true,
  });

  const containsLinAlg = retrievalAlpha.results.some((r) => r.chunk.filename.includes('Linear_Algebra'));
  if (containsLinAlg) {
    throw new Error('Cross-folder leak: Folder Alpha returned chunks from another folder!');
  }
  console.log('✅ PASS: Strict folder isolation verified. No cross-folder chunk contamination.');

  // 5. Complete RAG Tutor Generation with Grounded Citations
  console.log('\n[Test 5] Complete RAG Tutor Grounding & Citation Integrity...');
  const retrievalRoot = await retrieveRelevantChunks({
    query: 'What is Singular Value Decomposition (SVD)?',
    filter: {
      userId: userA,
      courseId: testCourse.id,
      folderId: null, // root where Linear_Algebra was preserved
    },
    topK: 2,
    forceLexical: true,
  });

  if (retrievalRoot.results.length === 0) {
    throw new Error('Failed to retrieve preserved document chunks');
  }

  const tutorAnswer = await answerTutorQuestion(
    'What does SVD factor a matrix into?',
    retrievalRoot.results,
    'direct'
  );

  console.log('Tutor Model Used:', tutorAnswer.modelUsed);
  console.log('Citations Count:', tutorAnswer.citations.length);
  console.log('Sample Citation:', {
    filename: tutorAnswer.citations[0]?.filename,
    pageOrSlide: tutorAnswer.citations[0]?.pageOrSlide,
    chunkId: tutorAnswer.citations[0]?.chunkId,
    excerpt: tutorAnswer.citations[0]?.sourceExcerpt?.slice(0, 70),
  });

  if (tutorAnswer.citations.length === 0 || !tutorAnswer.citations[0].documentId) {
    throw new Error('Citations missing or incomplete');
  }
  console.log('✅ PASS: Gemini grounded response generated with verified citations.');

  // Cleanup test course
  deleteCourse(userA, testCourse.id);
  console.log('\n====================================================');
  console.log('  ALL ARCHITECTURAL VERIFICATION TESTS PASSED 🎉   ');
  console.log('====================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
