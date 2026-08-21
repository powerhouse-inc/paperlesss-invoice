import type {
  Bank,
  IntermediaryBank,
  InvoiceAddress,
  InvoiceWallet,
  LegalEntity,
} from "document-models/invoice";

/** Join the parts of an address that are actually present. */
function formatAddress(address: InvoiceAddress | null | undefined): string {
  if (!address) return "";
  return [
    address.streetAddress,
    address.extendedAddress,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ]
    .filter((part) => part?.trim())
    .join(", ");
}

function Row({ label, value }: { label: string; value: string }) {
  // Empty fields are dropped rather than rendered as em-dashes: this section is
  // for eyeballing against a PDF, and a column of placeholders is noise.
  if (!value.trim()) return null;
  return (
    <div className="flex gap-2 text-xs leading-5">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

function BankRows({ bank }: { bank: Bank | IntermediaryBank }) {
  return (
    <>
      <Row label="Bank" value={bank.name} />
      <Row label="Beneficiary" value={bank.beneficiary ?? ""} />
      <Row label="Acct No" value={bank.accountNum} />
      <Row label="Acct Type" value={bank.accountType ?? ""} />
      <Row label="BIC" value={bank.BIC ?? ""} />
      <Row label="SWIFT" value={bank.SWIFT ?? ""} />
      <Row label="ABA" value={bank.ABA ?? ""} />
      <Row label="Address" value={formatAddress(bank.address)} />
      <Row label="Memo" value={bank.memo ?? ""} />
    </>
  );
}

function WalletRows({ wallet }: { wallet: InvoiceWallet }) {
  return (
    <>
      <Row label="Address" value={wallet.address ?? ""} />
      <Row
        label="Chain"
        value={[wallet.chainName, wallet.chainId]
          .filter((p) => p?.trim())
          .join(" / ")}
      />
      <Row label="RPC" value={wallet.rpc ?? ""} />
    </>
  );
}

/** True when there is any routing worth expanding to look at. */
export function hasPaymentDetails(
  entity: LegalEntity | null | undefined,
): boolean {
  const routing = entity?.paymentRouting;
  if (!routing) return false;
  const bank = routing.bank;
  const wallet = routing.wallet;
  return Boolean(bank?.name || bank?.accountNum || wallet?.address);
}

/**
 * A party's payment routing — bank, intermediary bank and wallet.
 *
 * These fields are printed on the uploaded PDF but otherwise live only inside
 * the party form, which covers the document being compared against. Rendered
 * inside the party card (behind a disclosure) so they can be verified at a
 * glance without opening a dialog. Display only: editing stays in the form.
 */
export function PaymentDetailsRows({
  entity,
}: {
  readonly entity: LegalEntity | null | undefined;
}) {
  const routing = entity?.paymentRouting;
  const bank = routing?.bank ?? null;
  const wallet = routing?.wallet ?? null;
  const intermediary = bank?.intermediaryBank ?? null;

  if (!hasPaymentDetails(entity)) {
    return (
      <p className="text-xs text-muted-foreground">
        No payment details recorded.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bank && <BankRows bank={bank} />}

      {intermediary && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intermediary bank
          </p>
          <BankRows bank={intermediary} />
        </div>
      )}

      {wallet && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Wallet
          </p>
          <WalletRows wallet={wallet} />
        </div>
      )}
    </div>
  );
}
