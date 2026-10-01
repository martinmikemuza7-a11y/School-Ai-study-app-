import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { createWorker } from 'tesseract.js';
import { validateAndCleanText } from './textQuality.js';
import { PastPaper, PastPaperQuestionStructure, QuestionType } from './types.js';

export interface ProcessPastPaperOptions {
  id: string;
  courseId: string;
  folderId: string | null;
  ownerId: string;
  title: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Extracts questions, sections, marks and options from past exam paper text
 */
export function extractExamStructure(rawText: string): {
  year?: string;
  examTerm?: string;
  institution?: string;
  questions: PastPaperQuestionStructure[];
} {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let year: string | undefined;
  let examTerm: string | undefined;
  let institution: string | undefined;

  // Search first 20 lines for exam header details
  const headerBlock = lines.slice(0, 25).join(' ');
  const yearMatch = headerBlock.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) year = yearMatch[1];

  if (/residential/i.test(headerBlock)) examTerm = 'Residential Test';
  else if (/promotion/i.test(headerBlock)) examTerm = 'Promotion Examination';
  else if (/supplementary/i.test(headerBlock)) examTerm = 'Supplementary Test';
  else if (/makeup/i.test(headerBlock)) examTerm = 'Makeup Test';
  else if (/test\s*[1234]/i.test(headerBlock)) {
    const t = headerBlock.match(/test\s*[1234]/i);
    examTerm = t ? t[0] : 'Term Test';
  }

  if (/university of zambia/i.test(headerBlock)) {
    institution = 'The University of Zambia';
  } else if (/david livingstone/i.test(headerBlock)) {
    institution = 'David Livingstone College of Education';
  }

  const questions: PastPaperQuestionStructure[] = [];
  let currentSection = 'SECTION A';

  // Regexes for question detection
  const sectionRegex = /^(?:SECTION|PART)\s+([A-Z0-9]+)[:\s-]*(.*)$/i;
  const qNumRegex = /^(?:(\d{1,3})[\.\)]|Q(?:uestion)?\s*(\d{1,3})[:\.\)])\s*(.+)$/i;
  const markRegex = /(?:\[|\()(\d{1,2})\s*(?:marks?|pts?|points?)(?:\]|\))/i;
  const optionRegex = /^[A-Ea-e][\.\)]\s*(.+)$/;

  let currentQ: Partial<PastPaperQuestionStructure> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Section
    const secMatch = line.match(sectionRegex);
    if (secMatch) {
      if (currentQ && currentQ.prompt) {
        questions.push(finalizeQuestion(currentQ, currentSection));
        currentQ = null;
      }
      currentSection = `Section ${secMatch[1]}`;
      continue;
    }

    // Check for Question start
    const qMatch = line.match(qNumRegex);
    if (qMatch) {
      if (currentQ && currentQ.prompt) {
        questions.push(finalizeQuestion(currentQ, currentSection));
      }

      const qNum = qMatch[1] || qMatch[2];
      const rest = qMatch[3].trim();
      const markMatch = rest.match(markRegex);
      const allocatedMarks = markMatch ? parseInt(markMatch[1], 10) : undefined;
      const promptClean = rest.replace(markRegex, '').trim();

      currentQ = {
        questionNumber: qNum,
        section: currentSection,
        prompt: promptClean,
        options: [],
        allocatedMarks: allocatedMarks || (currentSection.includes('A') ? 1 : 2),
      };
      continue;
    }

    // Check for options if we have an active question
    if (currentQ) {
      const optMatch = line.match(optionRegex);
      if (optMatch) {
        currentQ.options = currentQ.options || [];
        currentQ.options.push(line);
        continue;
      }

      const inlineMarks = line.match(markRegex);
      if (inlineMarks && !currentQ.allocatedMarks) {
        currentQ.allocatedMarks = parseInt(inlineMarks[1], 10);
      }

      // Append continuing prompt lines (if not starting a new section or line)
      if (currentQ.options && currentQ.options.length === 0 && line.length > 2) {
        currentQ.prompt = `${currentQ.prompt} ${line}`.trim();
      }
    }
  }

  if (currentQ && currentQ.prompt) {
    questions.push(finalizeQuestion(currentQ, currentSection));
  }

  return {
    year,
    examTerm,
    institution,
    questions,
  };
}

function finalizeQuestion(
  q: Partial<PastPaperQuestionStructure>,
  section: string
): PastPaperQuestionStructure {
  let type: QuestionType = 'short_answer';

  if (q.options && q.options.length >= 2) {
    if (
      q.options.length === 2 &&
      q.options.some((o) => /true/i.test(o)) &&
      q.options.some((o) => /false/i.test(o))
    ) {
      type = 'true_false';
    } else {
      type = 'multiple_choice';
    }
  } else if (
    q.prompt &&
    (/_{3,}/.test(q.prompt) || /fill in the blank/i.test(q.prompt) || /\.{4,}/.test(q.prompt))
  ) {
    type = 'fill_in_blank';
  } else if (
    (q.allocatedMarks && q.allocatedMarks >= 5) ||
    /discuss|explain in detail|critically evaluate|essay/i.test(q.prompt || '')
  ) {
    type = 'short_essay';
  }

  return {
    questionNumber: q.questionNumber || '1',
    section: q.section || section,
    type,
    prompt: q.prompt || 'Exam Question',
    options: q.options && q.options.length > 0 ? q.options : undefined,
    allocatedMarks: q.allocatedMarks || (type === 'short_essay' ? 10 : 2),
  };
}

/**
 * Perform OCR on an image file (PNG, JPG, JPEG)
 */
async function performImageOCR(filePath: string): Promise<string> {
  let worker;
  try {
    worker = await createWorker('eng');
    const ret = await worker.recognize(filePath);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
    console.error('[OCR] Error running Tesseract OCR on past paper:', err);
    throw new Error('Image OCR processing failed');
  }
}

/**
 * Process uploaded past exam paper file
 */
export async function processPastPaperFile(options: ProcessPastPaperOptions): Promise<PastPaper> {
  const { filePath, mimeType, sizeBytes, originalFilename, title, courseId, folderId, ownerId, id } =
    options;

  let extractedText = '';
  let pageCount = 1;

  try {
    if (mimeType === 'application/pdf' || originalFilename.toLowerCase().endsWith('.pdf')) {
      const buffer = fs.readFileSync(filePath);
      const pdfData = await extractText(new Uint8Array(buffer));
      if (Array.isArray(pdfData.text)) {
        extractedText = pdfData.text.join('\n\n--- PAGE BREAK ---\n\n');
        pageCount = pdfData.text.length;
      } else if (typeof pdfData.text === 'string') {
        extractedText = pdfData.text;
        pageCount = Math.max(1, Math.round(extractedText.length / 2000));
      }
    } else if (
      mimeType.includes('word') ||
      originalFilename.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value || '';
      pageCount = Math.max(1, Math.round(extractedText.length / 2500));
    } else if (
      mimeType.startsWith('image/') ||
      /\.(jpe?g|png|webp)$/i.test(originalFilename)
    ) {
      // Scanned paper OCR
      extractedText = await performImageOCR(filePath);
      pageCount = 1;
    } else {
      // Plain text or markdown
      extractedText = fs.readFileSync(filePath, 'utf8');
      pageCount = Math.max(1, Math.round(extractedText.length / 2000));
    }
  } catch (extractErr) {
    console.error(`[PastPaper] Failed to extract text from ${originalFilename}:`, extractErr);
    return {
      id,
      courseId,
      folderId,
      ownerId,
      title: title || originalFilename,
      filename: originalFilename,
      mimeType,
      sizeBytes,
      pageCount: 0,
      extractedTextLength: 0,
      extractedQuestions: [],
      status: 'error',
      statusMessage: `Failed to extract exam content: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const cleaned = validateAndCleanText(extractedText);
  const examStructure = extractExamStructure(cleaned.cleanText);

  return {
    id,
    courseId,
    folderId,
    ownerId,
    title: title || originalFilename.replace(/\.[^/.]+$/, ''),
    filename: originalFilename,
    mimeType,
    sizeBytes,
    year: examStructure.year,
    examTerm: examStructure.examTerm,
    institution: examStructure.institution,
    pageCount: Math.max(1, pageCount),
    extractedTextLength: cleaned.charCount,
    extractedQuestions: examStructure.questions,
    status: 'ready',
    statusMessage: `Parsed ${examStructure.questions.length} questions across ${pageCount} page(s)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
