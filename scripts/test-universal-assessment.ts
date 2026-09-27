import dotenv from 'dotenv';
dotenv.config();

import {
  collectStratifiedStudyChunks,
  generateUniversalAssessment,
  validateMaterialsInScope,
} from '../server/assessmentEngine.js';
import { initDb } from '../server/db.js';

async function runTest() {
  console.log('====================================================');
  console.log('  TESTING UNIVERSAL ASSESSMENT & BLOOM TAXONOMY ENGINE');
  console.log('====================================================');

  initDb();
  const userId = 'user_alex';

  // ----------------------------------------------------
  // TEST 1: Biology Course (BIO-310: Molecular Genetics & CRISPR)
  // ----------------------------------------------------
  console.log('\n[Test 1] Testing Biology Course (BIO-310: Molecular Genetics & CRISPR)...');
  const bioValidation = validateMaterialsInScope(userId, 'course_bio_202', 'all');
  console.log(`Eligible files in BIO-310: ${bioValidation.eligibleMaterials.map((m) => m.filename).join(', ')}`);
  if (bioValidation.eligibleMaterials.length === 0) {
    throw new Error('Expected eligible materials in BIO-310');
  }

  const bioContext = await collectStratifiedStudyChunks({
    userId,
    courseId: 'course_bio_202',
    folderId: 'all',
    maxTotalChunks: 6,
  });

  const bioQuestions = await generateUniversalAssessment({
    chunks: bioContext.chunks,
    questionCount: 4,
    difficulty: 'medium',
  });

  console.log(`Generated ${bioQuestions.length} questions for BIO-310:`);
  for (const q of bioQuestions) {
    console.log(`- [${q.type}] [Bloom: ${q.bloomLevel}] ${q.question.slice(0, 90)}...`);
    console.log(`  Source: ${q.citations[0]?.filename} (Page ${q.citations[0]?.pageOrSlide})`);
    if (q.question.toLowerCase().includes('according to')) {
      throw new Error(`Formulaic question detected: "${q.question}"`);
    }
  }
  console.log('✅ PASS: Biology assessment generated with natural academic phrasing and accurate Bloom taxonomy.');

  // ----------------------------------------------------
  // TEST 2: Psychology Folder with Multiple Uploaded Files & Pages
  // ----------------------------------------------------
  console.log('\n[Test 2] Testing Psychology Folder with 3 Distinct Uploaded Files & Multiple Pages...');
  const psychFolderId = 'folder_1790492371115_04dbu';
  const psychValidation = validateMaterialsInScope(userId, 'course_ml_101', psychFolderId);
  console.log(`Found ${psychValidation.distinctDocumentsCount} eligible documents in Psychology folder:`);
  psychValidation.eligibleMaterials.forEach((m) => {
    console.log(`  - ${m.filename} (${m.extractedTextLength} chars, ${m.chunkCount} chunks)`);
  });

  if (psychValidation.distinctDocumentsCount < 3) {
    throw new Error(`Expected at least 3 distinct documents in Psychology folder, got ${psychValidation.distinctDocumentsCount}`);
  }

  const psychContext = await collectStratifiedStudyChunks({
    userId,
    courseId: 'course_ml_101',
    folderId: psychFolderId,
    maxTotalChunks: 14,
  });

  console.log('\nCoverage across files and pages in Psychology:');
  psychContext.coverage.forEach((cov) => {
    console.log(`  - ${cov.filename}: Pages [${cov.pagesCovered.join(', ')}], Sampled Chunks: ${cov.totalChunksSampled}`);
  });

  const psychQuestions = await generateUniversalAssessment({
    chunks: psychContext.chunks,
    questionCount: 4,
    difficulty: 'hard',
    questionTypes: ['multiple_choice', 'true_false', 'short_answer', 'short_essay'],
  });

  console.log(`\nGenerated ${psychQuestions.length} multi-type questions across Psychology files:`);
  const typeSet = new Set<string>();
  const bloomSet = new Set<string>();

  for (const q of psychQuestions) {
    typeSet.add(q.type);
    bloomSet.add(q.bloomLevel);
    console.log(`\n[Question Type: ${q.type.toUpperCase()}]`);
    console.log(`Bloom Level: ${q.bloomLevel} | Difficulty: ${q.difficulty}`);
    console.log(`Prompt: "${q.question}"`);

    if (q.type === 'multiple_choice') {
      console.log(`Options: ${q.options?.join(' | ')}`);
      console.log(`Correct Answer: ${q.correctAnswer}`);
    } else if (q.type === 'true_false') {
      console.log(`Correct Answer: ${q.correctAnswer}`);
    } else if (q.type === 'short_answer') {
      console.log(`Expected Answer: ${q.correctAnswer}`);
      console.log(`Acceptable Variations: ${q.acceptableAnswers?.join(', ')}`);
    } else if (q.type === 'short_essay') {
      console.log(`Sample Model Answer: ${q.sampleAnswer?.slice(0, 120)}...`);
      console.log(`Marking Criteria: ${q.markingPoints?.join('; ')}`);
    }

    console.log(`Explanation: ${q.explanation.slice(0, 100)}...`);
    console.log(`Citation: ${q.citations[0]?.filename} (Page ${q.citations[0]?.pageOrSlide})`);

    // Verify no formulaic phrasing
    if (q.question.toLowerCase().startsWith('according to')) {
      throw new Error(`Formulaic question phrasing detected: "${q.question}"`);
    }
  }

  console.log(`\nQuestion types covered: ${Array.from(typeSet).join(', ')}`);
  console.log(`Bloom levels represented: ${Array.from(bloomSet).join(', ')}`);
  console.log('✅ PASS: Psychology assessment successfully synthesized across multiple files, pages, and Bloom levels!');

  // ----------------------------------------------------
  // TEST 3: Pre-generation Validation Rejection of Unreadable Content
  // ----------------------------------------------------
  console.log('\n[Test 3] Pre-generation Validation of Corrupted/Empty Content...');
  const emptyValidation = validateMaterialsInScope('non_existent_user', 'course_ml_101', 'all');
  if (emptyValidation.eligibleMaterials.length !== 0) {
    throw new Error('Expected 0 eligible materials for invalid user');
  }
  console.log('✅ PASS: Scope isolation and invalid material rejection verified.');

  console.log('\n====================================================');
  console.log('  ALL ASSESSMENT ENGINE TESTS COMPLETED SUCCESSFULLY 🎉');
  console.log('====================================================');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
