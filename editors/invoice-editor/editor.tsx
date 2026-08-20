import { type ReactNode, useEffect } from "react";
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

// All shared utils (formatNumber, isFiatCurrency, dateToDatetime, datetimeToDate, etc.)
// are now imported from ./utils/utils.js (Phase 1 consolidation)

export default function Editor() {
  const [doc, dispatch] = useSelectedInvoiceDocument() as [
    InvoiceDocument | undefined,
    DocumentDispatch<InvoiceAction>,
  ];
  const state = doc?.state.global;
  const toast = usePHToast();

  // Derived early (must be before hooks that use it, per rules)
  const fiatMode = isFiatCurrency(state?.currency ?? '');

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

  // PDF review + export logic extracted to hook (following vercel-react-best-practices:
  // extract complex side-effecty logic, isolate transient review state)
  const pdf = usePdfReview(fiatMode, state, toast, dispatch);

  // Reusable attachment reader for previewing the stored base invoice PDF.
  const viewer = useAttachmentViewer();
  useEffect(() => {
    if (viewer.error) {
      toast?.("Couldn't load the uploaded invoice PDF.", { type: "error" });
    }
  }, [viewer.error, toast]);

  // Synced input fields isolated (reduces effects in main component, follows skill guidance on effects)
  const invoiceNoField = useSyncedField(state?.invoiceNo, (v) =>
    dispatch(actions.editInvoice({ invoiceNo: v }))
  );
  const notesField = useSyncedField(state?.notes, (v) =>
    dispatch(actions.editInvoice({ notes: v }))
  );

  // Validation state consolidated into hook (streamlined)
  const { validations, validateForStatus, setField } = useInvoiceValidation(isFiatCurrency);

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
  } = useStatusWorkflow(state, dispatch, invoiceNoField.value, invoiceNoField.setValue);


  // Use dedicated hook for line item editing + live adjusted totals
  // (extracted for readability and easier future extension)
  const {
    itemsTotalTaxExcl,
    itemsTotalTaxIncl,
    onEditingItemChange,
  } = useLineItemTotals(state?.lineItems);

  // Invoice actions/handlers extracted (following best practices for extraction)
  const { handleFileUpload, handleExportUBL, handleStatusChange, handleCurrencyChange } =
    useInvoiceActions({
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

  return (
    <div className="w-full min-h-full flex flex-col invoice-editor">
      <DocumentToolbar />
      <div className="flex-1 max-w-7xl mx-auto w-full mt-4 px-4 pb-8">
        {/* Header Section */}
        <div className="mb-6">
          {/* Header - responsive via flex-wrap */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left side with Invoice title, input, and upload */}
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-bold whitespace-nowrap text-foreground">
                Invoice
              </h1>
              <ReadOnlyRegion editable={canEdit} className="min-w-[200px]">
                <TextInput
                  className="border-border"
                  placeholder={"Add invoice number"}
                  value={invoiceNoField.value}
                  onChange={(e) => {
                    const val = e.target.value;
                    invoiceNoField.setValue(val);
                    // Clear previous error if now has a value (so stale warning disappears from input)
                    // Do NOT dispatch here — dispatch only onBlur per project rules (see CLAUDE.md)
                    if (val && val.trim() !== "" && validations.invoice && !validations.invoice.isValid) {
                      setField("invoice", { isValid: true, message: "", severity: "none" });
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

              {/* Upload File  ↔  View Uploaded Invoice (once a base invoice is attached) */}
              {baseInvoiceRef ? (
                <button
                  onClick={() => void viewer.view(baseInvoiceRef)}
                  disabled={viewer.isLoading}
                  className="inline-flex items-center h-10 px-4 rounded bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {viewer.isLoading ? "Loading…" : "View Uploaded Invoice"}
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
                  className="inline-flex items-center h-10 px-4 rounded bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors whitespace-nowrap cursor-pointer"
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

              {/* Export Dropdown Button */}
              <div className="relative" ref={exportDropdown.ref}>
                <button
                  onClick={exportDropdown.toggle}
                  className="inline-flex items-center h-10 px-4 rounded border border-input bg-background text-foreground hover:bg-accent font-medium transition-colors whitespace-nowrap cursor-pointer"
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
            </div>

            {/* Currency selector and Status */}
            <div className="flex flex-row items-center gap-4">
              <ReadOnlyRegion editable={canEdit}>
                <Select
                  options={currencyList.map((c) => ({
                    label: c.ticker,
                    value: c.ticker,
                  }))}
                  value={state.currency}
                  placeholder="Currency"
                  searchable={false}
                  onChange={(value) =>
                    handleCurrencyChange(
                      (Array.isArray(value) ? value[0] : value) || "",
                    )
                  }
                  warnings={toInputWarnings(validations.currency)}
                  className="w-32 text-foreground border-border"
                  contentClassName="bg-popover border border-border"
                />
              </ReadOnlyRegion>

              {/* Status stays editable in every status — it is the workflow
                  control that unlocks or locks everything else. */}
              <SelectField
                options={STATUS_OPTIONS}
                value={state.status}
                onChange={(value) => handleStatusChange(value as Status)}
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid - Responsive: mobile stacks, tablet+ side-by-side */}
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
          }}
        >
          {/* Issuer Section */}
          <div className="border border-border rounded-lg p-4 min-w-0 bg-card shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Issuer
            </h3>
            <ReadOnlyRegion editable={canEdit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-2 relative isolate">
                <label className="block mb-1 text-sm text-foreground">
                  Issue Date:
                </label>
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
              <div className="mb-2 relative isolate">
                <label className="block mb-1 text-sm text-foreground">
                  Delivery Date:
                </label>
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
          </div>

          {/* Payer Section */}
          <div className="border border-border rounded-lg p-4 min-w-0 bg-card shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Payer
            </h3>
            <ReadOnlyRegion editable={canEdit}>
            <div className="mb-2 w-64 relative isolate">
              <label className="block mb-1 text-sm text-foreground">
                Due Date:
              </label>
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
            <LegalEntityForm
              bankDisabled
              legalEntity={state.payer}
              onChangeInfo={(input) => dispatch(actions.editPayer(input))}
              currency={state.currency}
              status={state.status}
              payeremailvalidation={validations.payerEmail}
            />
            </ReadOnlyRegion>
          </div>
        </div>

        {/* Line Items Table */}
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
                  className="p-2 mb-4 text-foreground placeholder:text-muted-foreground border-border"
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

      </div>

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
        open={viewer.url !== null}
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
