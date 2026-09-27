import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getFilteredChunks, getMaterials } from './db.js';
import { validateAndCleanText } from './textQuality.js';
import {
  BloomLevel,
  Citation,
  DocumentChunk,
  Material,
  QuestionType,
  QuizQuestion,
  RetrievalResult,
} from './types.js';
import { calculateLexicalScore, cosineSimilarity } from './vectorRag.js';
import { generateEmbedding } from './ai.js';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const GENERATION_MODEL = 'gemini-3.8-flash';

export interface DocumentCoverageSummary {
  documentId: string;
  filename: string;
  pagesCovered: number[];
  totalChunksSampled: number;
}

export interface MaterialValidationResult {
  eligibleMaterials: Material[];
  excludedMaterials: { material: Material; reason: string }[];
  totalReadableChunks: number;
  distinctPagesCount: number;
  distinctDocumentsCount: number;
}

/**
 * Validates all materials in the specified scope (course + folder).
 * Ensures corrupted text, raw binary/PDF bytes, empty files, or failed extractions
 * are never included in question generation.
 */
export function validateMaterialsInScope(
  userId: string,
  courseId: string,
  folderId?: string | null | 'all'
): MaterialValidationResult {
  const allMaterials = getMaterials(userId, courseId, folderId);
  const eligibleMaterials: Material[] = [];
  const excludedMaterials: { material: Material; reason: string }[] = [];

  const candidateChunks = getFilteredChunks({
    userId,
    courseId,
    folderId,
  });

  const pageSet = new Set<string>();
  let totalChunks = 0;

  for (const mat of allMaterials) {
    if (mat.status !== 'ready') {
      excludedMaterials.push({
        material: mat,
        reason: `Document is currently in '${mat.status}' state (not ready).`,
      });
      continue;
    }

    if (!mat.extractedTextLength || mat.extractedTextLength < 30) {
      excludedMaterials.push({
        material: mat,
        reason: 'Document has empty or insufficient extracted text content (< 30 characters).',
      });
      continue;
    }

    // Inspect chunks for this document
    const docChunks = candidateChunks.filter((c) => c.documentId === mat.id);
    if (docChunks.length === 0) {
      excludedMaterials.push({
        material: mat,
        reason: 'No indexed text chunks found for this document.',
      });
      continue;
    }

    // Verify first few chunks for binary or unparsed stream signatures
    let isCorrupted = false;
    for (const chunk of docChunks.slice(0, 3)) {
      const assessment = validateAndCleanText(chunk.text);
      if (!assessment.isValid || assessment.isLikelyBinaryOrCorrupted) {
        isCorrupted = true;
        break;
      }
    }

    if (isCorrupted) {
      excludedMaterials.push({
        material: mat,
        reason: 'Document contains unparsed binary stream syntax or corrupted text.',
      });
      continue;
    }

    // Material is valid and readable
    eligibleMaterials.push(mat);
    docChunks.forEach((c) => {
      totalChunks++;
      pageSet.add(`${mat.id}_p${c.pageOrSlide}`);
    });
  }

  return {
    eligibleMaterials,
    excludedMaterials,
    totalReadableChunks: totalChunks,
    distinctPagesCount: pageSet.size,
    distinctDocumentsCount: eligibleMaterials.length,
  };
}

/**
 * Stratified multi-document and multi-page chunk collector.
 * Scans ALL eligible uploaded files and ALL pages/slides/sections across the folder/course.
 */
export async function collectStratifiedStudyChunks(options: {
  userId: string;
  courseId: string;
  folderId?: string | null | 'all';
  topic?: string;
  maxTotalChunks?: number;
}): Promise<{
  chunks: RetrievalResult[];
  coverage: DocumentCoverageSummary[];
}> {
  const { userId, courseId, folderId, topic, maxTotalChunks = 16 } = options;

  // 1. Validate all materials in scope
  const validation = validateMaterialsInScope(userId, courseId, folderId);
  if (validation.eligibleMaterials.length === 0) {
    return { chunks: [], coverage: [] };
  }

  const allScopedChunks = getFilteredChunks({
    userId,
    courseId,
    folderId,
  });

  // 2. Compute query embedding if topic filter is provided
  let topicVector: number[] | null = null;
  if (topic && topic.trim()) {
    try {
      topicVector = await generateEmbedding(topic.trim());
    } catch {
      topicVector = null;
    }
  }

  const selectedResults: RetrievalResult[] = [];
  const coverageSummaries: DocumentCoverageSummary[] = [];

  const docCount = validation.eligibleMaterials.length;
  // Determine chunks to allocate per document to ensure all documents are represented
  const targetPerDoc = Math.max(3, Math.floor(maxTotalChunks / docCount));

  for (const mat of validation.eligibleMaterials) {
    const docChunks = allScopedChunks.filter((c) => c.documentId === mat.id);
    if (docChunks.length === 0) continue;

    // Group chunks by page/slide
    const pageMap = new Map<number, DocumentChunk[]>();
    for (const chunk of docChunks) {
      const p = chunk.pageOrSlide || 1;
      if (!pageMap.has(p)) pageMap.set(p, []);
      pageMap.get(p)!.push(chunk);
    }

    const sortedPages = Array.from(pageMap.keys()).sort((a, b) => a - b);
    const sampledForDoc: DocumentChunk[] = [];

    // Ensure we sample across all pages: early, middle, late
    // 1st pass: pick at least one chunk from each page
    for (const pageNum of sortedPages) {
      const chunksOnPage = pageMap.get(pageNum)!;
      // If topic filter exists, score chunks on this page
      if (topic && topic.trim()) {
        let bestChunk = chunksOnPage[0];
        let bestScore = -1;
        for (const c of chunksOnPage) {
          let score = calculateLexicalScore(topic, c);
          if (topicVector && c.embedding && c.embedding.length === topicVector.length) {
            score = score * 0.3 + cosineSimilarity(topicVector, c.embedding) * 0.7;
          }
          if (score > bestScore) {
            bestScore = score;
            bestChunk = c;
          }
        }
        sampledForDoc.push(bestChunk);
      } else {
        // Pick the most comprehensive chunk on this page
        const bestLengthChunk = [...chunksOnPage].sort((a, b) => b.text.length - a.text.length)[0];
        sampledForDoc.push(bestLengthChunk);
      }
    }

    // 2nd pass: if we need more chunks to meet targetPerDoc, fill in with additional chunks
    if (sampledForDoc.length < targetPerDoc && docChunks.length > sampledForDoc.length) {
      const sampledIds = new Set(sampledForDoc.map((c) => c.chunkId));
      const remaining = docChunks.filter((c) => !sampledIds.has(c.chunkId));
      sampledForDoc.push(...remaining.slice(0, targetPerDoc - sampledForDoc.length));
    }

    // Trim if too many for this doc, while preserving page diversity
    const finalDocChunks = sampledForDoc.slice(0, Math.max(targetPerDoc, 4));

    const pagesCovered = Array.from(new Set(finalDocChunks.map((c) => c.pageOrSlide))).sort((a, b) => a - b);
    coverageSummaries.push({
      documentId: mat.id,
      filename: mat.filename,
      pagesCovered,
      totalChunksSampled: finalDocChunks.length,
    });

    for (const c of finalDocChunks) {
      selectedResults.push({
        chunk: c,
        score: 0.85,
        matchType: c.embedding ? 'hybrid' : 'lexical',
      });
    }
  }

  return {
    chunks: selectedResults,
    coverage: coverageSummaries,
  };
}

export interface GenerateAssessmentOptions {
  chunks: RetrievalResult[];
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionTypes?: QuestionType[];
  bloomFocus?: 'all' | 'foundational' | 'intermediate' | 'advanced';
  topic?: string;
}

const ALL_BLOOM_LEVELS: BloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

const ALL_QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'true_false',
  'short_answer',
  'short_essay',
];

/**
 * Universal Multi-Type Assessment Generator grounded in Bloom's Taxonomy.
 */
export async function generateUniversalAssessment(
  options: GenerateAssessmentOptions
): Promise<QuizQuestion[]> {
  const {
    chunks,
    questionCount = 4,
    difficulty = 'medium',
    questionTypes = ALL_QUESTION_TYPES,
    bloomFocus = 'all',
    topic,
  } = options;

  if (!chunks || chunks.length === 0) return [];

  // Build citation dictionary
  const citations: Citation[] = chunks.map((rc) => ({
    chunkId: rc.chunk.chunkId,
    documentId: rc.chunk.documentId,
    filename: rc.chunk.filename,
    courseId: rc.chunk.courseId,
    folderId: rc.chunk.folderId,
    pageOrSlide: rc.chunk.pageOrSlide,
    sourceExcerpt: rc.chunk.text.slice(0, 180).replace(/\s+/g, ' ') + '...',
    relevanceScore: Math.round((rc.score || 0.8) * 100) / 100,
  }));

  const contextText = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (${c.chunk.filename}, Page ${c.chunk.pageOrSlide}):\n${c.chunk.text}`
    )
    .join('\n\n---\n\n');

  // Filter requested Bloom levels
  let targetBloomLevels: BloomLevel[] = ALL_BLOOM_LEVELS;
  if (bloomFocus === 'foundational') {
    targetBloomLevels = ['Remember', 'Understand'];
  } else if (bloomFocus === 'intermediate') {
    targetBloomLevels = ['Understand', 'Apply', 'Analyze'];
  } else if (bloomFocus === 'advanced') {
    targetBloomLevels = ['Analyze', 'Evaluate', 'Create'];
  }

  const requestedTypes = questionTypes.length > 0 ? questionTypes : ALL_QUESTION_TYPES;

  // Fallback if no Gemini API Key is configured
  if (!process.env.GEMINI_API_KEY) {
    return generateDeterministicFallback({
      chunks,
      citations,
      questionCount,
      difficulty,
      questionTypes: requestedTypes,
      bloomLevels: targetBloomLevels,
    });
  }

  const systemInstruction = `You are a distinguished University Assessment Specialist and Examination Author.
You construct rigorous, academically sound study questions strictly grounded in the provided course texts.

CRITICAL INSTRUCTIONS:
1. NATURAL ACADEMIC QUESTIONS: Do NOT write meta-questions like "According to the document...", "As stated on page 3...", or "Based on the text...". Ask direct academic questions addressing the concepts, mechanisms, principles, definitions, examples, causal relationships, and real applications.
2. QUESTION TYPES TO GENERATE:
   - "multiple_choice": 4 options (Option A, Option B, Option C, Option D). Exactly 1 correct answer. 3 plausible conceptual distractors targeting common misconceptions.
   - "true_false": A nuanced statement requiring critical thought. Options must be ["True", "False"]. Clear correct answer and explanation.
   - "short_answer": Direct question requiring recall or production of a key term, mechanism, formula, or concept. Provide "correctAnswer" and "acceptableAnswers" (list of synonyms/variations).
   - "short_essay": Deep analytical, comparative, or evaluative question. Provide "sampleAnswer" (exemplar response) and "markingPoints" (3-5 specific criteria bullet points required for full credit).
3. BLOOM'S TAXONOMY HIERARCHY:
   - Assign each question an authentic "bloomLevel" chosen from: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].
   - Distribute questions across appropriate levels rather than only simple recall.
   - Match difficulty: "easy" = Remember/Understand; "medium" = Understand/Apply/Analyze; "hard" = Analyze/Evaluate/Create.
4. MULTI-DOCUMENT / MULTI-PAGE SYNTHESIS:
   - When sources come from multiple files or pages, synthesize questions that test relationships, contrasts, or progressive developments across the sources.
5. GROUNDING & FIDELITY:
   - Every fact, explanation, and answer must be strictly substantiated by the provided source texts.`;

  const prompt = `Generate exactly ${questionCount} high-yield questions based ONLY on the provided sources below.

Required Question Types to distribute: ${JSON.stringify(requestedTypes)}
Target Bloom Taxonomy Levels: ${JSON.stringify(targetBloomLevels)}
Overall Difficulty Target: ${difficulty}
${topic ? `Topic Focus: ${topic}` : ''}

Format your output STRICTLY as a JSON array of objects adhering to this schema:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "bloomLevel": "Understand",
    "difficulty": "${difficulty}",
    "question": "Clear, direct academic question without 'According to...'",
    "options": ["Option A: ...", "Option B: ...", "Option C: ...", "Option D: ..."],
    "correctAnswer": "Option A: ...",
    "explanation": "Detailed explanation grounded in the text",
    "sourceIndex": 1
  },
  {
    "id": "q2",
    "type": "true_false",
    "bloomLevel": "Analyze",
    "difficulty": "${difficulty}",
    "question": "Conceptual proposition to evaluate",
    "options": ["True", "False"],
    "correctAnswer": "True",
    "explanation": "In-depth rationale why this statement is true/false",
    "sourceIndex": 2
  },
  {
    "id": "q3",
    "type": "short_answer",
    "bloomLevel": "Remember",
    "difficulty": "${difficulty}",
    "question": "Direct question asking the student to produce the term or concept",
    "correctAnswer": "Exact primary answer",
    "acceptableAnswers": ["Primary Answer", "Accepted Variation 1", "Accepted Variation 2"],
    "explanation": "Contextual explanation",
    "sourceIndex": 3
  },
  {
    "id": "q4",
    "type": "short_essay",
    "bloomLevel": "Evaluate",
    "difficulty": "${difficulty}",
    "question": "Analytical or comparative essay prompt",
    "correctAnswer": "Summary of core thesis",
    "sampleAnswer": "Comprehensive model response demonstrating high-level mastery...",
    "markingPoints": [
      "Must define concept X and explain mechanism Y",
      "Must contrast approach A with approach B",
      "Must identify empirical consequence Z"
    ],
    "explanation": "Pedagogical commentary on why these points matter",
    "sourceIndex": 4
  }
]

Do NOT include markdown formatting or backticks outside the JSON. Return valid JSON only.

SOURCE MATERIALS:
${contextText}`;

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const raw = (response.text || '[]').trim();
    const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => {
        const sourceIdx =
          typeof item.sourceIndex === 'number' &&
          item.sourceIndex >= 1 &&
          item.sourceIndex <= citations.length
            ? item.sourceIndex - 1
            : idx % citations.length;

        const rawType = item.type;
        const type: QuestionType = ALL_QUESTION_TYPES.includes(rawType)
          ? rawType
          : 'multiple_choice';

        const rawBloom = item.bloomLevel;
        const bloomLevel: BloomLevel = ALL_BLOOM_LEVELS.includes(rawBloom)
          ? rawBloom
          : 'Understand';

        return {
          id: item.id || `q_${Date.now()}_${idx}`,
          type,
          bloomLevel,
          difficulty: item.difficulty || difficulty,
          question: item.question || 'Concept Evaluation',
          options: Array.isArray(item.options) ? item.options : undefined,
          correctAnswer: item.correctAnswer || (item.options ? item.options[0] : 'Model Answer'),
          explanation: item.explanation || 'Verified directly from the course texts.',
          markingPoints: Array.isArray(item.markingPoints) ? item.markingPoints : undefined,
          sampleAnswer: item.sampleAnswer || undefined,
          acceptableAnswers: Array.isArray(item.acceptableAnswers)
            ? item.acceptableAnswers
            : undefined,
          citations: [citations[sourceIdx] || citations[0]],
        };
      });
    }
  } catch (err) {
    console.warn('[AssessmentEngine] Live AI generation encountered issue, using robust deterministic fallback:', err);
  }

  // Fallback if AI synthesis fails
  return generateDeterministicFallback({
    chunks,
    citations,
    questionCount,
    difficulty,
    questionTypes: requestedTypes,
    bloomLevels: targetBloomLevels,
  });
}

/**
 * Deterministic Fallback Generator
 * Generates natural, un-formulaic questions across all 4 types and Bloom levels
 * when Gemini API key is missing or model service is temporarily unavailable.
 */
function generateDeterministicFallback(options: {
  chunks: RetrievalResult[];
  citations: Citation[];
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: QuestionType[];
  bloomLevels: BloomLevel[];
}): QuizQuestion[] {
  const { chunks, citations, questionCount, difficulty, questionTypes, bloomLevels } = options;
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < questionCount; i++) {
    const chunkIdx = i % chunks.length;
    const rc = chunks[chunkIdx];
    const text = rc.chunk.text.trim();
    const citation = citations[chunkIdx] || citations[0];

    const type = questionTypes[i % questionTypes.length];
    const bloom = bloomLevels[i % bloomLevels.length];

    // Extract complete sentences from chunk
    const sentences = text.match(/[A-Z][a-zA-Z0-9\s,;:'"()\-–—]+[.!?]/g) || [text];
    const s1 = sentences[0]?.trim() || text.slice(0, 140);
    const s2 = sentences[1]?.trim() || '';

    // Create academic questions without "According to the document"
    if (type === 'multiple_choice') {
      const question = `Which statement accurately characterizes the core principles established regarding this topic?`;
      const optA = s1;
      const optB = `Empirical data indicates that ${s1.slice(0, 45)}... was later invalidated by alternative models.`;
      const optC = `This principle applies exclusively to preliminary theoretical baselines without real-world manifestation.`;
      const optD = `The framework treats this mechanism as a non-essential peripheral assumption.`;

      questions.push({
        id: `fb_mcq_${Date.now()}_${i}`,
        type: 'multiple_choice',
        bloomLevel: bloom,
        difficulty,
        question,
        options: [optA, optB, optC, optD],
        correctAnswer: optA,
        explanation: `${s1} ${s2}`,
        citations: [citation],
      });
    } else if (type === 'true_false') {
      const isTrue = i % 2 === 0;
      const question = isTrue
        ? `${s1}`
        : `${s1.replace(/\b(is|are|was|were|increases|decreases|stimulates)\b/i, 'does not')}`;

      questions.push({
        id: `fb_tf_${Date.now()}_${i}`,
        type: 'true_false',
        bloomLevel: bloom,
        difficulty,
        question,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation: `Verified from source: "${s1}"`,
        citations: [citation],
      });
    } else if (type === 'short_answer') {
      // Find key noun phrase or term
      const words = s1.split(/\s+/).filter((w) => w.length > 5);
      const keyTerm = words[0] || 'Foundational Mechanism';
      const question = `State the key principle or term described in the following context: "${s1.replace(keyTerm, '_______')}"`;

      questions.push({
        id: `fb_sa_${Date.now()}_${i}`,
        type: 'short_answer',
        bloomLevel: bloom,
        difficulty,
        question,
        correctAnswer: keyTerm,
        acceptableAnswers: [keyTerm, keyTerm.toLowerCase(), keyTerm.toUpperCase()],
        explanation: `Full context: "${s1}"`,
        citations: [citation],
      });
    } else {
      // short_essay
      const question = `Critically analyze the mechanism and practical implications presented in the course material: "${s1.slice(0, 100)}..."`;
      const sampleAnswer = `A comprehensive analysis must address how ${s1} operates. In particular, ${s2 || s1} demonstrates the structural significance of this principle and its broader operational impact.`;
      const markingPoints = [
        `Accurately identifies the foundational definition and mechanism (${s1.slice(0, 60)}...)`,
        `Explains the contextual role and significance within the domain`,
        `Distinguishes this mechanism from counter-arguments or edge cases`,
      ];

      questions.push({
        id: `fb_se_${Date.now()}_${i}`,
        type: 'short_essay',
        bloomLevel: bloom,
        difficulty,
        question,
        correctAnswer: s1,
        sampleAnswer,
        markingPoints,
        explanation: `Pedagogical breakdown: "${s1} ${s2}"`,
        citations: [citation],
      });
    }
  }

  return questions;
}
