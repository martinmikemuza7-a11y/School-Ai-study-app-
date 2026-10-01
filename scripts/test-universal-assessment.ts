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
  console.log('  TESTING DOCUMENT-FIRST PAST-PAPER QUESTION AGENT');
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

  const bioResult = await generateUniversalAssessment({
    userId,
    courseId: 'course_bio_202',
    folderId: 'all',
    questionCount: 4,
    difficulty: 'medium',
  });

  const bioQuestions = bioResult.questions;
  console.log(`Generated ${bioQuestions.length} questions for BIO-310:`);
  for (const q of bioQuestions) {
    console.log(`- [${q.type}] ${q.question.slice(0, 95)}...`);
    console.log(`  Source: ${q.citations[0]?.filename} (Page ${q.citations[0]?.pageOrSlide})`);
    
    // Verify Bloom's Taxonomy is completely absent
    if ('bloomLevel' in q && (q as any).bloomLevel !== undefined) {
      throw new Error(`Bloom's Taxonomy field 'bloomLevel' found in question: ${JSON.stringify(q)}`);
    }

    if (q.question.toLowerCase().includes('according to cas9')) {
      throw new Error(`Formulaic question detected: "${q.question}"`);
    }

    if (q.question.toLowerCase().includes('which statement accurately characterizes')) {
      throw new Error(`Banned AI phrasing detected: "${q.question}"`);
    }
  }
  console.log('✅ PASS: Biology assessment generated with past-paper phrasing and NO Bloom taxonomy.');

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

  const psychContext = collectStratifiedStudyChunks({
    userId,
    courseId: 'course_ml_101',
    folderId: psychFolderId,
    targetChunkCount: 14,
  });

  console.log('\nCoverage across files and pages in Psychology:');
  psychContext.coverage.forEach((cov) => {
    console.log(`  - ${cov.filename}: Pages [${cov.pagesCovered.join(', ')}], Sampled Chunks: ${cov.totalChunksSampled}`);
  });

  const psychResult = await generateUniversalAssessment({
    userId,
    courseId: 'course_ml_101',
    folderId: psychFolderId,
    questionCount: 5,
    difficulty: 'hard',
    questionTypes: ['multiple_choice', 'true_false', 'fill_in_blank', 'short_answer', 'short_essay'],
  });

  const psychQuestions = psychResult.questions;
  console.log(`\nGenerated ${psychQuestions.length} multi-type past-paper questions across Psychology files:`);
  const typeSet = new Set<string>();

  for (const q of psychQuestions) {
    typeSet.add(q.type);
    
    // Strict assertion: No Bloom's Taxonomy field anywhere
    if ('bloomLevel' in q && (q as any).bloomLevel !== undefined) {
      throw new Error(`Bloom's Taxonomy detected in question: ${JSON.stringify(q)}`);
    }

    console.log(`\n[Question Type: ${q.type.toUpperCase()}]`);
    console.log(`Style: ${q.questionStyle || 'Examination Item'} | Marks: ${q.allocatedMarks || 1}`);
    console.log(`Prompt: "${q.question}"`);

    if (q.type === 'multiple_choice') {
      console.log(`Options: ${q.options?.join(' | ')}`);
      console.log(`Correct Answer: ${q.correctAnswer}`);
    } else if (q.type === 'true_false') {
      console.log(`Options: True / False`);
      console.log(`Correct Answer: ${q.correctAnswer}`);
    } else if (q.type === 'fill_in_blank') {
      console.log(`Missing Term: ${q.correctAnswer}`);
      console.log(`Acceptable variations: ${q.acceptableAnswers?.join(', ')}`);
    } else if (q.type === 'short_answer') {
      console.log(`Expected Key Term / Model Answer: ${q.correctAnswer}`);
    } else if (q.type === 'short_essay') {
      console.log(`Marking Points Checklist:`);
      q.markingPoints?.forEach((pt, idx) => console.log(`  [${idx + 1}] ${pt}`));
      console.log(`Sample Exemplar Answer:\n  "${q.sampleAnswer}"`);
    }

    console.log(`Citation: Document "${q.citations[0]?.filename}", Page ${q.citations[0]?.pageOrSlide}`);
    console.log(`Excerpt: "${q.citations[0]?.sourceExcerpt.slice(0, 80)}..."`);
  }

  console.log('\n====================================================');
  console.log(`  VERIFICATION RESULTS:`);
  console.log(`  - Distinct Question Types Generated: ${Array.from(typeSet).join(', ')}`);
  console.log(`  - Bloom's Taxonomy Completely Removed: Verified (0 Bloom fields)`);
  console.log(`  - Total Chunks Stratified: ${psychResult.retrievedCount}`);
  console.log('====================================================');

  console.log('🎉 ALL DOCUMENT-FIRST PAST-PAPER TESTS PASSED!');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
