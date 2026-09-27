import { generateEmbedding } from './ai.js';
import { ChunkFilter, getFilteredChunks } from './db.js';
import { DocumentChunk, RetrievalResult } from './types.js';

/**
 * Compute cosine similarity between two floating-point vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Tokenize text for lexical / BM25 style scoring.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Lexical match scoring (BM25 / TF-IDF approximation with exact phrase boost).
 */
export function calculateLexicalScore(query: string, chunk: DocumentChunk): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const chunkTokens = tokenize(chunk.text);
  const tokenSet = new Set(chunkTokens);

  let matchCount = 0;
  for (const qt of queryTokens) {
    if (tokenSet.has(qt)) {
      matchCount++;
    }
  }

  // Jaccard-like ratio
  const tokenOverlap = matchCount / queryTokens.length;

  // Exact phrase match bonus
  const lowerQuery = query.toLowerCase().trim();
  const lowerChunk = chunk.text.toLowerCase();
  const exactPhraseBoost = lowerChunk.includes(lowerQuery) ? 0.4 : 0;

  // Filename bonus if user queries by file topic
  const filenameTokens = tokenize(chunk.filename);
  let fileBonus = 0;
  for (const qt of queryTokens) {
    if (filenameTokens.includes(qt)) {
      fileBonus += 0.15;
    }
  }

  return Math.min(1.0, tokenOverlap * 0.6 + exactPhraseBoost + fileBonus);
}

export interface RagRetrieveOptions {
  query: string;
  filter: ChunkFilter;
  topK?: number;
  minScore?: number;
  forceLexical?: boolean;
}

/**
 * Production-ready Vector RAG with strict folder/course isolation
 * and automatic fallback to lexical retrieval if embeddings are unavailable.
 */
export async function retrieveRelevantChunks(options: RagRetrieveOptions): Promise<{
  results: RetrievalResult[];
  matchType: 'vector' | 'lexical' | 'hybrid';
  totalChunksInScope: number;
}> {
  const { query, filter, topK = 5, minScore = 0.15, forceLexical = false } = options;

  // 1. Fetch strictly filtered chunks based on ownerId + courseId + folderId
  const candidateChunks = getFilteredChunks(filter);

  if (candidateChunks.length === 0) {
    return {
      results: [],
      matchType: 'lexical',
      totalChunksInScope: 0,
    };
  }

  // 2. Determine if vector embeddings are usable
  const chunksWithEmbeddings = candidateChunks.filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length > 0
  );

  let queryVector: number[] | null = null;
  if (!forceLexical && chunksWithEmbeddings.length > 0) {
    queryVector = await generateEmbedding(query);
  }

  const scoredResults: RetrievalResult[] = [];

  if (queryVector && chunksWithEmbeddings.length > 0) {
    // Vector or Hybrid Search
    for (const chunk of candidateChunks) {
      let vectorScore = 0;
      if (chunk.embedding && chunk.embedding.length === queryVector.length) {
        vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      }

      const lexicalScore = calculateLexicalScore(query, chunk);

      // Hybrid combination: 70% vector + 30% lexical
      const combinedScore = chunk.embedding ? vectorScore * 0.7 + lexicalScore * 0.3 : lexicalScore;

      if (combinedScore >= minScore) {
        scoredResults.push({
          chunk,
          score: combinedScore,
          matchType: chunk.embedding ? 'hybrid' : 'lexical',
        });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);
    const topResults = scoredResults.slice(0, topK);

    return {
      results: topResults,
      matchType: 'hybrid',
      totalChunksInScope: candidateChunks.length,
    };
  }

  // 3. Fallback: Pure Lexical Retrieval
  for (const chunk of candidateChunks) {
    const score = calculateLexicalScore(query, chunk);
    if (score >= minScore) {
      scoredResults.push({
        chunk,
        score,
        matchType: 'lexical',
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  // If top scores are too low or empty, still provide the top candidates from the folder so the tutor has context
  const results = scoredResults.length > 0 ? scoredResults.slice(0, topK) : candidateChunks.slice(0, Math.min(topK, candidateChunks.length)).map(c => ({
    chunk: c,
    score: 0.2,
    matchType: 'lexical' as const,
  }));

  return {
    results,
    matchType: 'lexical',
    totalChunksInScope: candidateChunks.length,
  };
}
