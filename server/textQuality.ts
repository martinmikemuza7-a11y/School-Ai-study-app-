/**
 * Text extraction, cleaning, and quality validation.
 * Ensures only clean, meaningful textual data is chunked and embedded.
 */

export interface TextQualityAssessment {
  isValid: boolean;
  cleanText: string;
  charCount: number;
  wordCount: number;
  rejectionReason?: string;
  isLikelyBinaryOrCorrupted: boolean;
}

export function validateAndCleanText(rawText: string): TextQualityAssessment {
  if (!rawText || typeof rawText !== 'string') {
    return {
      isValid: false,
      cleanText: '',
      charCount: 0,
      wordCount: 0,
      rejectionReason: 'Empty or non-string input provided',
      isLikelyBinaryOrCorrupted: false,
    };
  }

  // 1. Detect raw file headers and binary/PDF stream markers
  const trimmed = rawText.trimStart();
  if (
    trimmed.startsWith('%PDF-') ||
    rawText.includes('\nendobj') ||
    rawText.includes('\nendstream') ||
    /<<\s*\/[A-Za-z0-9]+\s+[^\n>]+>>/.test(rawText) ||
    rawText.includes('xref\n0 ') ||
    rawText.includes('startxref') ||
    /\b\d+\s+0\s+obj\b/.test(rawText)
  ) {
    return {
      isValid: false,
      cleanText: '',
      charCount: rawText.length,
      wordCount: 0,
      rejectionReason: 'Input contains raw unparsed PDF structure or binary streams. Text extraction failed or file is non-text binary.',
      isLikelyBinaryOrCorrupted: true,
    };
  }

  // 2. Detect binary or unprintable garbage (e.g., null bytes, control characters)
  let nullByteCount = 0;
  let controlCharCount = 0;
  for (let i = 0; i < Math.min(rawText.length, 5000); i++) {
    const code = rawText.charCodeAt(i);
    if (code === 0) nullByteCount++;
    // control chars except tab (9), newline (10), carriage return (13)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      controlCharCount++;
    }
  }

  const sampleSize = Math.min(rawText.length, 5000);
  const controlRatio = sampleSize > 0 ? controlCharCount / sampleSize : 0;
  if (nullByteCount > 2 || controlRatio > 0.05) {
    return {
      isValid: false,
      cleanText: '',
      charCount: rawText.length,
      wordCount: 0,
      rejectionReason: 'Input contains excessive control characters or binary bytes; likely unparsed binary file.',
      isLikelyBinaryOrCorrupted: true,
    };
  }

  // 2. Normalize unicode spaces, line breaks, and tabs
  let cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .replace(/[\t ]+/g, ' ') // collapse horizontal spaces
    .replace(/\n{3,}/g, '\n\n') // collapse multiple blank lines into two
    .trim();

  // 3. Remove repeated decorative divider artifacts like "-----" or "=====" or "_____"
  cleaned = cleaned.replace(/[-=_*#~]{5,}/g, '---');

  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = cleaned.length;

  if (charCount < 15 || wordCount < 3) {
    return {
      isValid: false,
      cleanText: cleaned,
      charCount,
      wordCount,
      rejectionReason: 'Extracted text is too short to provide educational context (minimum 15 characters, 3 words).',
      isLikelyBinaryOrCorrupted: false,
    };
  }

  return {
    isValid: true,
    cleanText: cleaned,
    charCount,
    wordCount,
    isLikelyBinaryOrCorrupted: false,
  };
}

export interface ChunkSlice {
  text: string;
  sourceExcerpt: string;
  pageOrSlide: number;
  chunkIndex: number;
}

/**
 * Split validated clean text into overlapping chunks (~500 chars with 80-100 char overlap)
 * attempting to break on paragraph or sentence boundaries.
 */
export function chunkTextWithMetadata(
  text: string,
  targetChunkSize: number = 600,
  overlap: number = 100,
  estimatedPages: number = 1
): ChunkSlice[] {
  if (!text) return [];

  // If text is small enough, return as single chunk
  if (text.length <= targetChunkSize) {
    return [
      {
        text,
        sourceExcerpt: text.slice(0, 160) + (text.length > 160 ? '...' : ''),
        pageOrSlide: 1,
        chunkIndex: 0,
      },
    ];
  }

  const chunks: ChunkSlice[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentBuffer = '';
  let chunkIndex = 0;
  const totalLength = text.length;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p].trim();
    if (!para) continue;

    if (currentBuffer.length + para.length + 1 > targetChunkSize && currentBuffer.length > 0) {
      // Calculate approximate page/slide based on progression through document
      const currentPos = chunks.reduce((acc, c) => acc + c.text.length, 0);
      const pageOrSlide = Math.min(
        estimatedPages,
        Math.max(1, Math.ceil((currentPos / Math.max(1, totalLength)) * estimatedPages))
      );

      const chunkText = currentBuffer.trim();
      chunks.push({
        text: chunkText,
        sourceExcerpt: chunkText.slice(0, 160) + (chunkText.length > 160 ? '...' : ''),
        pageOrSlide,
        chunkIndex: chunkIndex++,
      });

      // Maintain overlap by retaining the tail of currentBuffer
      const overlapText = currentBuffer.slice(-overlap);
      currentBuffer = overlapText + '\n\n' + para;
    } else {
      currentBuffer = currentBuffer ? currentBuffer + '\n\n' + para : para;
    }
  }

  if (currentBuffer.trim().length > 0) {
    const chunkText = currentBuffer.trim();
    const currentPos = chunks.reduce((acc, c) => acc + c.text.length, 0);
    const pageOrSlide = Math.min(
      estimatedPages,
      Math.max(1, Math.ceil((currentPos / Math.max(1, totalLength)) * estimatedPages))
    );

    chunks.push({
      text: chunkText,
      sourceExcerpt: chunkText.slice(0, 160) + (chunkText.length > 160 ? '...' : ''),
      pageOrSlide,
      chunkIndex: chunkIndex++,
    });
  }

  return chunks;
}
