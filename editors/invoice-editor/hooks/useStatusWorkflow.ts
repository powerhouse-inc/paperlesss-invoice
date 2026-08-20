import { useState, useCallback } from "react";
import { generateId } from "document-model";
import { actions } from "document-models/invoice";
import type { InvoiceDocument, ClosureReason } from "document-models/invoice";

export type ActiveModal =
  | null
  | "issueInvoice"
  | "cancelInvoice"
  | "rejectInvoice"
  | "schedulePayment"
  | "registerPayment"
  | "reportPaymentIssue"
  | "confirmPayment"
  | "closePayment"
  | "finalRejection";

export interface StatusWorkflowState {
  activeModal: ActiveModal;
  modalWarning: boolean;
  rejectReason: string;
  finalReason: boolean;
  paymentRef: string;
  closureReason: string;
  paymentDate: string;
  txnRef: string;
  paymentIssue: string;
  paymentAmount: string;
}

export function useStatusWorkflow(
  state: InvoiceDocument["state"]["global"] | undefined,
  dispatch: (action: any) => void,
  invoiceNoInput: string,
  setInvoiceNoInput: (v: string) => void,
) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [modalWarning, setModalWarning] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [finalReason, setFinalReason] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [paymentIssue, setPaymentIssue] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalWarning(false);
  }, []);

  const openModal = useCallback((modal: ActiveModal) => {
    setActiveModal(modal);
  }, []);

  const handleContinue = useCallback(() => {
    if (!state) return;

    if (activeModal === "issueInvoice") {
      let issueDate: string;
      if (state.dateIssued && state.dateIssued.trim() !== "") {
        issueDate = state.dateIssued.includes("T")
          ? state.dateIssued
          : new Date().toISOString();
      } else {
        issueDate = new Date().toISOString();
      }

      dispatch(
        actions.issue({
          invoiceNo: invoiceNoInput,
          dateIssued: issueDate,
        }),
      );
      setInvoiceNoInput(invoiceNoInput);
    }

    if (activeModal === "rejectInvoice") {
      dispatch(
        actions.reject({
          final: finalReason,
          id: generateId(),
          reason: rejectReason,
        }),
      );
    }

    if (activeModal === "schedulePayment") {
      dispatch(
        actions.schedulePayment({
          id: generateId(),
          processorRef: paymentRef,
        }),
      );
    }

    if (activeModal === "closePayment") {
      dispatch(
        actions.closePayment({
          closureReason: closureReason as ClosureReason,
        }),
      );
    }

    if (activeModal === "registerPayment") {
      dispatch(
        actions.registerPaymentTx({
          id: state.payments[state.payments.length - 1]?.id,
          timestamp: paymentDate,
          txRef: txnRef,
        }),
      );
    }

    if (activeModal === "reportPaymentIssue") {
      dispatch(
        actions.reportPaymentIssue({
          id: state.payments[state.payments.length - 1]?.id,
          issue: paymentIssue,
        }),
      );
    }

    if (activeModal === "confirmPayment") {
      dispatch(
        actions.confirmPayment({
          id: state.payments[state.payments.length - 1]?.id,
          amount: parseFloat(paymentAmount) || 0,
        }),
      );
    }

    closeModal();
  }, [
    activeModal,
    state,
    dispatch,
    invoiceNoInput,
    finalReason,
    rejectReason,
    paymentRef,
    closureReason,
    paymentDate,
    txnRef,
    paymentIssue,
    paymentAmount,
    setInvoiceNoInput,
    closeModal,
  ]);

  return {
    activeModal,
    modalWarning,
    setModalWarning,
    rejectReason,
    setRejectReason,
    finalReason,
    setFinalReason,
    paymentRef,
    setPaymentRef,
    closureReason,
    setClosureReason,
    paymentDate,
    setPaymentDate,
    txnRef,
    setTxnRef,
    paymentIssue,
    setPaymentIssue,
    paymentAmount,
    setPaymentAmount,
    openModal,
    closeModal,
    handleContinue,
  };
}
