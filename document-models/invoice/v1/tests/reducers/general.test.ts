import { generateMock } from "document-model";
import {
  addPayment,
  editInvoice,
  EditInvoiceInputSchema,
  editIssuerWallet,
  editPaymentData,
  editStatus,
  reducer,
  setExportedData,
  utils,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

describe("GeneralOperations", () => {
  describe("editInvoice", () => {
    it("updates currency, invoiceNo and notes when provided", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        editInvoice({
          currency: "USD",
          invoiceNo: "INV-001",
          notes: "Thanks for your business",
        }),
      );

      expect(updated.state.global.currency).toBe("USD");
      expect(updated.state.global.invoiceNo).toBe("INV-001");
      expect(updated.state.global.notes).toBe("Thanks for your business");
      expect(updated.operations.global[0].error).toBeUndefined();
    });

    it("keeps existing currency/invoiceNo/notes when the fields are omitted (undefined)", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        editInvoice({
          currency: "EUR",
          invoiceNo: "INV-100",
          notes: "original notes",
        }),
      );

      // second edit omits currency/invoiceNo/notes entirely -> `??` keeps state
      document = reducer(document, editInvoice({}));

      expect(document.state.global.currency).toBe("EUR");
      expect(document.state.global.invoiceNo).toBe("INV-100");
      expect(document.state.global.notes).toBe("original notes");
    });

    it("keeps falsy-but-valid empty string currency/invoiceNo instead of falling back", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        editInvoice({ currency: "EUR", invoiceNo: "INV-100" }),
      );

      document = reducer(
        document,
        editInvoice({ currency: "", invoiceNo: "" }),
      );

      expect(document.state.global.currency).toBe("");
      expect(document.state.global.invoiceNo).toBe("");
    });

    it("documents existing `??` behavior: explicit null notes falls back to previous notes", () => {
      let document = utils.createDocument();
      document = reducer(document, editInvoice({ notes: "keep me" }));

      // `notes` uses `??`, so an explicit null (nullish) does NOT clear it -
      // it falls back to the previous value. This is existing reducer
      // behavior (not something this suite should "fix").
      document = reducer(document, editInvoice({ notes: null }));

      expect(document.state.global.notes).toBe("keep me");
    });

    describe("date fields (dateDue / dateIssued / dateDelivered)", () => {
      it("leaves dateDue unchanged when the input field is undefined", () => {
        let document = utils.createDocument();
        document = reducer(
          document,
          editInvoice({ dateDue: "2024-01-01T00:00:00.000Z" }),
        );

        document = reducer(document, editInvoice({ currency: "USD" }));

        expect(document.state.global.dateDue).toBe("2024-01-01T00:00:00.000Z");
      });

      it("clears dateDue to null when input is explicit null", () => {
        let document = utils.createDocument();
        document = reducer(
          document,
          editInvoice({ dateDue: "2024-01-01T00:00:00.000Z" }),
        );

        document = reducer(document, editInvoice({ dateDue: null }));

        expect(document.state.global.dateDue).toBeNull();
      });

      it("clears dateDue to null when input is a whitespace-only string", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editInvoice({ dateDue: "   " }));

        expect(updated.state.global.dateDue).toBeNull();
      });

      it("keeps an already-ISO datetime string as-is", () => {
        const document = utils.createDocument();

        const updated = reducer(
          document,
          editInvoice({ dateDue: "2024-05-10T12:30:00.000Z" }),
        );

        expect(updated.state.global.dateDue).toBe("2024-05-10T12:30:00.000Z");
      });

      it("converts a date-only string to midnight UTC datetime", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editInvoice({ dateDue: "2024-05-10" }));

        expect(updated.state.global.dateDue).toBe("2024-05-10T00:00:00.000Z");
      });

      it("leaves dateIssued unchanged when undefined, and converts when provided", () => {
        let document = utils.createDocument();
        document = reducer(document, editInvoice({ currency: "USD" }));
        expect(document.state.global.dateIssued).toBeNull();

        document = reducer(document, editInvoice({ dateIssued: "2024-02-02" }));
        expect(document.state.global.dateIssued).toBe(
          "2024-02-02T00:00:00.000Z",
        );

        // now omit dateIssued -> should remain unchanged
        document = reducer(document, editInvoice({ invoiceNo: "INV-9" }));
        expect(document.state.global.dateIssued).toBe(
          "2024-02-02T00:00:00.000Z",
        );
      });

      it("leaves dateDelivered unchanged when undefined, and clears with null when provided", () => {
        let document = utils.createDocument();
        document = reducer(
          document,
          editInvoice({ dateDelivered: "2024-03-03T00:00:00.000Z" }),
        );
        expect(document.state.global.dateDelivered).toBe(
          "2024-03-03T00:00:00.000Z",
        );

        // omit -> unchanged
        document = reducer(document, editInvoice({ invoiceNo: "INV-10" }));
        expect(document.state.global.dateDelivered).toBe(
          "2024-03-03T00:00:00.000Z",
        );

        // explicit null -> cleared
        document = reducer(document, editInvoice({ dateDelivered: null }));
        expect(document.state.global.dateDelivered).toBeNull();
      });
    });

    it("validates EditInvoiceInput via generated zod (all fields optional)", () => {
      const schema = EditInvoiceInputSchema();
      expect(schema.safeParse({}).success).toBe(true);
      expect(
        schema.safeParse({
          currency: "USD",
          dateDue: "2024-01-01",
          dateIssued: null,
          dateDelivered: "2024-01-01T00:00:00.000Z",
          invoiceNo: "INV-1",
          notes: null,
        }).success,
      ).toBe(true);
    });
  });

  describe("editStatus", () => {
    it("allows DRAFT -> DRAFT without requiring a wallet", () => {
      const document = utils.createDocument();
      expect(document.state.global.status).toBe("DRAFT");

      const updated = reducer(document, editStatus({ status: "DRAFT" }));

      expect(updated.state.global.status).toBe("DRAFT");
      expect(updated.operations.global[0].error).toBeUndefined();
    });

    it("allows DRAFT -> CANCELLED without requiring a wallet", () => {
      const document = utils.createDocument();

      const updated = reducer(document, editStatus({ status: "CANCELLED" }));

      expect(updated.state.global.status).toBe("CANCELLED");
      expect(updated.operations.global[0].error).toBeUndefined();
    });

    it("skips the wallet check entirely once status is no longer DRAFT", () => {
      let document = utils.createDocument();
      // move to CANCELLED first (allowed without a wallet)
      document = reducer(document, editStatus({ status: "CANCELLED" }));
      expect(document.state.global.status).toBe("CANCELLED");
      // issuer still has no wallet at all
      expect(document.state.global.issuer.paymentRouting).toBeNull();

      // from a non-DRAFT status, the wallet check is skipped regardless of
      // wallet presence
      const updated = reducer(document, editStatus({ status: "REJECTED" }));

      expect(updated.state.global.status).toBe("REJECTED");
      expect(updated.operations.global[1].error).toBeUndefined();
    });

    it("errors moving DRAFT -> ISSUED when the issuer has no wallet at all", () => {
      const document = utils.createDocument();

      const updated = reducer(document, editStatus({ status: "ISSUED" }));

      expect(updated.operations.global[0].error).toBe(
        "Issuer wallet address and chain must be set before moving out of DRAFT",
      );
      // state is unchanged
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("errors moving DRAFT -> ISSUED when wallet address is set but chainName and chainId are both empty", () => {
      let document = utils.createDocument();
      document = reducer(document, editIssuerWallet({ address: "0xabc123" }));
      expect(document.state.global.issuer.paymentRouting?.wallet).toEqual({
        address: "0xabc123",
        chainId: null,
        chainName: null,
        rpc: null,
      });

      const updated = reducer(document, editStatus({ status: "ISSUED" }));

      expect(updated.operations.global[1].error).toBe(
        "Issuer wallet address and chain must be set before moving out of DRAFT",
      );
      expect(updated.state.global.status).toBe("DRAFT");
    });

    it("allows DRAFT -> ISSUED when wallet address + chainName are set (chainId empty)", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        editIssuerWallet({ address: "0xabc123", chainName: "mainnet" }),
      );

      const updated = reducer(document, editStatus({ status: "ISSUED" }));

      expect(updated.operations.global[1].error).toBeUndefined();
      expect(updated.state.global.status).toBe("ISSUED");
    });

    it("allows DRAFT -> ISSUED when wallet address + chainId are set (chainName empty)", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        editIssuerWallet({ address: "0xabc123", chainId: "1" }),
      );

      const updated = reducer(document, editStatus({ status: "ISSUED" }));

      expect(updated.operations.global[1].error).toBeUndefined();
      expect(updated.state.global.status).toBe("ISSUED");
    });
  });

  describe("editPaymentData", () => {
    it("does nothing (no error) when no payment matches the given id", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        editPaymentData({ id: "missing-id", confirmed: false }),
      );

      expect(updated.state.global.payments).toEqual([]);
      expect(updated.operations.global[0].error).toBeUndefined();
    });

    it("updates all fields when the payment exists and values are provided", () => {
      let document = utils.createDocument();
      document = reducer(document, addPayment({ id: "P1", confirmed: true }));

      document = reducer(
        document,
        editPaymentData({
          id: "P1",
          processorRef: "REF-1",
          paymentDate: "2024-02-01T00:00:00.000Z",
          txnRef: "TXN-1",
          confirmed: true,
          issue: "none",
        }),
      );

      expect(document.state.global.payments[0]).toEqual({
        id: "P1",
        processorRef: "REF-1",
        paymentDate: "2024-02-01T00:00:00.000Z",
        txnRef: "TXN-1",
        confirmed: true,
        issue: "none",
        amount: 0,
      });
    });

    it("falls back to existing values when optional fields are omitted", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        addPayment({
          id: "P1",
          confirmed: true,
          processorRef: "REF-1",
          paymentDate: "2024-02-01T00:00:00.000Z",
          txnRef: "TXN-1",
          issue: "ok",
        }),
      );

      // only `id` and the required `confirmed` are provided; everything else
      // is omitted (undefined) and must fall back to the previous value
      document = reducer(
        document,
        editPaymentData({ id: "P1", confirmed: false }),
      );

      expect(document.state.global.payments[0]).toEqual({
        id: "P1",
        processorRef: "REF-1",
        paymentDate: "2024-02-01T00:00:00.000Z",
        txnRef: "TXN-1",
        confirmed: false,
        issue: "ok",
        amount: 0,
      });
    });

    it("keeps falsy-but-valid empty strings instead of falling back", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        addPayment({
          id: "P1",
          confirmed: true,
          processorRef: "REF-1",
          txnRef: "TXN-1",
          issue: "ok",
        }),
      );

      document = reducer(
        document,
        editPaymentData({
          id: "P1",
          confirmed: false,
          processorRef: "",
          txnRef: "",
          issue: "",
        }),
      );

      const payment = document.state.global.payments[0];
      expect(payment.processorRef).toBe("");
      expect(payment.txnRef).toBe("");
      expect(payment.issue).toBe("");
      expect(payment.confirmed).toBe(false);
    });
  });

  describe("addPayment", () => {
    it("adds a payment with defaults when optional fields are omitted", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        addPayment({ id: "P1", confirmed: true }),
      );

      expect(updated.state.global.payments).toEqual([
        {
          id: "P1",
          processorRef: "",
          paymentDate: null,
          txnRef: "",
          confirmed: true,
          issue: "",
          amount: 0,
        },
      ]);
    });

    it("adds a payment with all fields provided", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        addPayment({
          id: "P2",
          confirmed: false,
          processorRef: "REF-2",
          paymentDate: "2024-03-01T00:00:00.000Z",
          txnRef: "TXN-2",
          issue: "delayed",
        }),
      );

      expect(updated.state.global.payments).toEqual([
        {
          id: "P2",
          processorRef: "REF-2",
          paymentDate: "2024-03-01T00:00:00.000Z",
          txnRef: "TXN-2",
          confirmed: false,
          issue: "delayed",
          amount: 0,
        },
      ]);
    });

    it("keeps falsy-but-valid empty strings and false confirmed instead of falling back", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        addPayment({
          id: "P3",
          confirmed: false,
          processorRef: "",
          txnRef: "",
          issue: "",
        }),
      );

      expect(updated.state.global.payments[0]).toEqual({
        id: "P3",
        processorRef: "",
        paymentDate: null,
        txnRef: "",
        confirmed: false,
        issue: "",
        amount: 0,
      });
    });

    it("sets paymentDate to null when explicitly passed as null", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        addPayment({ id: "P4", confirmed: true, paymentDate: null }),
      );

      expect(updated.state.global.payments[0].paymentDate).toBeNull();
    });

    it("appends multiple payments preserving order", () => {
      let document = utils.createDocument();
      document = reducer(document, addPayment({ id: "P1", confirmed: true }));
      document = reducer(document, addPayment({ id: "P2", confirmed: false }));

      expect(document.state.global.payments.map((p) => p.id)).toEqual([
        "P1",
        "P2",
      ]);
    });
  });

  describe("setExportedData", () => {
    it("sets the exported timestamp and line items", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        setExportedData({
          timestamp: "2024-06-01T00:00:00.000Z",
          exportedLineItems: [["li-1", "li-2"]],
        }),
      );

      expect(updated.state.global.exported).toEqual({
        timestamp: "2024-06-01T00:00:00.000Z",
        exportedLineItems: [["li-1", "li-2"]],
      });
    });

    it("accepts an empty exportedLineItems array", () => {
      const document = utils.createDocument();

      const updated = reducer(
        document,
        setExportedData({
          timestamp: "2024-06-02T00:00:00.000Z",
          exportedLineItems: [],
        }),
      );

      expect(updated.state.global.exported).toEqual({
        timestamp: "2024-06-02T00:00:00.000Z",
        exportedLineItems: [],
      });
    });

    it("overwrites previously exported data", () => {
      let document = utils.createDocument();
      document = reducer(
        document,
        setExportedData({
          timestamp: "2024-06-01T00:00:00.000Z",
          exportedLineItems: [["li-1"]],
        }),
      );

      document = reducer(
        document,
        setExportedData({
          timestamp: "2024-07-01T00:00:00.000Z",
          exportedLineItems: [["li-2", "li-3"]],
        }),
      );

      expect(document.state.global.exported).toEqual({
        timestamp: "2024-07-01T00:00:00.000Z",
        exportedLineItems: [["li-2", "li-3"]],
      });
    });
  });

  describe("scenario: full invoice lifecycle", () => {
    it("chains editInvoice, editIssuerWallet, editStatus, addPayment, editPaymentData and setExportedData", () => {
      let document = utils.createDocument();

      // 1. edit invoice header info via a generated mock (dates overridden
      // for determinism as required by the project's testing conventions)
      const editInvoiceInput = generateMock(EditInvoiceInputSchema(), {
        dateDue: "2024-01-15T00:00:00.000Z",
        dateIssued: "2024-01-01T00:00:00.000Z",
        dateDelivered: "2024-01-02T00:00:00.000Z",
        currency: "USD",
        invoiceNo: "INV-2024-001",
        notes: "scenario invoice",
      });
      document = reducer(document, editInvoice(editInvoiceInput));
      expect(document.operations.global[0].error).toBeUndefined();
      expect(document.state.global.currency).toBe("USD");
      expect(document.state.global.invoiceNo).toBe("INV-2024-001");

      // 2. set up the issuer wallet so the invoice can leave DRAFT
      document = reducer(
        document,
        editIssuerWallet({ address: "0xdeadbeef", chainName: "mainnet" }),
      );
      expect(document.operations.global[1].error).toBeUndefined();

      // 3. move to ISSUED
      document = reducer(document, editStatus({ status: "ISSUED" }));
      expect(document.operations.global[2].error).toBeUndefined();
      expect(document.state.global.status).toBe("ISSUED");

      // 4. record a payment
      document = reducer(
        document,
        addPayment({ id: "PAY-1", confirmed: false, processorRef: "REF-1" }),
      );
      expect(document.operations.global[3].error).toBeUndefined();
      expect(document.state.global.payments).toHaveLength(1);

      // 5. update the payment once confirmed
      document = reducer(
        document,
        editPaymentData({
          id: "PAY-1",
          confirmed: true,
          txnRef: "TXN-999",
          paymentDate: "2024-02-01T00:00:00.000Z",
        }),
      );
      expect(document.operations.global[4].error).toBeUndefined();
      expect(document.state.global.payments[0]).toMatchObject({
        id: "PAY-1",
        confirmed: true,
        txnRef: "TXN-999",
        processorRef: "REF-1",
        paymentDate: "2024-02-01T00:00:00.000Z",
      });

      // 6. move to PAYMENTRECEIVED (already out of DRAFT, wallet check skipped)
      document = reducer(document, editStatus({ status: "PAYMENTRECEIVED" }));
      expect(document.operations.global[5].error).toBeUndefined();
      expect(document.state.global.status).toBe("PAYMENTRECEIVED");

      // 7. export the invoice line items
      document = reducer(
        document,
        setExportedData({
          timestamp: "2024-02-02T00:00:00.000Z",
          exportedLineItems: [["li-1", "li-2"]],
        }),
      );
      expect(document.operations.global[6].error).toBeUndefined();
      expect(document.state.global.exported.timestamp).toBe(
        "2024-02-02T00:00:00.000Z",
      );

      // final sanity check on the number of recorded operations
      expect(document.operations.global).toHaveLength(7);
    });
  });
});
