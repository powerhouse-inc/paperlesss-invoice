import type { BaseSubgraph } from "@powerhousedao/reactor-api";
import { Invoice_uploadInvoicePdfChunk } from "./customResolvers.js";

export const getResolvers = (
  _subgraph: BaseSubgraph,
): Record<string, unknown> => {
  return {
    Mutation: {
      Invoice_uploadInvoicePdfChunk: Invoice_uploadInvoicePdfChunk,
    },
  };
};
