import {
  accept,
  cancel,
  closePayment,
  confirmPayment,
  editInvoice,
  editIssuerWallet,
  issue,
  reapprovePayment,
  registerPaymentTx,
  reducer,
  reinstate,
  reject,
  reportPaymentIssue,
  reset,
  schedulePayment,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

/**
 * Convenience helpers to walk the invoice status state machine (see
 * `permittedTransitions` in `src/reducers/transitions.ts`):
 *
 *   DRAFT <-> CANCELLED
 *   DRAFT -> ISSUED <-> REJECTED
 *   ISSUED -> ACCEPTED -> PAYMENTSCHEDULED -> PAYMENTSENT -> PAYMENTRECEIVED -> PAYMENTISSUE
 *   ACCEPTED <-> PAYMENTCLOSED
 *   PAYMENTSCHEDULED/PAYMENTISSUE -> PAYMENTCLOSED
 *   PAYMENTISSUE/PAYMENTCLOSED -> ACCEPTED
 */

const ISSUED_AT = "2024-01-01T00:00:00.000Z";
const PAY_AFTER = "2024-02-01T00:00:00.000Z";

/** Issues a fresh document (DRAFT -> ISSUED) with a non-stablecoin currency
 * (the default empty-string currency), so the wallet guard in
 * `issueOperation` is skipped. */
function issuedDocument() {
  const document = utils.createDocument();
  return reducer(
    document,
    issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
  );
}

function acceptedDocument() {
  return reducer(issuedDocument(), accept({ payAfter: PAY_AFTER }));
}

function scheduledDocument(paymentId = "payment-1") {
  return reducer(
    acceptedDocument(),
    schedulePayment({ id: paymentId, processorRef: "processor-ref-1" }),
  );
}

function sentDocument(paymentId = "payment-1") {
  return reducer(
    scheduledDocument(paymentId),
    registerPaymentTx({
      id: paymentId,
      txRef: "tx-ref-1",
      timestamp: "2024-03-01T00:00:00.000Z",
    }),
  );
}

describe("TransitionsOperations", () => {
  describe("full state machine walk (happy path)", () => {
    it("walks DRAFT -> CANCELLED -> DRAFT", () => {
      let document = utils.createDocument();
      expect(document.state.global.status).toBe("DRAFT");

      document = reducer(document, cancel());
      expect(document.state.global.status).toBe("CANCELLED");
      expect(document.operations.global[0].error).toBeUndefined();

      document = reducer(document, reset());
      expect(document.state.global.status).toBe("DRAFT");
      expect(document.operations.global[1].error).toBeUndefined();
    });

    it("walks DRAFT -> ISSUED -> REJECTED -> ISSUED (reinstate)", () => {
      let document = utils.createDocument();

      document = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );
      expect(document.state.global.status).toBe("ISSUED");
      expect(document.state.global.invoiceNo).toBe("INV-1");
      expect(document.state.global.dateIssued).toBe(ISSUED_AT);

      document = reducer(
        document,
        reject({ id: "rejection-1", reason: "missing details", final: false }),
      );
      expect(document.state.global.status).toBe("REJECTED");
      expect(document.state.global.rejections).toEqual([
        { id: "rejection-1", reason: "missing details", final: false },
      ]);

      document = reducer(document, reinstate());
      expect(document.state.global.status).toBe("ISSUED");
    });

    it("walks the full payment lifecycle: ISSUED -> ACCEPTED -> PAYMENTSCHEDULED -> PAYMENTSENT -> PAYMENTRECEIVED -> PAYMENTISSUE -> ACCEPTED -> PAYMENTSCHEDULED -> PAYMENTCLOSED -> ACCEPTED", () => {
      let document = issuedDocument();

      document = reducer(document, accept({ payAfter: PAY_AFTER }));
      expect(document.state.global.status).toBe("ACCEPTED");
      expect(document.state.global.payAfter).toBe(PAY_AFTER);

      document = reducer(
        document,
        schedulePayment({ id: "payment-1", processorRef: "processor-ref-1" }),
      );
      expect(document.state.global.status).toBe("PAYMENTSCHEDULED");
      expect(document.state.global.payments).toHaveLength(1);
      expect(document.state.global.payments[0]).toMatchObject({
        id: "payment-1",
        processorRef: "processor-ref-1",
        confirmed: false,
      });

      document = reducer(
        document,
        registerPaymentTx({
          id: "payment-1",
          txRef: "tx-ref-1",
          timestamp: "2024-03-01T00:00:00.000Z",
        }),
      );
      expect(document.state.global.status).toBe("PAYMENTSENT");
      expect(document.state.global.payments[0].txnRef).toBe("tx-ref-1");
      expect(document.state.global.payments[0].paymentDate).toBe(
        "2024-03-01T00:00:00.000Z",
      );

      document = reducer(
        document,
        confirmPayment({ id: "payment-1", amount: 100 }),
      );
      expect(document.state.global.status).toBe("PAYMENTRECEIVED");
      expect(document.state.global.payments[0].confirmed).toBe(true);
      expect(document.state.global.payments[0].amount).toBe(100);

      document = reducer(
        document,
        reportPaymentIssue({ id: "payment-1", issue: "chargeback" }),
      );
      expect(document.state.global.status).toBe("PAYMENTISSUE");
      expect(document.state.global.payments[0].issue).toBe("chargeback");

      document = reducer(document, reapprovePayment());
      expect(document.state.global.status).toBe("ACCEPTED");

      document = reducer(
        document,
        schedulePayment({ id: "payment-2", processorRef: "processor-ref-2" }),
      );
      expect(document.state.global.status).toBe("PAYMENTSCHEDULED");

      document = reducer(
        document,
        closePayment({ closureReason: "OVERPAID" }),
      );
      expect(document.state.global.status).toBe("PAYMENTCLOSED");
      expect(document.state.global.closureReason).toBe("OVERPAID");

      // PAYMENTCLOSED -> ACCEPTED via reapprovePayment
      document = reducer(document, reapprovePayment());
      expect(document.state.global.status).toBe("ACCEPTED");

      // ACCEPTED -> PAYMENTCLOSED directly
      document = reducer(
        document,
        closePayment({ closureReason: "CANCELLED" }),
      );
      expect(document.state.global.status).toBe("PAYMENTCLOSED");
      expect(document.state.global.closureReason).toBe("CANCELLED");
    });

    it("walks PAYMENTSENT -> PAYMENTISSUE directly (payment issue reported before confirmation)", () => {
      const document = reducer(
        sentDocument(),
        reportPaymentIssue({ id: "payment-1", issue: "wrong amount" }),
      );

      expect(document.state.global.status).toBe("PAYMENTISSUE");
      expect(document.state.global.payments[0].issue).toBe("wrong amount");
    });

    it("walks PAYMENTISSUE -> PAYMENTCLOSED directly", () => {
      let document = reducer(
        sentDocument(),
        reportPaymentIssue({ id: "payment-1", issue: "wrong amount" }),
      );
      expect(document.state.global.status).toBe("PAYMENTISSUE");

      document = reducer(
        document,
        closePayment({ closureReason: "UNDERPAID" }),
      );
      expect(document.state.global.status).toBe("PAYMENTCLOSED");
      expect(document.state.global.closureReason).toBe("UNDERPAID");
    });
  });

  describe("cancelOperation", () => {
    it("errors on invalid transition (cannot cancel from ISSUED)", () => {
      const document = reducer(issuedDocument(), cancel());

      expect(document.operations.global[1].error).toBe(
        "Invalid transition from ISSUED to CANCELLED",
      );
      expect(document.state.global.status).toBe("ISSUED");
    });
  });

  describe("issueOperation", () => {
    it("errors when invoiceNo is missing", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        issue({ invoiceNo: "", dateIssued: ISSUED_AT }),
      );

      expect(updated.operations.global[0].error).toBe(
        "Invoice number and date issued are required",
      );
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("errors when dateIssued is missing (invoiceNo present)", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: "" }),
      );

      expect(updated.operations.global[0].error).toBe(
        "Invoice number and date issued are required",
      );
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("errors on invalid transition (cannot issue from CANCELLED)", () => {
      let document = utils.createDocument();
      document = reducer(document, cancel());
      expect(document.state.global.status).toBe("CANCELLED");

      document = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(document.operations.global[1].error).toBe(
        "Invalid transition from CANCELLED to ISSUED",
      );
      expect(document.state.global.status).toBe("CANCELLED");
    });

    it("converts a date-only dateIssued to a datetime string", () => {
      const document = reducer(
        utils.createDocument(),
        issue({ invoiceNo: "INV-1", dateIssued: "2024-01-01" }),
      );

      expect(document.state.global.dateIssued).toBe(
        "2024-01-01T00:00:00.000Z",
      );
    });

    it("keeps an already-formatted datetime dateIssued as-is", () => {
      const document = reducer(
        utils.createDocument(),
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(document.state.global.dateIssued).toBe(ISSUED_AT);
    });

    it("falls back to the raw dateIssued when it is a whitespace-only string", () => {
      const document = reducer(
        utils.createDocument(),
        issue({ invoiceNo: "INV-1", dateIssued: "   " }),
      );

      expect(document.state.global.status).toBe("ISSUED");
      // ensureDatetimeFormat("   ") returns null (trims to ""), so the `||`
      // fallback keeps the original raw input string.
      expect(document.state.global.dateIssued).toBe("   ");
    });

    it("requires an issuer wallet address+chain before issuing a stablecoin invoice with no payment routing set", () => {
      let document = utils.createDocument();
      document = reducer(document, editInvoice({ currency: "usdc" }));

      const updated = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(updated.operations.global[1].error).toBe(
        "Issuer wallet address and chain must be set before issuing an invoice",
      );
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("requires an issuer wallet chain when the wallet address is set but no chain is set", () => {
      let document = utils.createDocument();
      document = reducer(document, editInvoice({ currency: "USDC" }));
      document = reducer(
        document,
        editIssuerWallet({ address: "0xabc" }),
      );

      const updated = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(updated.operations.global[2].error).toBe(
        "Issuer wallet address and chain must be set before issuing an invoice",
      );
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("issues a stablecoin invoice once the wallet address and chainName are set", () => {
      let document = utils.createDocument();
      document = reducer(document, editInvoice({ currency: "USDC" }));
      document = reducer(
        document,
        editIssuerWallet({ address: "0xabc", chainName: "ethereum" }),
      );

      document = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(document.operations.global[2].error).toBeUndefined();
      expect(document.state.global.status).toBe("ISSUED");
    });

    it("issues a stablecoin invoice once the wallet address and chainId (no chainName) are set", () => {
      let document = utils.createDocument();
      document = reducer(document, editInvoice({ currency: "DAI" }));
      document = reducer(
        document,
        editIssuerWallet({ address: "0xabc", chainId: "1" }),
      );

      document = reducer(
        document,
        issue({ invoiceNo: "INV-1", dateIssued: ISSUED_AT }),
      );

      expect(document.operations.global[2].error).toBeUndefined();
      expect(document.state.global.status).toBe("ISSUED");
    });
  });

  describe("resetOperation", () => {
    it("errors on invalid transition (cannot reset from ISSUED)", () => {
      const document = reducer(issuedDocument(), reset());

      expect(document.operations.global[1].error).toBe(
        "Invalid transition from ISSUED to DRAFT",
      );
      expect(document.state.global.status).toBe("ISSUED");
    });
  });

  describe("rejectOperation", () => {
    it("errors when id is missing", () => {
      const document = reducer(
        issuedDocument(),
        reject({ id: "", reason: "bad invoice", final: false }),
      );

      expect(document.operations.global[1].error).toBe(
        "Reason, ID and final are required",
      );
      expect(document.state.global.status).toBe("ISSUED");
    });

    it("errors when reason is missing (id present)", () => {
      const document = reducer(
        issuedDocument(),
        reject({ id: "rejection-1", reason: "", final: false }),
      );

      expect(document.operations.global[1].error).toBe(
        "Reason, ID and final are required",
      );
      expect(document.state.global.status).toBe("ISSUED");
    });

    it("errors on invalid transition (cannot reject from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        reject({ id: "rejection-1", reason: "bad invoice", final: false }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to REJECTED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });

    it("records a final rejection", () => {
      const document = reducer(
        issuedDocument(),
        reject({ id: "rejection-1", reason: "fraud", final: true }),
      );

      expect(document.state.global.status).toBe("REJECTED");
      expect(document.state.global.rejections).toEqual([
        { id: "rejection-1", reason: "fraud", final: true },
      ]);
    });
  });

  describe("acceptOperation", () => {
    it("errors when payAfter is missing", () => {
      const document = reducer(issuedDocument(), accept({}));

      expect(document.operations.global[1].error).toBe(
        "Pay after is required",
      );
      expect(document.state.global.status).toBe("ISSUED");
    });

    it("errors on invalid transition (cannot accept from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        accept({ payAfter: PAY_AFTER }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to ACCEPTED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });
  });

  describe("reinstateOperation", () => {
    it("errors when the invoice has a final rejection", () => {
      let document = issuedDocument();
      document = reducer(
        document,
        reject({ id: "rejection-1", reason: "fraud", final: true }),
      );
      expect(document.state.global.status).toBe("REJECTED");

      const updated = reducer(document, reinstate());

      expect(updated.operations.global[2].error).toBe(
        "Cannot reinstate an invoice that has been rejected",
      );
      expect(updated.state.global.status).toBe("REJECTED");
    });

    it("errors on invalid transition (cannot reinstate from ACCEPTED)", () => {
      const document = reducer(acceptedDocument(), reinstate());

      expect(document.operations.global[2].error).toBe(
        "Invalid transition from ACCEPTED to ISSUED",
      );
      expect(document.state.global.status).toBe("ACCEPTED");
    });

    it("reinstates a non-final rejection back to ISSUED", () => {
      let document = issuedDocument();
      document = reducer(
        document,
        reject({ id: "rejection-1", reason: "missing details", final: false }),
      );

      document = reducer(document, reinstate());

      expect(document.operations.global[2].error).toBeUndefined();
      expect(document.state.global.status).toBe("ISSUED");
    });
  });

  describe("schedulePaymentOperation", () => {
    it("errors when id is missing", () => {
      const document = reducer(
        acceptedDocument(),
        schedulePayment({ id: "", processorRef: "processor-ref-1" }),
      );

      expect(document.operations.global[2].error).toBe(
        "ID and processorRef are required",
      );
      expect(document.state.global.status).toBe("ACCEPTED");
    });

    it("errors when processorRef is missing (id present)", () => {
      const document = reducer(
        acceptedDocument(),
        schedulePayment({ id: "payment-1", processorRef: "" }),
      );

      expect(document.operations.global[2].error).toBe(
        "ID and processorRef are required",
      );
      expect(document.state.global.status).toBe("ACCEPTED");
    });

    it("errors on invalid transition (cannot schedule payment from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        schedulePayment({ id: "payment-1", processorRef: "processor-ref-1" }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to PAYMENTSCHEDULED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });

    it("records the paymentDate when provided", () => {
      const document = reducer(
        acceptedDocument(),
        schedulePayment({
          id: "payment-1",
          processorRef: "processor-ref-1",
          paymentDate: "2024-02-15T00:00:00.000Z",
        }),
      );

      expect(document.state.global.payments[0].paymentDate).toBe(
        "2024-02-15T00:00:00.000Z",
      );
    });
  });

  describe("reapprovePaymentOperation", () => {
    it("errors on invalid transition (cannot reapprove from DRAFT)", () => {
      const document = reducer(utils.createDocument(), reapprovePayment());

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to ACCEPTED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });
  });

  describe("registerPaymentTxOperation", () => {
    it("errors on invalid transition (cannot register payment tx from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        registerPaymentTx({
          id: "payment-1",
          txRef: "tx-ref-1",
          timestamp: "2024-03-01T00:00:00.000Z",
        }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to PAYMENTSENT",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });

    it("errors when no matching payment is found (status is still updated, since the mutation happens before the lookup)", () => {
      const document = reducer(
        scheduledDocument(),
        registerPaymentTx({
          id: "does-not-exist",
          txRef: "tx-ref-1",
          timestamp: "2024-03-01T00:00:00.000Z",
        }),
      );

      expect(document.operations.global[3].error).toBe("Payment not found");
      // NOTE: unlike the other guard checks in this reducer, the status
      // mutation happens *before* the payment lookup, so it is not rolled
      // back when the lookup fails.
      expect(document.state.global.status).toBe("PAYMENTSENT");
      // txnRef keeps its schedulePayment-time initial value ("") since the
      // lookup for the matching payment failed before it could be updated.
      expect(document.state.global.payments[0].txnRef).toBe("");
    });
  });

  describe("reportPaymentIssueOperation", () => {
    it("errors when id is missing", () => {
      const document = reducer(
        sentDocument(),
        reportPaymentIssue({ id: "", issue: "chargeback" }),
      );

      expect(document.operations.global[4].error).toBe(
        "ID and issue are required",
      );
      expect(document.state.global.status).toBe("PAYMENTSENT");
    });

    it("errors when issue is missing (id present)", () => {
      const document = reducer(
        sentDocument(),
        reportPaymentIssue({ id: "payment-1", issue: "" }),
      );

      expect(document.operations.global[4].error).toBe(
        "ID and issue are required",
      );
      expect(document.state.global.status).toBe("PAYMENTSENT");
    });

    it("errors on invalid transition (cannot report payment issue from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        reportPaymentIssue({ id: "payment-1", issue: "chargeback" }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to PAYMENTISSUE",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });

    it("errors when no matching payment is found (status is still updated)", () => {
      const document = reducer(
        sentDocument("payment-1"),
        reportPaymentIssue({ id: "does-not-exist", issue: "chargeback" }),
      );

      expect(document.operations.global[4].error).toBe("Payment not found");
      expect(document.state.global.status).toBe("PAYMENTISSUE");
      expect(document.state.global.payments[0].issue).toBe("");
    });
  });

  describe("confirmPaymentOperation", () => {
    it("errors when id is missing", () => {
      const document = reducer(
        sentDocument(),
        confirmPayment({ id: "", amount: 100 }),
      );

      expect(document.operations.global[4].error).toBe(
        "ID and amount are required",
      );
      expect(document.state.global.status).toBe("PAYMENTSENT");
    });

    it("errors when amount is falsy (zero), even though id is present", () => {
      const document = reducer(
        sentDocument(),
        confirmPayment({ id: "payment-1", amount: 0 }),
      );

      expect(document.operations.global[4].error).toBe(
        "ID and amount are required",
      );
      expect(document.state.global.status).toBe("PAYMENTSENT");
    });

    it("errors on invalid transition (cannot confirm payment from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        confirmPayment({ id: "payment-1", amount: 100 }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to PAYMENTRECEIVED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });

    it("errors when no matching payment is found (status is still updated)", () => {
      const document = reducer(
        sentDocument(),
        confirmPayment({ id: "does-not-exist", amount: 100 }),
      );

      expect(document.operations.global[4].error).toBe("Payment not found");
      expect(document.state.global.status).toBe("PAYMENTRECEIVED");
      expect(document.state.global.payments[0].confirmed).toBe(false);
    });
  });

  describe("closePaymentOperation", () => {
    it("errors when closureReason is missing", () => {
      const document = reducer(acceptedDocument(), closePayment({}));

      expect(document.operations.global[2].error).toBe(
        "Closure reason is required",
      );
      expect(document.state.global.status).toBe("ACCEPTED");
    });

    it("errors on invalid transition (cannot close payment from DRAFT)", () => {
      const document = reducer(
        utils.createDocument(),
        closePayment({ closureReason: "CANCELLED" }),
      );

      expect(document.operations.global[0].error).toBe(
        "Invalid transition from DRAFT to PAYMENTCLOSED",
      );
      expect(document.state.global.status).toBe("DRAFT");
    });
  });
});
