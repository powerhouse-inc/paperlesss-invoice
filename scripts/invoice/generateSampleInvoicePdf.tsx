/**
 * Generates a multi-page sample invoice PDF for exercising the inline PDF pane
 * (scrolling, zoom, download/print) and the payment-details card.
 *
 * Renders the editor's own `InvoicePDF` component rather than a synthetic
 * document, so the output is shaped exactly like a real export.
 *
 * Run: bun run scripts/invoice/generateSampleInvoicePdf.tsx
 */
import { renderToFile } from "@react-pdf/renderer";
import { InvoicePDF } from "../../editors/invoice-editor/InvoicePDF.js";
import type {
  InvoiceAddress,
  InvoiceLineItem,
  InvoiceState,
  LegalEntity,
} from "document-models/invoice";

// InvoicePDF puts 15 line items on page 1 and 20 on every page after, so
// 15 + 9*20 lands on exactly 10 pages.
const MAX_ITEMS_FIRST_PAGE = 15;
const MAX_ITEMS_OTHER_PAGES = 20;
const TARGET_PAGES = 10;
const ITEM_COUNT =
  MAX_ITEMS_FIRST_PAGE + (TARGET_PAGES - 1) * MAX_ITEMS_OTHER_PAGES;

const CURRENCY = "USD";
const OUTPUT = new URL(
  "../../sample-invoice-10-pages.pdf",
  import.meta.url,
).pathname;

const WORK_TYPES = [
  "Senior engineering — reactor integration",
  "Document model design review",
  "Editor implementation — invoice line items",
  "Subgraph resolver work",
  "PDF ingest pipeline tuning",
  "AI extraction prompt iteration",
  "Processor: analytics rollup",
  "Drive app — billing table",
  "Attachment service hardening",
  "UBL import/export conformance",
  "Webhook endpoint + shared secret",
  "Sync document audit trail",
  "Regression test authoring",
  "Deployment + release engineering",
  "Technical documentation",
];

function address(city: string, country: string): InvoiceAddress {
  return {
    city,
    country,
    extendedAddress: "Floor 4",
    postalCode: "2100",
    stateProvince: null,
    streetAddress: "12 Havnegade",
  };
}

function buildLineItems(count: number): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  for (let i = 0; i < count; i += 1) {
    // Vary the numbers so totals are non-trivial and the tax column is mixed.
    const quantity = 1 + (i % 8);
    const unitPriceTaxExcl = Number((85 + ((i * 37) % 240)).toFixed(2));
    const taxPercent = [0, 5, 10, 21, 25][i % 5];
    const totalPriceTaxExcl = Number((quantity * unitPriceTaxExcl).toFixed(2));
    const totalPriceTaxIncl = Number(
      (totalPriceTaxExcl * (1 + taxPercent / 100)).toFixed(2),
    );
    const unitPriceTaxIncl = Number(
      (unitPriceTaxExcl * (1 + taxPercent / 100)).toFixed(2),
    );

    items.push({
      currency: CURRENCY,
      description: `${String(i + 1).padStart(3, "0")} · ${
        WORK_TYPES[i % WORK_TYPES.length]
      } (sprint ${Math.floor(i / 5) + 1})`,
      id: `line-item-${String(i + 1).padStart(4, "0")}`,
      lineItemTag: [],
      quantity,
      receipts: [],
      taxPercent,
      totalPriceTaxExcl,
      totalPriceTaxIncl,
      unitPriceTaxExcl,
      unitPriceTaxIncl,
    });
  }
  return items;
}

const issuer: LegalEntity = {
  address: address("Copenhagen", "DK"),
  contactInfo: { email: "billing@example-issuer.com", tel: "+45 20 00 00 00" },
  country: "DK",
  id: { corpRegId: "DK-987654321", taxId: "DK12345678" },
  name: "Northwind Engineering ApS",
  paymentRouting: {
    bank: {
      ABA: "021000021",
      BIC: "NDEADKKK",
      SWIFT: "NDEADKKKXXX",
      accountNum: "5010-1234567890",
      accountType: "CHECKING",
      address: address("Copenhagen", "DK"),
      beneficiary: "Northwind Engineering ApS",
      intermediaryBank: {
        ABA: "026009593",
        BIC: "BOFAUS3N",
        SWIFT: "BOFAUS3NXXX",
        accountNum: "6550-99887766",
        accountType: "CHECKING",
        address: address("New York", "US"),
        beneficiary: "Northwind Engineering ApS",
        memo: "Ref NWE-2026-08",
        name: "Bank of America N.A.",
      },
      memo: "Invoice payment — quote reference NWE-2026-08",
      name: "Nordea Danmark",
    },
    wallet: {
      address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      chainId: "1",
      chainName: "Ethereum Mainnet",
      rpc: "https://mainnet.example-rpc.io",
    },
  },
};

const payer: LegalEntity = {
  address: address("Amsterdam", "NL"),
  contactInfo: { email: "ap@example-payer.com", tel: "+31 20 000 0000" },
  country: "NL",
  id: { corpRegId: "NL-556677889", taxId: "NL987654321B01" },
  name: "Zuiderzee Holdings B.V.",
  paymentRouting: {
    bank: {
      ABA: null,
      BIC: "INGBNL2A",
      SWIFT: "INGBNL2AXXX",
      accountNum: "NL91INGB0002445588",
      accountType: "CHECKING",
      address: address("Amsterdam", "NL"),
      beneficiary: "Zuiderzee Holdings B.V.",
      intermediaryBank: null,
      memo: null,
      name: "ING Bank N.V.",
    },
    wallet: null,
  },
};

const lineItems = buildLineItems(ITEM_COUNT);
const totalPriceTaxExcl = Number(
  lineItems.reduce((sum, item) => sum + item.totalPriceTaxExcl, 0).toFixed(2),
);
const totalPriceTaxIncl = Number(
  lineItems.reduce((sum, item) => sum + item.totalPriceTaxIncl, 0).toFixed(2),
);

const invoice: InvoiceState = {
  baseInvoice: null,
  closureReason: null,
  currency: CURRENCY,
  dateDelivered: "2026-08-18",
  dateDue: "2026-09-17",
  dateIssued: "2026-08-18",
  exported: { exportedLineItems: [], timestamp: null },
  invoiceNo: "NWE-2026-0817",
  invoiceTags: [],
  issuer,
  lineItems,
  notes:
    "Sample invoice generated for UI testing. 195 line items across 10 pages, " +
    "mixed tax rates, plus full bank and intermediary-bank routing so the " +
    "payment-details card has something to show.",
  payAfter: null,
  payer,
  payments: [],
  rejections: [],
  status: "ISSUED",
  timeTrackingReport: null,
  totalPriceTaxExcl,
  totalPriceTaxIncl,
};

await renderToFile(<InvoicePDF invoice={invoice} fiatMode={true} />, OUTPUT);

console.log(
  `Wrote ${OUTPUT}\n` +
    `  line items: ${ITEM_COUNT}\n` +
    `  expected pages: ${TARGET_PAGES}\n` +
    `  total excl. tax: ${totalPriceTaxExcl} ${CURRENCY}\n` +
    `  total incl. tax: ${totalPriceTaxIncl} ${CURRENCY}`,
);
