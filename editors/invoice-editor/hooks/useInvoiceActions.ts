import { useCallback } from "react";
import { actions } from "document-models/invoice";
import type { InvoiceAction, InvoiceDocument, Status } from "document-models/invoice";
import { loadUBLFile } from "../ingestUBL.js";
import { downloadUBL } from "../exportUBL.js";
import type { DocumentDispatch } from "@powerhousedao/reactor-browser";

export interface UseInvoiceActionsProps {
  state: InvoiceDocument["state"]["global"] | undefined;
  dispatch: DocumentDispatch<InvoiceAction>;
  toast: any;
  pdf: { generatePDFBlob: () => Promise<Blob> };
  validateForStatus: (status: Status, state: any, toast?: any) => boolean | undefined;
  openModal: (modal: any) => void;
  setRejectReason: (r: string) => void;
  setFinalReason: (f: boolean) => void;
}

export function useInvoiceActions({
  state,
  dispatch,
  toast,
  pdf,
  validateForStatus,
  openModal,
  setRejectReason,
  setFinalReason,
}: UseInvoiceActionsProps) {
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await loadUBLFile({ file, dispatch });
        toast?.("UBL file uploaded successfully", {
          type: "success",
        });
      } catch (error) {
        console.error("Failed to load UBL file:", error);
        toast?.("Failed to load UBL file", {
          type: "error",
        });
      }
    },
    [dispatch, toast]
  );

  const handleExportUBL = useCallback(async () => {
    try {
      const pdfBlob = await pdf.generatePDFBlob();
      const filename = `invoice_${state!.invoiceNo || "export"}.xml`;

      return await downloadUBL({
        invoice: state!,
        filename,
        pdfBlob,
      });
    } catch (error) {
      console.error("Error exporting to UBL:", error);
      toast?.("Failed to export UBL", { type: "error" });
      throw error;
    }
  }, [state, pdf, toast]);

  const handleStatusChange = useCallback(
    (newStatus: Status) => {
      const validationResult = validateForStatus(newStatus, state, toast);
      if (validationResult) {
        return;
      }
      if (newStatus === "ISSUED") {
        const trueRejection = state?.rejections.find(
          (rejection: any) => rejection.final === true
        );
        if (state?.status === "REJECTED" && trueRejection) {
          setRejectReason(trueRejection.reason);
          setFinalReason(trueRejection.final);
          openModal("finalRejection");
          return;
        }
        openModal("issueInvoice");
        return;
      }
      if (newStatus === "CANCELLED") {
        dispatch(actions.cancel({}));
        return;
      }
      if (newStatus === "ACCEPTED") {
        if (state?.status === "PAYMENTCLOSED") {
          dispatch(actions.reapprovePayment({}));
          return;
        }
        dispatch(actions.accept({ payAfter: new Date().toISOString() }));
        return;
      }
      if (newStatus === "REJECTED") {
        openModal("rejectInvoice");
        return;
      }
      if (newStatus === "DRAFT") {
        dispatch(actions.reset({}));
        return;
      }
      if (newStatus === "PAYMENTSCHEDULED") {
        openModal("schedulePayment");
        return;
      }
      if (newStatus === "PAYMENTCLOSED") {
        openModal("closePayment");
        return;
      }
      if (newStatus === "PAYMENTSENT") {
        openModal("registerPayment");
        return;
      }
      if (newStatus === "PAYMENTISSUE") {
        openModal("reportPaymentIssue");
        return;
      }
      if (newStatus === "PAYMENTRECEIVED") {
        openModal("confirmPayment");
        return;
      }
    },
    [state, dispatch, toast, validateForStatus, openModal, setRejectReason, setFinalReason]
  );

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      dispatch(actions.editInvoice({ currency }));
    },
    [dispatch]
  );

  return {
    handleFileUpload,
    handleExportUBL,
    handleStatusChange,
    handleCurrencyChange,
  };
}
