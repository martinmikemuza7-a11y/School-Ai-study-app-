import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { generateUniversalAssessment } from './assessmentEngine.js';
import { Citation, DocumentChunk, QuizQuestion, RetrievalResult } from './types.js';

// Initialize Gemini Client strictly per @google/genai guidelines
const apiKey = process.env.GEMINI_API_KEY || '';
export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export const EMBEDDING_MODEL = 'gemini-embedding-2-preview';
export const GENERATION_MODEL = 'gemini-3.8-flash';

/**
 * Generate vector embedding for a single string using gemini-embedding-2-preview.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY is not configured. Falling back to lexical retrieval.');
    return null;
  }

  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.slice(0, 2048), // stay within safe token limits for chunk embedding
    });

    const values =
      (response as any).embedding?.values ||
      (response as any).embeddings?.[0]?.values;
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
    return null;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AI] Embedding generation failed:', errorMsg);
    return null;
  }
}

/**
 * Generate vector embeddings for a batch of strings with controlled parallelism.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  // Process in batches of 4 to prevent rate limiting
  const batchSize = 4;
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const batchPromises = slice.map((t) => generateEmbedding(t));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    if (i + batchSize < texts.length) {
      // Small 100ms pause between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return results;
}

export interface TutorResponse {
  answer: string;
  citations: Citation[];
  modelUsed: string;
}

/**
 * Ask Gemini a question strictly grounded in retrieved chunks.
 * Gemini must never invent sources or answer from ungrounded external knowledge.
 */
export async function answerTutorQuestion(
  userQuery: string,
  retrievedChunks: { chunk: DocumentChunk; score: number }[],
  tutorStyle: 'socratic' | 'direct' | 'summary' | 'exam_prep' = 'direct'
): Promise<TutorResponse> {
  const citations: Citation[] = retrievedChunks.map((rc) => ({
    chunkId: rc.chunk.chunkId,
    documentId: rc.chunk.documentId,
    filename: rc.chunk.filename,
    courseId: rc.chunk.courseId,
    folderId: rc.chunk.folderId,
    pageOrSlide: rc.chunk.pageOrSlide,
    sourceExcerpt: rc.chunk.sourceExcerpt,
    relevanceScore: Math.round(rc.score * 100) / 100,
  }));

  if (retrievedChunks.length === 0) {
    return {
      answer: "I couldn't find any relevant study materials in this folder/course to answer your question. Please verify that documents have been uploaded to this folder, or broaden your folder selection.",
      citations: [],
      modelUsed: GENERATION_MODEL,
    };
  }

  // Format context with explicit chunk identifiers
  const contextSections = retrievedChunks
    .map((item, idx) => {
      const c = item.chunk;
      return `[SOURCE ${idx + 1}]
Document: ${c.filename}
Page/Slide: ${c.pageOrSlide}
Chunk ID: ${c.chunkId}
Excerpt:
${c.text}
`;
    })
    .join('\n\n---\n\n');

  let styleInstruction = 'Provide a clear, authoritative, and direct educational explanation.';
  if (tutorStyle === 'socratic') {
    styleInstruction = 'Adopt a Socratic mentoring style: guide the student by answering with key foundational insights and prompting them with a thoughtful follow-up question.';
  } else if (tutorStyle === 'summary') {
    styleInstruction = 'Provide a structured, bulleted summary highlighting core definitions, theorems, or key facts.';
  } else if (tutorStyle === 'exam_prep') {
    styleInstruction = 'Format as an exam preparation review: define the key testable concepts, common pitfalls, and a sample practice check.';
  }

  const systemInstruction = `You are Study Buddy AI, an expert academic tutor.
Your most critical directive is ABSOLUTE GROUNDEDNESS:
1. Generate your answer ONLY from the provided [SOURCE] excerpts below.
2. NEVER invent sources, external URLs, or facts not present in the excerpts.
3. When stating any fact, reference the source using brackets like [Source 1], [Source 2], or citing the document filename and page/slide.
4. If the provided sources do not contain enough information to answer part of the question, clearly state: "The provided materials do not cover [topic]."
5. Style rule: ${styleInstruction}`;

  const prompt = `Student Question:
${userQuery}

Context Chunks from Selected Course & Folder:
${contextSections}

Please synthesize an accurate, well-formatted response grounded exclusively in the above sources:`;

  if (!process.env.GEMINI_API_KEY) {
    // Graceful offline mock response when API key is unset
    const sampleChunk = retrievedChunks[0].chunk;
    return {
      answer: `[Offline Mode / No API Key Detected]\nBased on ${sampleChunk.filename} (Page ${sampleChunk.pageOrSlide}):\n\n"${sampleChunk.text.slice(0, 300)}..."\n\n*(To enable live AI generation, ensure GEMINI_API_KEY is configured in the environment).*`,
      citations,
      modelUsed: 'offline-grounded-fallback',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for high factual accuracy
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const answerText = response.text || 'Unable to generate an answer at this time.';
    return {
      answer: answerText,
      citations,
      modelUsed: GENERATION_MODEL,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AI] Tutor generation failed:', errorMsg);
    return {
      answer: `We encountered an issue communicating with the AI tutor (${errorMsg}). However, here are the most relevant verified excerpts found in your selected materials:\n\n` +
        retrievedChunks.map((rc, i) => `**Excerpt ${i + 1} (${rc.chunk.filename}, p.${rc.chunk.pageOrSlide}):**\n${rc.chunk.text}`).join('\n\n'),
      citations,
      modelUsed: 'grounded-error-fallback',
    };
  }
}

/**
 * Generate active recall quiz questions strictly from retrieved chunks.
 * Uses the universal assessment engine supporting all 4 question types and Bloom's taxonomy.
 */
export async function generateQuizFromChunks(
  retrievedChunks: { chunk: DocumentChunk; score: number }[],
  questionCount: number = 4,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<QuizQuestion[]> {
  return generateUniversalAssessment({
    chunks: retrievedChunks.map((rc) => ({
      chunk: rc.chunk,
      score: rc.score,
      matchType: rc.chunk.embedding ? 'hybrid' : 'lexical',
    })),
    questionCount,
    difficulty,
  });
}
