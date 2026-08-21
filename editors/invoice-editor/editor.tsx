import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  type InvoiceAction,
  type InvoiceDocument,
  type InvoiceLineItem,
  type Status,
  actions,
} from "document-models/invoice";
import { LegalEntityForm } from "./legalEntity/legalEntity.js";
import { LineItemsTable } from "./lineItems.js";
import PDFUploader from "./ingestPDF.js";
import PDFReviewModal from "./components/PDFReviewModal.js";
import { SelectField } from "./components/selectField.js";
import { formatNumber } from "./utils/utils.js";
import {
  Textarea,
  DatePicker,
  TextInput,
  Select,
} from "@powerhousedao/document-engineering/ui";
import { focusNextOnEnter, toInputWarnings } from "./utils/inputHelpers.js";
import { canEditInvoice } from "./utils/invoicePermissions.js";
import { ReadOnlyRegion } from "./components/readOnlyRegion.js";
import { PartySummaryCard } from "./components/partySummaryCard.js";
import { LineItemsCompact } from "./components/lineItemsCompact.js";
import { PdfPane } from "./components/pdfPane.js";
import { SplitPane } from "./components/splitPane.js";
import { PartyFormModal } from "./components/partyFormModal.js";
import ConfirmationModal from "./components/confirmationModal.js";
import {
  ClosePaymentModalContent,
  ConfirmPaymentModalContent,
  FinalRejectionModalContent,
  IssueInvoiceModalContent,
  RegisterPaymentTxModalContent,
  RejectInvoiceModalContent,
  ReportPaymentIssueModalContent,
  SchedulePaymentModalContent,
} from "./components/statusModalComponents.js";
import { InvoiceStateSchema } from "../../document-models/invoice/v1/gen/schema/zod.js";
import { useSelectedInvoiceDocument } from "document-models/invoice";
import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import {
  type DocumentDispatch,
  usePHToast,
} from "@powerhousedao/reactor-browser";
import {
  dateToDatetime,
  datetimeToDate,
  isFiatCurrency,
  currencyList,
} from "./utils/utils.js";
import { useLineItemTotals } from "./hooks/useLineItemTotals.js";
import { useInvoiceValidation } from "./hooks/useInvoiceValidation.js";
import { useStatusWorkflow } from "./hooks/useStatusWorkflow.js";
import { useDropdown } from "./hooks/useDropdown.js";
import { usePdfReview } from "./hooks/usePdfReview.js";
import { useSyncedField } from "./hooks/useSyncedField.js";
import { useInvoiceActions } from "./hooks/useInvoiceActions.js";
import { useAttachmentViewer } from "./hooks/useAttachmentViewer.js";
import type { ValidationResult } from "./validation/validationManager.js";

// Below this viewport width the compare view's two panes are each too narrow
// to read, so the uploaded PDF opens in the modal instead. Declared after all
// imports on purpose: interleaved with them, bundlers hoist the imports and
// this binding can still be in its temporal dead zone on first render.
const SPLIT_MIN_WIDTH = 1000;

// All shared utils (formatNumber, isFiatCurrency, dateToDatetime, datetimeToDate, etc.)
// are now imported from ./utils/utils.js (Phase 1 consolidation)

/** True when any of the supplied validations has failed. */
function hasInvalid(...results: (ValidationResult | null)[]): boolean {
  return results.some((result) => result !== null && !result.isValid);
}

export default function Editor() {
  const [doc, dispatch] = useSelectedInvoiceDocument() as [
    InvoiceDocument | undefined,
    DocumentDispatch<InvoiceAction>,
  ];
  const state = doc?.state.global;
  const toast = usePHToast();

  // Derived early (must be before hooks that use it, per rules)
  const fiatMode = isFiatCurrency(state?.currency ?? "");

  // The stored base-invoice attachment ref (null when none attached). Drives the
  // "Upload File" ↔ "View Uploaded Invoice" button and persists across reloads.
  const baseInvoiceRef = state?.baseInvoice ?? null;
  // Invoice content (fields, parties, line items, attachments) may only be
  // changed while DRAFT/REJECTED. Workflow controls — status, payments,
  // accounting tags, export — stay live in every status. Enforced for real by
  // the reducers; this only avoids offering edits that would be rejected.
  const canEdit = state ? canEditInvoice(state.status) : false;

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS

  // Initialize hooks with safe defaults that don't depend on state being available
  const uploadDropdown = useDropdown();
  const exportDropdown = useDropdown();

  // Which party form is open. The forms are modals so the editor opens on a
  // summary of both parties rather than two full-height forms.
  const [openParty, setOpenParty] = useState<"issuer" | "payer" | null>(null);

  // Side-by-side compare view. Below SPLIT_MIN_WIDTH the two panes are each too
  // narrow to be worth reading, so "View Uploaded Invoice" keeps its original
  // modal behaviour instead.
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isWideEnough, setIsWideEnough] = useState(
    () => typeof window === "undefined" || window.innerWidth >= SPLIT_MIN_WIDTH,
  );

  useEffect(() => {
    const onResize = () =>
      setIsWideEnough(window.innerWidth >= SPLIT_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Shrinking the window while split is open drops back to the modal rather
  // than leaving two unusable slivers. The object URL is untouched, so the
  // modal picks up the same PDF.
  useEffect(() => {
    if (!isWideEnough) setIsSplitOpen(false);
  }, [isWideEnough]);

  // PDF review + export logic extracted to hook (following vercel-react-best-practices:
  // extract complex side-effecty logic, isolate transient review state)
  const pdf = usePdfReview(fiatMode, state, toast, dispatch);

  // Reusable attachment reader for previewing the stored base invoice PDF.
  const viewer = useAttachmentViewer();

  /**
   * "View Uploaded Invoice" is a toggle, not a one-way open.
   *
   * Wide viewports get the side-by-side compare view; narrow ones fall back to
   * the original modal. Closing releases the object URL via `viewer.close()`
   * so we are not holding blob bytes for a pane nobody is looking at.
   */
  const handleViewUpload = useCallback(() => {
    if (!baseInvoiceRef) return;

    if (isSplitOpen) {
      setIsSplitOpen(false);
      viewer.close();
      return;
    }

    if (isWideEnough) setIsSplitOpen(true);
    void viewer.view(baseInvoiceRef);
  }, [baseInvoiceRef, isSplitOpen, isWideEnough, viewer]);

  const closeSplit = useCallback(() => {
    setIsSplitOpen(false);
    viewer.close();
  }, [viewer]);
  useEffect(() => {
    if (viewer.error) {
      toast?.("Couldn't load the uploaded invoice PDF.", { type: "error" });
    }
  }, [viewer.error, toast]);

  // Synced input fields isolated (reduces effects in main component, follows skill guidance on effects)
  const invoiceNoField = useSyncedField(state?.invoiceNo, (v) =>
    dispatch(actions.editInvoice({ invoiceNo: v })),
  );
  const notesField = useSyncedField(state?.notes, (v) =>
    dispatch(actions.editInvoice({ notes: v })),
  );

  // Validation state consolidated into hook (streamlined)
  const { validations, validateForStatus, setField } =
    useInvoiceValidation(isFiatCurrency);

  // Modal and status workflow state + handlers now in dedicated hook
  const {
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
    closeModal: setActiveModalToNull,
    handleContinue,
  } = useStatusWorkflow(
    state,
    dispatch,
    invoiceNoField.value,
    invoiceNoField.setValue,
  );

  // Use dedicated hook for line item editing + live adjusted totals
  // (extracted for readability and easier future extension)
  const { itemsTotalTaxExcl, itemsTotalTaxIncl, onEditingItemChange } =
    useLineItemTotals(state?.lineItems);

  // Invoice actions/handlers extracted (following best practices for extraction)
  const {
    handleFileUpload,
    handleExportUBL,
    handleStatusChange,
    handleCurrencyChange,
  } = useInvoiceActions({
    state,
    dispatch,
    toast,
    pdf,
    validateForStatus,
    openModal,
    setRejectReason,
    setFinalReason,
  });

  // Dropdown outside-click logic moved to useDropdown hook for cleaner code.

  // Totals (and editing overlay management) provided by useLineItemTotals hook above.

  // Dynamic property check based on the actual schema
  let missingProperties: string[] = [];
  try {
    const schema = InvoiceStateSchema();
    const expectedProperties = Object.keys(schema.shape).filter(
      (prop) => prop !== "__typename",
    );
    if (state) {
      missingProperties = expectedProperties.filter((prop) => !(prop in state));
    }
  } catch (_error) {
    console.error("Error checking schema properties:", _error);
  }

  if (missingProperties.length > 0) {
    // Show error message for missing properties
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md mx-auto text-center p-8 bg-card rounded-lg shadow-lg border border-destructive/30">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/15 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              ></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Document Schema Mismatch
          </h2>
          <p className="text-muted-foreground mb-4">
            The current document structure doesn't match the expected schema.
            This usually happens when using an outdated document model.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Please create a new document using the latest document model to
            ensure compatibility.
          </p>
          <details className="text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              View missing properties
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32 text-foreground">
              {JSON.stringify(missingProperties, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  // NOW ALL HOOKS ARE CALLED - SAFE TO DO CONDITIONAL RETURNS
  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md mx-auto text-center p-8 bg-card rounded-lg shadow-lg border border-destructive/30">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/15 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              ></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Document Schema Mismatch
          </h2>
          <p className="text-muted-foreground mb-4">
            The current document structure doesn't match the expected schema.
            This usually happens when using an outdated document model.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Please create a new document using the latest document model to
            ensure compatibility.
          </p>
        </div>
      </div>
    );
  }

  const STATUS_OPTIONS: Status[] = [
    "DRAFT",
    "ISSUED",
    "CANCELLED",
    "ACCEPTED",
    "REJECTED",
    "PAYMENTSCHEDULED",
    "PAYMENTSENT",
    "PAYMENTISSUE",
    "PAYMENTRECEIVED",
    "PAYMENTCLOSED",
  ];

  // Handlers now from useInvoiceActions hook (extracted for cleaner main component)

  // A hidden form hides its own validation warnings, so the summary cards
  // carry a marker when the party's fields failed validation.
  const issuerNeedsAttention = hasInvalid(
    validations.mainCountry,
    validations.streetAddress,
    validations.city,
    validations.postalCode,
    validations.wallet,
    validations.chain,
    validations.iban,
    validations.bic,
    validations.bankName,
    validations.bankCountry,
    validations.routingNumber,
    validations.accountNumber,
  );
  const payerNeedsAttention = hasInvalid(validations.payerEmail);

  // Modal content map
  const modalContentMap: Record<string, ReactNode> = {
    issueInvoice: (
      <IssueInvoiceModalContent
        invoiceNoInput={invoiceNoField.value}
        setInvoiceNoInput={invoiceNoField.setValue}
        state={state}
        dispatch={dispatch}
        setWarning={setModalWarning}
      />
    ),
    rejectInvoice: (
      <RejectInvoiceModalContent
        state={state}
        dispatch={dispatch}
        setWarning={setModalWarning}
        setRejectReason={setRejectReason}
        rejectReason={rejectReason}
        setFinalReason={setFinalReason}
        finalReason={finalReason}
      />
    ),
    finalRejection: <FinalRejectionModalContent rejectReason={rejectReason} />,
    schedulePayment: (
      <SchedulePaymentModalContent
        paymentRef={paymentRef}
        setPaymentRef={setPaymentRef}
      />
    ),
    closePayment: (
      <ClosePaymentModalContent
        closureReason={closureReason}
        setClosureReason={setClosureReason}
      />
    ),
    registerPayment: (
      <RegisterPaymentTxModalContent
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        txnRef={txnRef}
        setTxnRef={setTxnRef}
      />
    ),
    reportPaymentIssue: (
      <ReportPaymentIssueModalContent
        paymentIssue={paymentIssue}
        setPaymentIssue={setPaymentIssue}
      />
    ),
    confirmPayment: (
      <ConfirmPaymentModalContent
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        payments={state.payments}
      />
    ),
  };

  const modalHeaders: Record<string, ReactNode> = {
    issueInvoice: <div>Issue Invoice</div>,
    rejectInvoice: <div>Reject Invoice</div>,
    finalRejection: <div>Invoice Rejected</div>,
    schedulePayment: <div>Schedule Payment</div>,
    closePayment: <div>Close Payment</div>,
    registerPayment: <div>Register Payment</div>,
    reportPaymentIssue: <div>Report Payment Issue</div>,
    confirmPayment: <div>Confirm Payment</div>,
  };

  const modalContinueLabels: Record<string, string> = {
    issueInvoice: "Confirm",
    rejectInvoice: "Confirm",
    schedulePayment: "Confirm",
    closePayment: "Confirm",
    registerPayment: "Confirm",
    reportPaymentIssue: "Confirm",
  };

  // Rendered either full-width or as the left half of the compare view, so
  // it is held as a value rather than inlined twice. The section grids are
  // already `auto-fit`, so they collapse to one column in the narrow pane
  // without extra breakpoints.
  const invoiceBody = (
    <>
        {/* Invoice dates. These are invoice-level fields, not party details,
            so they stay on the page rather than moving into the party modals. */}
        <ReadOnlyRegion editable={canEdit}>
          <div
            className="mb-6 grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            }}
          >
            <div className="relative isolate">
              <label className="block mb-1 text-sm text-foreground">
                Issue Date:
              </label>
              <div className="w-full">
                <DatePicker
                  name="issueDate"
                  dateFormat="YYYY-MM-DD"
                  className="w-full bg-background border border-border"
                  onChange={(e) => {
                    const dateOnly = e.target.value.split("T")[0];
                    const datetime = dateToDatetime(dateOnly);
                    dispatch(
                      actions.editInvoice({
                        dateIssued: datetime,
                      }),
                    );
                  }}
                  value={datetimeToDate(state.dateIssued)}
                  autoClose={true}
                />
              </div>
            </div>
            <div className="relative isolate">
              <label className="block mb-1 text-sm text-foreground">
                Delivery Date:
              </label>
              <div className="w-full">
                <DatePicker
                  name="deliveryDate"
                  dateFormat="YYYY-MM-DD"
                  className="w-full bg-background border border-border"
                  onChange={(e) => {
                    const dateOnly = e.target.value.split("T")[0];
                    const datetime = dateToDatetime(dateOnly);
                    if (datetime !== state.dateDelivered) {
                      dispatch(
                        actions.editInvoice({ dateDelivered: datetime }),
                      );
                    }
                  }}
                  value={datetimeToDate(state.dateDelivered)}
                  autoClose={true}
                />
              </div>
            </div>
            <div className="relative isolate">
              <label className="block mb-1 text-sm text-foreground">
                Due Date:
              </label>
              <div className="w-full">
                <DatePicker
                  name="dateDue"
                  dateFormat="YYYY-MM-DD"
                  className="w-full bg-background border border-border"
                  onChange={(e) => {
                    const dateOnly = e.target.value.split("T")[0];
                    const datetime = dateToDatetime(dateOnly);
                    dispatch(
                      actions.editInvoice({
                        dateDue: datetime,
                      }),
                    );
                  }}
                  value={datetimeToDate(state.dateDue)}
                  autoClose={true}
                />
              </div>
            </div>
          </div>
        </ReadOnlyRegion>

        {/* Party summaries. The full forms are in the modals at the end of the
            component, opened from these cards. */}
        <div
          className="mb-6 grid gap-6"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
          }}
        >
          <PartySummaryCard
            title="Issuer"
            entity={state.issuer}
            editable={canEdit}
            needsAttention={issuerNeedsAttention}
            onEdit={() => setOpenParty("issuer")}
          />
          <PartySummaryCard
            title="Payer"
            entity={state.payer}
            editable={canEdit}
            needsAttention={payerNeedsAttention}
            onEdit={() => setOpenParty("payer")}
          />
        </div>

        {/* Line items. The eight-column table only fits a half-width pane by
            scrolling sideways, so the compare view gets dense rows instead —
            description and total, with everything else behind Edit. */}
        {isSplitOpen ? (
          <LineItemsCompact
            lineItems={state.lineItems}
            currency={state.currency}
            editable={canEdit}
            onAddItem={(item) => dispatch(actions.addLineItem(item))}
            onUpdateItem={(item) => dispatch(actions.editLineItem(item))}
            onDeleteItem={(input) => dispatch(actions.deleteLineItem(input))}
          />
        ) : (
          <div className="mb-8">
            <LineItemsTable
              currency={state.currency}
              lineItems={state.lineItems.map((item: InvoiceLineItem) => ({
                ...item,
                lineItemTag: item.lineItemTag ?? [],
              }))}
              onAddItem={(item) => dispatch(actions.addLineItem(item))}
              onDeleteItem={(input) => dispatch(actions.deleteLineItem(input))}
              onUpdateCurrency={(input) => {
                dispatch(actions.editInvoice(input));
              }}
              onUpdateItem={(item) => dispatch(actions.editLineItem(item))}
              onEditingItemChange={onEditingItemChange}
              dispatch={dispatch}
              paymentAccounts={state.invoiceTags ?? []}
            />
          </div>
        )}

        {/* Totals Section */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          }}
        >
          <div>
            <div className="">
              <label className="mb-1 block text-sm font-medium text-foreground">
                Notes
              </label>
              <ReadOnlyRegion editable={canEdit}>
                <Textarea
                  placeholder="Add notes"
                  autoExpand={true}
                  rows={4}
                  multiline={true}
                  value={notesField.value}
                  onBlur={() => notesField.commit()}
                  onChange={(e) => {
                    notesField.setValue(e.target.value);
                  }}
                  className="p-2 mb-4 bg-card text-foreground placeholder:text-muted-foreground border-border"
                />
              </ReadOnlyRegion>
            </div>
          </div>
          <div>
            <div className="rounded-lg border border-border bg-muted p-6 shadow-sm h-32">
              <div className="">
                <div className="flex justify-between text-foreground">
                  <span className="font-medium">Subtotal (excl. tax):</span>
                  <span>
                    {formatNumber(itemsTotalTaxExcl)} {state.currency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-6 text-lg font-bold text-foreground">
                  <span>Total (incl. tax):</span>
                  <span>
                    {formatNumber(itemsTotalTaxIncl)} {state.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {activeModal && (
          <ConfirmationModal
            open={!!activeModal}
            header={modalHeaders[activeModal]}
            onCancel={setActiveModalToNull}
            onContinue={handleContinue}
            continueLabel={modalContinueLabels[activeModal]}
            continueDisabled={modalWarning}
          >
            {modalContentMap[activeModal]}
          </ConfirmationModal>
        )}
    </>
  );

  return (
    <div className="w-full min-h-full flex flex-col invoice-editor">
      <DocumentToolbar />
      {/* Top navbar. Full-bleed so its bottom border reaches both editor
          edges, with the controls held to the same max-w-7xl column as the
          content below. Two clusters: identity and workflow controls left,
          file actions right. */}
      <div className="w-full border-b border-border">
        <div className="mx-auto w-full max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Identity and workflow controls: invoice title, number,
                status, currency. File actions sit in the right-hand
                cluster so they stay pushed to the trailing edge. */}
            <div className="flex items-center gap-3">
              <h1 className="flex h-8 items-center text-md font-bold whitespace-nowrap text-foreground">
                Invoice
              </h1>
              <ReadOnlyRegion editable={canEdit} className="min-w-[200px]">
                <TextInput
                  className="h-8 text-xs border-border"
                  placeholder={"Add invoice number"}
                  value={invoiceNoField.value}
                  onChange={(e) => {
                    const val = e.target.value;
                    invoiceNoField.setValue(val);
                    // Clear previous error if now has a value (so stale warning disappears from input)
                    // Do NOT dispatch here — dispatch only onBlur per project rules (see CLAUDE.md)
                    if (
                      val &&
                      val.trim() !== "" &&
                      validations.invoice &&
                      !validations.invoice.isValid
                    ) {
                      setField("invoice", {
                        isValid: true,
                        message: "",
                        severity: "none",
                      });
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (state?.invoiceNo !== val) {
                      dispatch(actions.editInvoice({ invoiceNo: val }));
                    }
                  }}
                  warnings={toInputWarnings(validations.invoice)}
                  onKeyDown={focusNextOnEnter}
                />
              </ReadOnlyRegion>

              {/* Status stays editable in every status — it is the workflow
                  control that unlocks or locks everything else. */}
              <SelectField
                options={STATUS_OPTIONS}
                value={state.status}
                onChange={(value) => handleStatusChange(value as Status)}
              />

              <ReadOnlyRegion editable={canEdit}>
                {/* Bounded width on purpose: w-full made the currency select
                    span the row and wrap onto a second line. */}
                <div className="w-36">
                  <Select
                    options={currencyList.map((c) => ({
                      label: c.ticker,
                      value: c.ticker,
                    }))}
                    value={state.currency}
                    placeholder="Currency"
                    searchable
                    onChange={(value) =>
                      handleCurrencyChange(
                        (Array.isArray(value) ? value[0] : value) || "",
                      )
                    }
                    warnings={toInputWarnings(validations.currency)}
                    className="h-8 text-xs text-foreground border-border"
                    contentClassName="w-48 bg-popover border border-border"
                  />
                </div>
              </ReadOnlyRegion>
            </div>

            {/* File actions, pushed right: export is second from right,
                view/upload sits far right. The upload slot renders either
                "Upload File" or "View Uploaded Invoice" - never both. */}
            <div className="flex items-center gap-3">
              {/* Export Dropdown Button */}
              <div className="relative" ref={exportDropdown.ref}>
                <button
                  onClick={exportDropdown.toggle}
                  className="inline-flex items-center h-8 px-3 rounded text-xs border border-input bg-background text-foreground hover:bg-accent font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  Export File
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </button>

                {exportDropdown.isOpen && (
                  <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-popover text-popover-foreground border border-border">
                    <div
                      className="py-1"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <button
                        onClick={() => {
                          handleExportUBL();
                          exportDropdown.close();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent cursor-pointer"
                      >
                        Export UBL
                      </button>
                      <button
                        onClick={() => {
                          pdf.handleExportPDF();
                          exportDropdown.close();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent cursor-pointer"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload File  ↔  View Uploaded Invoice (once a base invoice is attached) */}
              {baseInvoiceRef ? (
                <button
                  onClick={handleViewUpload}
                  aria-pressed={isSplitOpen}
                  disabled={viewer.isLoading}
                  className="inline-flex items-center h-8 px-3 rounded text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {viewer.isLoading
                    ? "Loading…"
                    : isSplitOpen
                      ? "Hide Uploaded Invoice"
                      : "View Uploaded Invoice"}
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    ></path>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    ></path>
                  </svg>
                </button>
              ) : canEdit ? (
                <div className="relative" ref={uploadDropdown.ref}>
                  <button
                    onClick={uploadDropdown.toggle}
                    className="inline-flex items-center h-8 px-3 rounded text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors whitespace-nowrap cursor-pointer"
                    disabled={pdf.isPdfLoading}
                  >
                    {pdf.isPdfLoading ? "Processing..." : "Upload File"}
                    <svg
                      className="w-4 h-4 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </button>

                  {uploadDropdown.isOpen && !pdf.isPdfLoading && (
                    <div className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-popover text-popover-foreground border border-border">
                      <div
                        className="py-1"
                        role="menu"
                        aria-orientation="vertical"
                      >
                        <label className="block px-4 py-2 text-sm text-foreground hover:bg-accent cursor-pointer">
                          Upload UBL
                          <input
                            accept=".xml"
                            className="hidden"
                            onChange={(e) => {
                              handleFileUpload(e);
                              uploadDropdown.close();
                            }}
                            type="file"
                          />
                        </label>
                        <PDFUploader
                          changeDropdownOpen={(open) => {
                            if (!open) uploadDropdown.close();
                            else uploadDropdown.toggle();
                          }}
                          onUploadComplete={pdf.handlePdfUploadComplete}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isSplitOpen && viewer.url !== null ? (
        // `fillViewport` bounds the split to the remaining window height, so
        // each side scrolls inside its own box. Without it a multi-page PDF
        // stretches the pane and drags the invoice editor down with it.
        <SplitPane
          fillViewport
          storageKey="invoice-editor:compare-split-pct"
          left={<div className="w-full px-4 py-6">{invoiceBody}</div>}
          right={
            <PdfPane
              url={viewer.url}
              fileName={state.invoiceNo}
              onClose={closeSplit}
            />
          }
        />
      ) : (
        <div className="flex-1 max-w-7xl mx-auto w-full mt-6 px-4 pb-8">
          {invoiceBody}
        </div>
      )}

      <PartyFormModal
        open={openParty === "issuer"}
        title="Issuer details"
        onClose={() => setOpenParty(null)}
      >
        <ReadOnlyRegion editable={canEdit}>
          <LegalEntityForm
            legalEntity={state.issuer}
            onChangeInfo={(input) => dispatch(actions.editIssuer(input))}
            onChangeBank={(input) => dispatch(actions.editIssuerBank(input))}
            onChangeWallet={(input) =>
              dispatch(actions.editIssuerWallet(input))
            }
            basicInfoDisabled={false}
            bankDisabled={!fiatMode}
            walletDisabled={fiatMode}
            currency={state.currency}
            status={state.status}
            walletvalidation={validations.wallet}
            chainvalidation={validations.chain}
            mainCountryValidation={validations.mainCountry}
            bankCountryValidation={validations.bankCountry}
            ibanvalidation={validations.iban}
            bicvalidation={validations.bic}
            banknamevalidation={validations.bankName}
            streetaddressvalidation={validations.streetAddress}
            cityvalidation={validations.city}
            postalcodevalidation={validations.postalCode}
            payeremailvalidation={validations.payerEmail}
            routingNumbervalidation={validations.routingNumber}
            accountNumbervalidation={validations.accountNumber}
          />
        </ReadOnlyRegion>
      </PartyFormModal>

      <PartyFormModal
        open={openParty === "payer"}
        title="Payer details"
        onClose={() => setOpenParty(null)}
      >
        <ReadOnlyRegion editable={canEdit}>
          <LegalEntityForm
            bankDisabled
            legalEntity={state.payer}
            onChangeInfo={(input) => dispatch(actions.editPayer(input))}
            currency={state.currency}
            status={state.status}
            payeremailvalidation={validations.payerEmail}
          />
        </ReadOnlyRegion>
      </PartyFormModal>

      <PDFReviewModal
        open={pdf.pdfReviewData !== null}
        base64Pdf={pdf.pdfBase64}
        fileName={pdf.pdfFileName}
        reviewData={pdf.pdfReviewData}
        onAccept={pdf.handlePdfAccept}
        onReject={pdf.handlePdfReject}
        isApplying={pdf.isApplyingPdf}
      />

      {/* Read-only preview of the stored base invoice PDF ("View Uploaded Invoice") */}
      <PDFReviewModal
        open={viewer.url !== null && !isSplitOpen}
        viewOnly
        pdfUrl={viewer.url}
        base64Pdf={null}
        fileName="Uploaded invoice"
        reviewData={null}
        onAccept={() => {}}
        onReject={viewer.close}
      />
    </div>
  );
}
