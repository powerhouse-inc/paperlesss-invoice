import {
  type InvoiceDocument,
  type ClosureReason,
  type Payment,
  actions,
} from "document-models/invoice";
import { useEffect } from "react";
import {
  Textarea,
  Checkbox,
  Select,
  DatePicker,
  TextInput,
} from "@powerhousedao/document-engineering/ui";
import { dateToDatetime, datetimeToDate } from "../utils/utils.js";
import { focusNextOnEnter } from "../utils/inputHelpers.js";

// Modal content components
interface IssueInvoiceModalContentProps {
  invoiceNoInput: string;
  setInvoiceNoInput: React.Dispatch<React.SetStateAction<string>>;
  state: InvoiceDocument["state"]["global"];
  dispatch: (action: any) => void;
  setWarning: (hasWarning: boolean) => void;
}
export function IssueInvoiceModalContent({
  invoiceNoInput,
  setInvoiceNoInput,
  state,
  dispatch,
  setWarning,
}: IssueInvoiceModalContentProps) {
  useEffect(() => {
    if (invoiceNoInput === "" || state.dateIssued === "") {
      setWarning(true);
    } else {
      setWarning(false);
    }
  }, [invoiceNoInput, state.dateIssued, setWarning]);

  const warning = invoiceNoInput === "" || state.dateIssued === "";

  return (
    <div>
      {warning && (
        <div className="my-6 rounded-md bg-destructive/15 p-4 text-center flex flex-col items-center justify-center min-h-[64px]">
          <div className="text-destructive">
            <p>Warning: Fill in all fields before continuing.</p>
          </div>
        </div>
      )}
      <div>
        <label className="block mb-1 text-sm text-foreground">
          Invoice Number:
        </label>
        <TextInput
          placeholder={"Add invoice number"}
          value={invoiceNoInput}
          onChange={(e) => setInvoiceNoInput(e.target.value)}
          onBlur={(e) => {
            const newValue = e.target.value;
            if (newValue !== state.invoiceNo) {
              dispatch(actions.editInvoice({ invoiceNo: newValue }));
            }
          }}
          onKeyDown={focusNextOnEnter}
        />
      </div>
      <div className="mt-4">
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
        />
      </div>
    </div>
  );
}

interface RejectInvoiceModalContentProps {
  state: InvoiceDocument["state"]["global"];
  dispatch: (action: any) => void;
  setWarning: (hasWarning: boolean) => void;
  setRejectReason: (reason: string) => void;
  setFinalReason: (final: boolean) => void;
  finalReason: boolean;
  rejectReason: string;
}
export function RejectInvoiceModalContent({
  setRejectReason,
  setFinalReason,
  finalReason,
  rejectReason,
}: RejectInvoiceModalContentProps) {
  return (
    <div className="w-full">
      <div>
        <label className="block mb-1 text-sm text-foreground">Reason:</label>
        <Textarea
          autoExpand={true}
          placeholder={"Add reason"}
          value={rejectReason}
          onChange={(e) => {
            setRejectReason(e.target.value);
          }}
        />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <Checkbox
          label="Final"
          value={finalReason}
          onChange={() => {
            setFinalReason(!finalReason);
          }}
        />
      </div>
    </div>
  );
}

export function FinalRejectionModalContent({
  rejectReason,
}: {
  rejectReason: string;
}) {
  return (
    <div>Invoice is rejected with reason: {rejectReason} and is final.</div>
  );
}

interface SchedulePaymentModalContentProps {
  paymentRef: string;
  setPaymentRef: (paymentRef: string) => void;
}

export function SchedulePaymentModalContent({
  paymentRef,
  setPaymentRef,
}: SchedulePaymentModalContentProps) {
  return (
    <div className="w-full">
      <div>
        <label className="block mb-1 text-sm text-foreground">
          Payment Reference:
        </label>
        <Textarea
          autoExpand={true}
          placeholder={"Add payment reference"}
          value={paymentRef}
          onChange={(e) => {
            setPaymentRef(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

interface ClosePaymentModalContentProps {
  closureReason: string;
  setClosureReason: (closureReason: string) => void;
}

export function ClosePaymentModalContent({
  closureReason,
  setClosureReason,
}: ClosePaymentModalContentProps) {
  return (
    <div className="w-[250px]">
      <div className="justify-center">
        <label className="block mb-2 text-sm text-foreground">
          Closure Reason:
        </label>
        <Select
          className="text-foreground"
          options={[
            {
              label: "Underpaid",
              value: "UNDERPAID",
            },
            {
              label: "Overpaid",
              value: "OVERPAID",
            },
            {
              label: "Cancelled",
              value: "CANCELLED",
            },
          ]}
          value={closureReason}
          onChange={(e) => {
            setClosureReason(e as ClosureReason);
          }}
        />
      </div>
    </div>
  );
}

interface RegisterPaymentTxModalContentProps {
  paymentDate: string;
  setPaymentDate: (paymentDate: string) => void;
  txnRef: string;
  setTxnRef: (txnRef: string) => void;
}

export function RegisterPaymentTxModalContent({
  paymentDate,
  setPaymentDate,
  txnRef,
  setTxnRef,
}: RegisterPaymentTxModalContentProps) {
  return (
    <div className="w-full">
      <div className="mt-4">
        <label className="block mb-1 text-sm text-foreground">
          Payment Date:
        </label>
        <DatePicker
          name="paymentDate"
          dateFormat="YYYY-MM-DD"
          className="w-full bg-background border border-border"
          onChange={(e) => {
            setPaymentDate(e.target.value);
          }}
          value={paymentDate}
        />
      </div>
      <div className="mt-4">
        <label className="block mb-1 text-sm text-foreground">
          Transaction Reference:
        </label>
        <Textarea
          autoExpand={true}
          placeholder={"Add transaction reference"}
          value={txnRef}
          onChange={(e) => {
            setTxnRef(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

interface ReportPaymentIssueModalContentProps {
  paymentIssue: string;
  setPaymentIssue: (paymentIssue: string) => void;
}

export function ReportPaymentIssueModalContent({
  paymentIssue,
  setPaymentIssue,
}: ReportPaymentIssueModalContentProps) {
  return (
    <div className="w-full">
      <div>
        <label className="block mb-1 text-sm text-foreground">
          Payment Issue:
        </label>
        <Textarea
          autoExpand={true}
          placeholder={"Add payment issue"}
          value={paymentIssue}
          onChange={(e) => {
            setPaymentIssue(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

interface ConfirmPaymentModalContentProps {
  paymentAmount: string;
  setPaymentAmount: (paymentAmount: string) => void;
  payments: Payment[];
}

export function ConfirmPaymentModalContent({
  paymentAmount,
  setPaymentAmount,
  payments,
}: ConfirmPaymentModalContentProps) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-2">
        <label className="block mb-1 text-sm font-bold text-foreground">
          Processor Reference :
        </label>
        <span className="break-all max-w-full">
          {payments[payments.length - 1].processorRef}
        </span>
      </div>
      <div className="flex flex-col gap-2 mt-4">
        <label className="block mb-1 text-sm font-bold text-foreground">
          Payment Date :
        </label>
        <span className="break-all max-w-full">
          {payments[payments.length - 1].paymentDate}
        </span>
      </div>
      <div className="flex flex-col gap-2 mt-4">
        <label className="block mb-1 text-sm font-bold text-foreground">
          Transaction Reference :
        </label>
        <span className="break-all max-w-full">
          {payments[payments.length - 1].txnRef}
        </span>
      </div>
      <div className="mt-4">
        <label className="block mb-1 text-sm font-bold text-foreground">
          Payment Amount:
        </label>
        <input
          className="w-full rounded-md border border-input px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground"
          type="number"
          name="Enter payment amount"
          value={paymentAmount}
          onChange={(e) => {
            setPaymentAmount(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
