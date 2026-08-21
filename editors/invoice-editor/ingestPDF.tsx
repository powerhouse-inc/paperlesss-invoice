import React, { useState } from "react";
import { type InvoiceAction, actions } from "document-models/invoice";
import { uploadPdfChunked } from "./uploadPdfChunked.js";
import { getCountryCodeFromName, mapChainNameToConfig } from "./utils/utils.js";
import { LoaderCircle } from "lucide-react";
import { getSubgraphUrl } from "../shared/graphql.js";
import { type PDFReviewData } from "./components/PDFReviewModal.js";
import { validatePdfUpload } from "./utils/pdfUpload.js";

const GRAPHQL_URL = getSubgraphUrl("invoice-addon");

export async function loadPDFFile({
  file,
}: {
  file: File;
  dispatch: (action: InvoiceAction) => void;
}) {
  if (!file) throw new Error("No file provided");

  if (file.type !== "application/pdf") {
    throw new Error("Please upload a PDF file");
  }

  console.log("Loading PDF file:", file.name);

  return file;
}

interface PDFUploaderProps {
  changeDropdownOpen: (open: boolean) => void;
  /**
   * Called when an upload finishes successfully. The editor lifts state up
   * to its own level so the review modal survives the dropdown unmounting
   * (the dropdown closes on any outside click). Dispatches are deferred to
   * the editor's Accept handler.
   */
  onUploadComplete: (
    data: PDFReviewData,
    base64Pdf: string,
    fileName: string,
    /**
     * The parsed source PDF. The editor uploads it to the attachment service
     * (hash-first: dispatch the ref, then stream the bytes) and stores it as the
     * base invoice.
     */
    file: File,
  ) => void;
}

/**
 * Extracts the actual error message from Claude API error format
 * Format: "Claude API error: 400 - {...json...}"
 */
function extractErrorMessage(errorMsg: string): string {
  if (errorMsg.includes("Claude API error")) {
    try {
      const jsonMatch = errorMsg.match(/Claude API error: \d+ - (.+)/);
      if (jsonMatch) {
        const errorJson = JSON.parse(jsonMatch[1]);
        if (errorJson?.error?.message) {
          return errorJson.error.message;
        } else if (errorJson?.message) {
          return errorJson.message;
        }
      }
    } catch (parseError) {
      // If parsing fails, use the original error message
      console.error("Failed to parse error message:", parseError);
    }
  }
  return errorMsg;
}

/**
 * Dispatches all the document actions to apply an (already user-reviewed)
 * invoice payload to the document. Exported so the editor (which now owns
 * the review modal state) can call it from its Accept handler.
 */
export interface ApplyExtractedInvoiceReport {
  lineItemsOffered: number;
  lineItemsDispatched: number;
  /** One entry per line item that was not dispatched, with the reason. */
  lineItemsSkipped: { description: string; reason: string }[];
}

export function applyExtractedInvoice(
  dispatch: (action: InvoiceAction) => void,
  invoiceData: Record<string, any>,
): ApplyExtractedInvoiceReport {
  dispatch(
    actions.editInvoice({
      invoiceNo: invoiceData.invoiceNo || "",
      dateIssued:
        invoiceData.dateIssued || new Date().toISOString().split("T")[0],
      dateDelivered: invoiceData.dateDelivered || null,
      dateDue: invoiceData.dateDue || new Date().toISOString().split("T")[0],
      currency: invoiceData.currency || "USD",
    }),
  );

  const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const asText = (value: unknown): string =>
    typeof value === "string" ? value : "";

  const offered: unknown[] = Array.isArray(invoiceData.lineItems)
    ? (invoiceData.lineItems as unknown[])
    : [];
  const report: ApplyExtractedInvoiceReport = {
    lineItemsOffered: offered.length,
    lineItemsDispatched: 0,
    lineItemsSkipped: [],
  };

  // Fields are narrowed rather than read off an `any`: they all come from an
  // LLM, so each is genuinely unknown until checked, and an `any` would hide
  // exactly the malformed values this guard exists to catch.
  for (const entry of offered) {
    const item = asRecord(entry);
    const description = asText(item.description);
    const label = description.slice(0, 60) || "(no description)";

    // Structural guard only. The price *relations* are the reducer's job —
    // re-checking the tax arithmetic here would duplicate it and drift.
    const id = asText(item.id);
    if (!id) {
      report.lineItemsSkipped.push({ description: label, reason: "missing id" });
      continue;
    }

    const numericFields = [
      "quantity",
      "taxPercent",
      "unitPriceTaxExcl",
      "unitPriceTaxIncl",
      "totalPriceTaxExcl",
      "totalPriceTaxIncl",
    ] as const;
    const badField = numericFields.find((field) => {
      const value = item[field];
      return typeof value !== "number" || !Number.isFinite(value);
    });
    if (badField) {
      report.lineItemsSkipped.push({
        description: label,
        reason: `${badField} is not a finite number`,
      });
      continue;
    }

    report.lineItemsDispatched += 1;
    dispatch(
      actions.addLineItem({
        id,
        description,
        currency: asText(item.currency),
        quantity: item.quantity as number,
        taxPercent: item.taxPercent as number,
        unitPriceTaxExcl: item.unitPriceTaxExcl as number,
        unitPriceTaxIncl: item.unitPriceTaxIncl as number,
        totalPriceTaxExcl: item.totalPriceTaxExcl as number,
        totalPriceTaxIncl: item.totalPriceTaxIncl as number,
      }),
    );

    if (Array.isArray(item.lineItemTag)) {
      for (const rawTag of item.lineItemTag as unknown[]) {
        const tag = asRecord(rawTag);
        const dimension = asText(tag.dimension);
        const value = asText(tag.value);
        if (!dimension || !value) continue;
        dispatch(
          actions.setLineItemTag({
            lineItemId: id,
            dimension,
            value,
            label: asText(tag.label),
          }),
        );
      }
    }
  }

  if (invoiceData.issuer) {
    dispatch(
      actions.editIssuer({
        name: invoiceData.issuer.name || "",
        country: getCountryCodeFromName(invoiceData.issuer.country) || "",
        streetAddress: invoiceData.issuer.address?.streetAddress || "",
        extendedAddress: invoiceData.issuer.address?.extendedAddress || "",
        city: invoiceData.issuer.address?.city || "",
        postalCode: invoiceData.issuer.address?.postalCode || "",
        stateProvince: invoiceData.issuer.address?.stateProvince || "",
        tel: invoiceData.issuer.contactInfo?.tel || "",
        email: invoiceData.issuer.contactInfo?.email || "",
        id: invoiceData.issuer.id?.taxId || "",
      }),
    );

    if (invoiceData.issuer.paymentRouting?.bank) {
      const bank = invoiceData.issuer.paymentRouting.bank;
      dispatch(
        actions.editIssuerBank({
          name: bank.name || "",
          accountNum: bank.accountNum || "",
          ABA: bank.ABA || "",
          BIC: bank.BIC || "",
          SWIFT: bank.SWIFT || "",
          accountType: bank.accountType || "CHECKING",
          beneficiary: bank.beneficiary || "",
          memo: bank.memo || "",
          streetAddress: bank.address?.streetAddress || "",
          city: bank.address?.city || "",
          stateProvince: bank.address?.stateProvince || "",
          postalCode: bank.address?.postalCode || "",
          country: getCountryCodeFromName(bank.address?.country) || "",
          extendedAddress: bank.address?.extendedAddress || "",
        }),
      );
    }

    if (invoiceData.issuer.paymentRouting?.wallet) {
      const chainConfig = mapChainNameToConfig(
        invoiceData.issuer.paymentRouting.wallet.chainName,
      );
      dispatch(
        actions.editIssuerWallet({
          address: invoiceData.issuer.paymentRouting.wallet.address || "",
          chainId:
            invoiceData.issuer.paymentRouting.wallet.chainId ||
            chainConfig.chainId,
          chainName:
            invoiceData.issuer.paymentRouting.wallet.chainName ||
            chainConfig.chainName,
          rpc: invoiceData.issuer.paymentRouting.wallet.rpc || chainConfig.rpc,
        }),
      );
    }
  }

  if (invoiceData.payer) {
    dispatch(
      actions.editPayer({
        name: invoiceData.payer.name || "",
        country: getCountryCodeFromName(invoiceData.payer.country) || "",
        streetAddress: invoiceData.payer.address?.streetAddress || "",
        extendedAddress: invoiceData.payer.address?.extendedAddress || "",
        city: invoiceData.payer.address?.city || "",
        postalCode: invoiceData.payer.address?.postalCode || "",
        stateProvince: invoiceData.payer.address?.stateProvince || "",
        tel: invoiceData.payer.contactInfo?.tel || "",
        email: invoiceData.payer.contactInfo?.email || "",
        id: invoiceData.payer.id?.taxId || "",
      }),
    );

    // Payer payment routing intentionally not dispatched — the payer is the
    // party SENDING funds, so their bank/wallet doesn't belong on the invoice.
  }

  // This loop used to dispatch and move on, so a rejected item left an `.error`
  // on the operation, state unchanged, and the UI still reported success — ten
  // extracted line items could become two silently.
  if (report.lineItemsSkipped.length > 0) {
    console.warn(
      `applyExtractedInvoice: dispatched ${report.lineItemsDispatched} of ` +
        `${report.lineItemsOffered} line items; skipped ` +
        report.lineItemsSkipped
          .map((skipped) => `"${skipped.description}" (${skipped.reason})`)
          .join(", "),
    );
  }

  return report;
}

export default function PDFUploader({
  changeDropdownOpen,
  onUploadComplete,
}: PDFUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Reject non-PDF / oversized files before the expensive parse + upload.
    const validationError = validatePdfUpload(file);
    if (validationError) {
      setError(validationError);
      event.target.value = ""; // allow re-selecting a valid file
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result;
        const base64Data =
          typeof result === "string" ? result.split(",")[1] : undefined;
        if (!base64Data) {
          throw new Error("Failed to read file");
        }

        try {
          const result = await uploadPdfChunked(
            base64Data,
            GRAPHQL_URL,
            50 * 1024,
          );

          if (result.success) {
            const data = result.data;
            const review: PDFReviewData = {
              invoiceData: data.invoiceData,
              warnings: Array.isArray(data.warnings) ? data.warnings : [],
              invalidFields: Array.isArray(data.invalidFields)
                ? data.invalidFields
                : [],
              confidence:
                data.confidence && typeof data.confidence === "object"
                  ? data.confidence
                  : {},
              groundingAvailable: Boolean(data.groundingAvailable),
              retried: Boolean(data.retried),
              truncated: Boolean(data.truncated),
            };
            // Hand the parsed result AND the source File up to the editor
            // before closing the dropdown (the dropdown unmounts this component
            // on close). The editor owns dispatch, so it runs the hash-first
            // attachment flow: dispatch the ref, then upload the bytes.
            onUploadComplete(review, base64Data, file.name, file);
            changeDropdownOpen(false);
          } else {
            const errorMsg = extractErrorMessage(
              result.error || "Failed to process PDF",
            );
            throw new Error(errorMsg);
          }
        } catch (error) {
          console.error("Error processing PDF:", error);
          const errorMessage = extractErrorMessage(
            error instanceof Error
              ? error.message
              : "An error occurred while processing the PDF",
          );
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error handling file:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while handling the file",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="pdf-upload"
          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent cursor-pointer"
        >
          {isLoading && (
            <LoaderCircle className="w-4 h-4 text-primary animate-spin" />
          )}
          {isLoading ? "Uploading..." : "Upload PDF"}
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
        </label>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}
