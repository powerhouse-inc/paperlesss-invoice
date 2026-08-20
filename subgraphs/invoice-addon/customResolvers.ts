// Custom resolvers for the invoice-addon subgraph.
//
// Scope: chunked upload of an invoice PDF, reassembled server-side and
// handed to Claude for field extraction. The Gnosis Safe and Request Finance
// payment resolvers that used to live here were dropped in this project.

import { uploadPdfAndGetJsonClaude } from "../../scripts/invoice/pdfToClaudeAI.js";

// --- Type definitions for resolver args ---

interface UploadInvoicePdfChunkArgs {
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  sessionId: string;
}

// Define a type for the file chunks data
interface FileChunksData {
  chunks: string[];
  receivedChunks: number;
}

// Create a Map to store file chunks data
const fileChunksMap = new Map<string, FileChunksData>();

export const Invoice_uploadInvoicePdfChunk = async (
  _: unknown,
  args: UploadInvoicePdfChunkArgs,
) => {
  try {
    const { chunk, chunkIndex, totalChunks, fileName, sessionId } = args;
    const fileKey = `${sessionId}_${fileName}`;

    // Initialize array for this file if it doesn't exist
    if (!fileChunksMap.has(fileKey)) {
      fileChunksMap.set(fileKey, {
        chunks: new Array(totalChunks).fill("") as string[],
        receivedChunks: 0,
      });
    }

    // Get the file chunks data
    const fileData = fileChunksMap.get(fileKey)!;

    // Add the chunk at the correct position
    fileData.chunks[chunkIndex] = chunk;
    fileData.receivedChunks += 1;

    console.log(
      `Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`,
    );

    // If we've received all chunks, process the complete file
    if (fileData.receivedChunks === totalChunks) {
      // Combine all chunks
      const completeFile = fileData.chunks.join("");

      console.log("Processing PDF with Claude Haiku 4.5...");
      const startTime = Date.now();

      try {
        const claudeResult = await uploadPdfAndGetJsonClaude(completeFile);
        const processingTime = Date.now() - startTime;
        console.log(`PDF processing completed in ${processingTime}ms`);

        const responseData = {
          invoiceData: claudeResult.invoiceData as Record<string, unknown>,
          warnings: claudeResult.warnings,
          invalidFields: claudeResult.invalidFields,
          confidence: claudeResult.confidence,
          groundingAvailable: claudeResult.groundingAvailable,
          retried: claudeResult.retried,
          truncated: claudeResult.truncated,
          processingMetadata: {
            provider: "claude-haiku-4-5-20251001",
            processingTimeMs: processingTime,
            processingTimestamp: new Date().toISOString(),
          },
        };

        // Clean up
        fileChunksMap.delete(fileKey);

        return {
          success: true,
          data: responseData,
        };
      } catch (error) {
        console.error("Error in PDF processing:", error);
        fileChunksMap.delete(fileKey);

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // If not all chunks received yet, just acknowledge receipt
    return {
      success: true,
      data: {
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
        progress: (fileData.receivedChunks / totalChunks) * 100,
      },
    };
  } catch (error) {
    console.error("Error processing PDF chunk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
