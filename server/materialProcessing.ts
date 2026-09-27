import { generateBatchEmbeddings } from './ai.js';
import { addChunks, addMaterial, updateMaterial } from './db.js';
import { chunkTextWithMetadata, validateAndCleanText } from './textQuality.js';
import { DocumentChunk, Material } from './types.js';

export interface ProcessDocumentOptions {
  userId: string;
  courseId: string;
  folderId: string | null;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Extract raw text from file buffer safely based on mimeType and extension.
 */
async function extractRawText(filename: string, mimeType: string, buffer: Buffer): Promise<{ text: string; pages: number }> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    try {
      const { extractText } = await import('unpdf');
      const res = await extractText(new Uint8Array(buffer));
      const pages = res.totalPages || (res.text ? res.text.length : 1);
      const combinedText = Array.isArray(res.text) ? res.text.join('\n\n') : String(res.text || '');

      if (combinedText && combinedText.trim().length >= 15) {
        return {
          text: combinedText,
          pages: Math.max(1, pages),
        };
      }
    } catch (pdfErr) {
      console.warn('[Parser] unpdf extraction error:', pdfErr);
    }

    // Secondary fallback: extract text streams from PDF stream blocks if uncompressed
    const str = buffer.toString('latin1');
    const textChunks: string[] = [];
    const textMatches = str.match(/BT[\s\S]*?ET/g);
    if (textMatches) {
      for (const block of textMatches) {
        const parts = block.match(/\((.*?)\)\s*Tj/g);
        if (parts) {
          textChunks.push(parts.map((p) => p.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' '));
        }
      }
    }
    const extracted = textChunks.join('\n').trim();
    if (extracted.length >= 15) {
      return {
        text: extracted,
        pages: Math.max(1, Math.ceil(extracted.length / 2000)),
      };
    }

    // If both failed, return empty string so text validation cleanly flags that the PDF could not be parsed
    return {
      text: '',
      pages: 1,
    };
  }

  // Plain text, markdown, csv, json, code files
  const text = buffer.toString('utf8');
  // Approximate page count: 1 page per 2000 chars
  const pages = Math.max(1, Math.ceil(text.length / 2000));
  return { text, pages };
}

/**
 * Full processing pipeline:
 * Upload -> Text Extraction -> Quality Validation & Cleaning -> Semantic Chunking -> Vector Embedding -> DB Save.
 */
export async function processUploadedDocument(options: ProcessDocumentOptions): Promise<Material> {
  const { userId, courseId, folderId, filename, mimeType, buffer } = options;

  const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialMaterial: Material = {
    id: materialId,
    courseId,
    folderId,
    ownerId: userId,
    title: filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    filename,
    mimeType,
    sizeBytes: buffer.length,
    extractedTextLength: 0,
    chunkCount: 0,
    status: 'processing',
    statusMessage: 'Extracting and cleaning text...',
    hasEmbeddings: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  addMaterial(initialMaterial);

  try {
    // 1. Extract raw text
    const { text: rawText, pages } = await extractRawText(filename, mimeType, buffer);

    // 2. Validate & clean text (ensures clean text and rejects raw binary)
    const quality = validateAndCleanText(rawText);
    if (!quality.isValid) {
      updateMaterial(userId, materialId, {
        status: 'error',
        statusMessage: quality.rejectionReason || 'Document text quality validation failed.',
      });
      return {
        ...initialMaterial,
        status: 'error',
        statusMessage: quality.rejectionReason,
      };
    }

    // 3. Chunk validated text
    const chunkSlices = chunkTextWithMetadata(quality.cleanText, 600, 100, pages);
    if (chunkSlices.length === 0) {
      updateMaterial(userId, materialId, {
        status: 'error',
        statusMessage: 'Could not generate valid content chunks from extracted text.',
      });
      return {
        ...initialMaterial,
        status: 'error',
        statusMessage: 'No valid chunks generated.',
      };
    }

    // 4. Update status to vector indexing
    updateMaterial(userId, materialId, {
      status: 'indexing_vectors',
      statusMessage: `Generating embeddings for ${chunkSlices.length} chunks...`,
      extractedTextLength: quality.charCount,
      chunkCount: chunkSlices.length,
    });

    // 5. Generate embeddings for each chunk
    const chunkTexts = chunkSlices.map((s) => s.text);
    const embeddings = await generateBatchEmbeddings(chunkTexts);

    let successfulEmbeddings = 0;
    const documentChunks: DocumentChunk[] = chunkSlices.map((slice, i) => {
      const emb = embeddings[i];
      if (emb) successfulEmbeddings++;

      return {
        chunkId: `chk_${materialId}_${slice.chunkIndex}`,
        documentId: materialId,
        filename,
        courseId,
        folderId,
        ownerId: userId,
        pageOrSlide: slice.pageOrSlide,
        chunkIndex: slice.chunkIndex,
        text: slice.text,
        sourceExcerpt: slice.sourceExcerpt,
        embedding: emb || undefined,
        tokenEstimate: Math.ceil(slice.text.length / 4),
      };
    });

    // 6. Save chunks to persistent storage
    addChunks(documentChunks);

    const hasEmbeddings = successfulEmbeddings > 0;
    const finalMaterial = updateMaterial(userId, materialId, {
      status: 'ready',
      statusMessage: hasEmbeddings
        ? `Indexed ${documentChunks.length} chunks with vector embeddings.`
        : `Indexed ${documentChunks.length} chunks (Lexical search mode active).`,
      hasEmbeddings,
      chunkCount: documentChunks.length,
      extractedTextLength: quality.charCount,
    });

    return finalMaterial || initialMaterial;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Processor] Error processing ${filename}:`, errorMsg);
    const failedMaterial = updateMaterial(userId, materialId, {
      status: 'error',
      statusMessage: `Processing failed: ${errorMsg}`,
    });
    return failedMaterial || initialMaterial;
  }
}
