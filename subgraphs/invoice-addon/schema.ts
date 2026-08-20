import { gql } from "graphql-tag";
import type { DocumentNode } from "graphql";

export const schema: DocumentNode = gql`
  """
  Subgraph definition
  """
  type Mutation {
    Invoice_uploadInvoicePdfChunk(
      chunk: String!
      chunkIndex: Int!
      totalChunks: Int!
      fileName: String!
      sessionId: String!
    ): UploadInvoicePdfChunkOutput
  }

  """
  Output type for PDF chunk upload
  """
  type UploadInvoicePdfChunkOutput {
    success: Boolean!
    data: JSONObject
    error: String
  }
`;
