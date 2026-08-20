import type { DocumentModelGlobalState } from "document-model";

export const documentModel: DocumentModelGlobalState = {
  id: "powerhouse/invoice",
  name: "Invoice",
  author: {
    name: "Powerhouse",
    website: "https://powerhouse.io",
  },
  extension: "",
  description:
    "The Invoice document model that allows a contributor to request compensation based on their contributions fused with paperless for auto invoice extraction and generation.",
  specifications: [
    {
      state: {
        local: {
          schema: "",
          examples: [],
          initialValue: "",
        },
        global: {
          schema:
            "type InvoiceState {\n  status: Status!\n  invoiceNo: String!\n  dateIssued: Date\n  dateDue: Date\n  dateDelivered: Date\n  issuer: LegalEntity!\n  payer: LegalEntity!\n  currency: String!\n  lineItems: [InvoiceLineItem!]!\n  totalPriceTaxExcl: Float!\n  totalPriceTaxIncl: Float!\n  notes: String\n  rejections: [Rejection!]!\n  payments: [Payment!]!\n  payAfter: DateTime\n  invoiceTags: [InvoiceTag!]!\n  exported: ExportedData!\n  closureReason: ClosureReason\n  baseInvoice: AttachmentRef\n  timeTrackingReport: AttachmentRef\n}\n\nenum ClosureReason {\n  UNDERPAID\n  OVERPAID\n  CANCELLED\n}\n\ntype Rejection {\n  id: OID!\n  reason: String!\n  final: Boolean!\n}\n\ntype ExportedData {\n  timestamp: DateTime\n  exportedLineItems: [[String!]!]!\n}\n\ntype Payment {\n  id: OID!\n  processorRef: String\n  paymentDate: DateTime\n  txnRef: String\n  confirmed: Boolean!\n  issue: String\n  amount: Float\n}\n\ntype Token {\n  evmAddress: String\n  symbol: String\n  chainName: String\n  chainId: String\n  rpc: String\n}\n\ntype LegalEntity {\n  id: LegalEntityId\n  name: String\n  address: InvoiceAddress\n  contactInfo: ContactInfo\n  country: String\n  paymentRouting: PaymentRouting\n}\n\ntype InvoiceAddress {\n  streetAddress: String\n  extendedAddress: String\n  city: String\n  postalCode: String\n  country: String\n  stateProvince: String\n}\n\ntype ContactInfo {\n  tel: String\n  email: String\n}\n\ntype PaymentRouting {\n  bank: Bank\n  wallet: InvoiceWallet\n}\n\ntype Bank {\n  name: String!\n  address: InvoiceAddress!\n  ABA: String\n  BIC: String\n  SWIFT: String\n  accountNum: String!\n  accountType: InvoiceAccountType\n  beneficiary: String\n  intermediaryBank: IntermediaryBank\n  memo: String\n}\n\ntype IntermediaryBank {\n  name: String!\n  address: InvoiceAddress!\n  ABA: String\n  BIC: String\n  SWIFT: String\n  accountNum: String!\n  accountType: InvoiceAccountType\n  beneficiary: String\n  memo: String\n}\n\ntype InvoiceWallet {\n  rpc: String\n  chainName: String\n  chainId: String\n  address: String\n}\n\ntype InvoiceLineItem {\n  id: OID!\n  description: String!\n  taxPercent: Float!\n  quantity: Float!\n  currency: String!\n  unitPriceTaxExcl: Float!\n  unitPriceTaxIncl: Float!\n  totalPriceTaxExcl: Float!\n  totalPriceTaxIncl: Float!\n  lineItemTag: [InvoiceTag!]!\n  receipts: [AttachmentRef!]!\n}\n\ntype InvoiceTag {\n  dimension: String!\n  value: String!\n  label: String\n}\n\ntype LegalEntityId {\n  taxId: String\n  corpRegId: String\n}\n\nenum Status {\n  DRAFT\n  ISSUED\n  CANCELLED\n  ACCEPTED\n  REJECTED\n  PAYMENTSCHEDULED\n  PAYMENTSENT\n  PAYMENTISSUE\n  PAYMENTRECEIVED\n  PAYMENTCLOSED\n}\n\nenum InvoiceAccountType {\n  CHECKING\n  SAVINGS\n  TRUST\n  WALLET\n}\n\nenum InvoiceAccountTypeInput {\n  CHECKING\n  SAVINGS\n  TRUST\n  WALLET\n}",
          examples: [],
          initialValue:
            '{\n  "status": "DRAFT",\n  "invoiceNo": "",\n  "dateIssued": null,\n  "dateDue": null,\n  "dateDelivered": null,\n  "issuer": {\n    "id": null,\n    "name": null,\n    "address": null,\n    "contactInfo": null,\n    "country": null,\n    "paymentRouting": null\n  },\n  "payer": {\n    "id": null,\n    "name": null,\n    "address": null,\n    "contactInfo": null,\n    "country": null,\n    "paymentRouting": null\n  },\n  "currency": "",\n  "lineItems": [],\n  "totalPriceTaxExcl": 0,\n  "totalPriceTaxIncl": 0,\n  "notes": null,\n  "rejections": [],\n  "payments": [],\n  "payAfter": null,\n  "invoiceTags": [],\n  "exported": {\n    "timestamp": null,\n    "exportedLineItems": []\n  },\n  "closureReason": null,\n  "baseInvoice": null,\n  "timeTrackingReport": null\n}',
        },
      },
      modules: [
        {
          id: "51cc29df-e062-4c96-84ed-c413fa95628c",
          name: "general",
          operations: [
            {
              id: "ceb0582e-d6b3-44e6-acf7-b145b5ec5cae",
              name: "EDIT_INVOICE",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000001",
                  code: "INVOICE_NOT_EDITABLE",
                  name: "InvoiceNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditInvoiceInput {\n    invoiceNo: String\n    dateIssued: String\n    dateDelivered: String\n    dateDue: String\n    currency: String\n    notes: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "641d5433-7649-4c07-af15-f676caa6f1ce",
              name: "ADD_PAYMENT",
              scope: "global",
              errors: [],
              schema:
                "input AddPaymentInput {\n  id: OID!\n  processorRef: String\n  paymentDate: DateTime\n  txnRef: String\n  confirmed: Boolean!\n  issue: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "1bcd53d4-7df5-4380-8146-dc9018d8af98",
              name: "EDIT_PAYMENT_DATA",
              scope: "global",
              errors: [],
              schema:
                "input EditPaymentDataInput {\n  id: OID!\n  processorRef: String\n  paymentDate: DateTime\n  txnRef: String\n  confirmed: Boolean!\n  issue: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "7f02c058-e931-475a-a5f9-a85940ee300e",
              name: "EDIT_STATUS",
              scope: "global",
              errors: [],
              schema: "input EditStatusInput {\n  status: Status!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "44535683-4853-46f6-8888-127ca7bbfb16",
              name: "SET_EXPORTED_DATA",
              scope: "global",
              errors: [],
              schema:
                "input SetExportedDataInput {\n  timestamp: DateTime!\n  exportedLineItems: [[String!]!]!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
          ],
          description: "",
        },
        {
          id: "33bbe5a1-ec73-4366-a137-888c3b3a1b11",
          name: "parties",
          operations: [
            {
              id: "682b332a-4ea8-482f-9681-13a49805b360",
              name: "EDIT_ISSUER_BANK",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000003",
                  code: "ISSUER_BANK_NOT_EDITABLE",
                  name: "IssuerBankNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditIssuerBankInput {\n    name: String\n    streetAddress: String\n    extendedAddress: String\n    city: String\n    postalCode: String\n    country: String\n    stateProvince: String\n    ABA: String\n    BIC: String\n    SWIFT: String\n    accountNum: String\n    accountType: InvoiceAccountTypeInput\n    beneficiary: String\n    memo: String\n    nameIntermediary: String\n    streetAddressIntermediary: String\n    extendedAddressIntermediary: String\n    cityIntermediary: String\n    postalCodeIntermediary: String\n    countryIntermediary: String\n    stateProvinceIntermediary: String\n    ABAIntermediary: String\n    BICIntermediary: String\n    SWIFTIntermediary: String\n    accountNumIntermediary: String\n    accountTypeIntermediary: InvoiceAccountTypeInput\n    beneficiaryIntermediary: String\n    memoIntermediary: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "f9d8acdb-f07a-419d-ace7-b0c17798012b",
              name: "EDIT_ISSUER",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000002",
                  code: "ISSUER_NOT_EDITABLE",
                  name: "IssuerNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditIssuerInput {\n    id: String\n    name: String\n    streetAddress: String\n    extendedAddress: String\n    city: String\n    postalCode: String\n    country: String\n    stateProvince: String\n    tel: String\n    email: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "b120d322-b884-4294-9ef7-2fc79855e659",
              name: "EDIT_ISSUER_WALLET",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000004",
                  code: "ISSUER_WALLET_NOT_EDITABLE",
                  name: "IssuerWalletNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditIssuerWalletInput {\n    rpc: String\n    chainName: String\n    chainId: String\n    address: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "ee375d6e-9fa0-473a-ac23-494b7c694713",
              name: "EDIT_PAYER_BANK",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000006",
                  code: "PAYER_BANK_NOT_EDITABLE",
                  name: "PayerBankNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditPayerBankInput {\n    name: String\n    streetAddress: String\n    extendedAddress: String\n    city: String\n    postalCode: String\n    country: String\n    stateProvince: String\n    ABA: String\n    BIC: String\n    SWIFT: String\n    accountNum: String\n    accountType: InvoiceAccountTypeInput\n    beneficiary: String\n    memo: String\n    nameIntermediary: String\n    streetAddressIntermediary: String\n    extendedAddressIntermediary: String\n    cityIntermediary: String\n    postalCodeIntermediary: String\n    countryIntermediary: String\n    stateProvinceIntermediary: String\n    ABAIntermediary: String\n    BICIntermediary: String\n    SWIFTIntermediary: String\n    accountNumIntermediary: String\n    accountTypeIntermediary: InvoiceAccountTypeInput\n    beneficiaryIntermediary: String\n    memoIntermediary: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "2720e1ff-8fe5-4507-adc6-4106851c6818",
              name: "EDIT_PAYER",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000005",
                  code: "PAYER_NOT_EDITABLE",
                  name: "PayerNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditPayerInput {\n    id: String\n    name: String\n    streetAddress: String\n    extendedAddress: String\n    city: String\n    postalCode: String\n    country: String\n    stateProvince: String\n    tel: String\n    email: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "11c265af-eb81-44c2-8267-a64a65751b09",
              name: "EDIT_PAYER_WALLET",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000007",
                  code: "PAYER_WALLET_NOT_EDITABLE",
                  name: "PayerWalletNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditPayerWalletInput {\n    rpc: String\n    chainName: String\n    chainId: String\n    address: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
          ],
          description: "",
        },
        {
          id: "0fc576db-54df-43b5-bc98-e30bee8311fe",
          name: "items",
          operations: [
            {
              id: "74c2f3b3-dfb5-4eab-868f-83b99adc5051",
              name: "ADD_LINE_ITEM",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000008",
                  code: "LINE_ITEM_NOT_ADDABLE",
                  name: "LineItemNotAddableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input AddLineItemInput {\n    id: OID!\n    description: String!\n    taxPercent: Float!\n    quantity: Float!\n    currency: String!\n    unitPriceTaxExcl: Float!\n    unitPriceTaxIncl: Float!\n    totalPriceTaxExcl: Float!\n    totalPriceTaxIncl: Float!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "275bc86e-a73b-48ee-9fcf-74209ded7261",
              name: "DELETE_LINE_ITEM",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000010",
                  code: "LINE_ITEM_NOT_DELETABLE",
                  name: "LineItemNotDeletableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema: "input DeleteLineItemInput {\n  id: OID!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "a28f0cb3-7161-4e42-9486-f3607566dc48",
              name: "EDIT_LINE_ITEM",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000009",
                  code: "LINE_ITEM_NOT_EDITABLE",
                  name: "LineItemNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input EditLineItemInput {\n    id: OID!\n    description: String\n    taxPercent: Float\n    quantity: Float\n    currency: String\n    unitPriceTaxExcl: Float\n    unitPriceTaxIncl: Float\n    totalPriceTaxExcl: Float\n    totalPriceTaxIncl: Float\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "b9fdf77a-f77d-473e-8563-13bcf01da5bd",
              name: "SET_INVOICE_TAG",
              scope: "global",
              errors: [],
              schema:
                "input SetInvoiceTagInput {\n  dimension: String!\n  value: String!\n  label: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "fd40decf-d717-47dd-b063-560ea95f45d6",
              name: "SET_LINE_ITEM_TAG",
              scope: "global",
              errors: [],
              schema:
                "input SetLineItemTagInput {\n  lineItemId: OID!\n  dimension: String!\n  value: String!\n  label: String\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
          ],
          description: "",
        },
        {
          id: "8284afe0-9696-46d6-94b4-b2838c30e10e",
          name: "transitions",
          operations: [
            {
              id: "04996aa3-c06c-438a-9f15-c074c8ca0035",
              name: "ACCEPT",
              scope: "global",
              errors: [],
              schema: "input AcceptInput {\n  payAfter: DateTime\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "386b4b3b-2ee8-4871-b194-f990d79d3556",
              name: "CANCEL",
              scope: "global",
              errors: [],
              schema: "input CancelInput {\n  _empty: Boolean\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "5ddc737f-a643-4010-bd75-832d1ba291fe",
              name: "CLOSE_PAYMENT",
              scope: "global",
              errors: [],
              schema:
                "input ClosePaymentInput {\n  closureReason: ClosureReasonInput\n}\n\nenum ClosureReasonInput {\n  UNDERPAID\n  OVERPAID\n  CANCELLED\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "780d7d96-8cc4-42f3-937d-34f4ecf765ee",
              name: "CONFIRM_PAYMENT",
              scope: "global",
              errors: [],
              schema:
                "input ConfirmPaymentInput {\n  id: OID!\n  amount: Float!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "bdf2ae13-dc2c-43c0-829b-7400c45c0dad",
              name: "ISSUE",
              scope: "global",
              errors: [],
              schema:
                "input IssueInput {\n  invoiceNo: String!\n  dateIssued: String!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "255d6cf0-8abc-45cc-b4dc-885ac9e3ae39",
              name: "REAPPROVE_PAYMENT",
              scope: "global",
              errors: [],
              schema: "input ReapprovePaymentInput {\n  _empty: Boolean\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "0e9b0cc6-a1f5-4521-8255-de37c3316efe",
              name: "REGISTER_PAYMENT_TX",
              scope: "global",
              errors: [],
              schema:
                "input RegisterPaymentTxInput {\n  id: OID!\n  timestamp: DateTime!\n  txRef: String!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "f8590d02-192d-4454-a26b-346fbb039e15",
              name: "REINSTATE",
              scope: "global",
              errors: [],
              schema: "input ReinstateInput {\n  _empty: Boolean\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "96edda79-7cc0-4d4f-bd89-352aab35635e",
              name: "REJECT",
              scope: "global",
              errors: [],
              schema:
                "input RejectInput {\n  id: OID!\n  reason: String!\n  final: Boolean!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "cbe8ef80-b82d-40b8-bbb5-34c30a314b14",
              name: "REPORT_PAYMENT_ISSUE",
              scope: "global",
              errors: [],
              schema:
                "input ReportPaymentIssueInput {\n  id: OID!\n  issue: String!\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "d7de04a0-ba51-4584-8457-91f3e331233d",
              name: "RESET",
              scope: "global",
              errors: [],
              schema: "input ResetInput {\n  _empty: Boolean\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "4ec26ce1-8860-4e8e-b38d-6e5539259f7c",
              name: "SCHEDULE_PAYMENT",
              scope: "global",
              errors: [],
              schema:
                "input SchedulePaymentInput {\n  id: OID!\n  processorRef: String!\n  paymentDate: DateTime\n}",
              reducer: "",
              examples: [],
              template: "",
              description: "",
            },
          ],
          description: "",
        },
        {
          id: "a11ac6e0-0000-4a00-8a00-000000000001",
          name: "attachments",
          operations: [
            {
              id: "a11ac6e0-0000-4a00-8a00-000000000002",
              name: "SET_TIME_TRACKING_REPORT",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000012",
                  code: "TIME_TRACKING_REPORT_NOT_EDITABLE",
                  name: "TimeTrackingReportNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input SetTimeTrackingReportInput {\n  timeTrackingReport: AttachmentRef\n}",
              reducer:
                'if (!["DRAFT", "REJECTED"].includes(state.status)) {\n  throw new TimeTrackingReportNotEditableError(\n    `Cannot change the time tracking report while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,\n  );\n}\nstate.timeTrackingReport = action.input.timeTrackingReport ?? null;',
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "a11ac6e0-0000-4a00-8a00-000000000003",
              name: "SET_BASE_INVOICE",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000011",
                  code: "BASE_INVOICE_NOT_EDITABLE",
                  name: "BaseInvoiceNotEditableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input SetBaseInvoiceInput {\n  baseInvoice: AttachmentRef\n}",
              reducer:
                'if (!["DRAFT", "REJECTED"].includes(state.status)) {\n  throw new BaseInvoiceNotEditableError(\n    `Cannot change the base invoice while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,\n  );\n}\nstate.baseInvoice = action.input.baseInvoice ?? null;',
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "a11ac6e0-0000-4a00-8a00-000000000004",
              name: "ADD_LINE_ITEM_RECEIPT",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000013",
                  code: "RECEIPT_NOT_ADDABLE",
                  name: "ReceiptNotAddableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input AddLineItemReceiptInput {\n  lineItemId: OID!\n  receipt: AttachmentRef!\n}",
              reducer:
                'if (!["DRAFT", "REJECTED"].includes(state.status)) {\n  throw new ReceiptNotAddableError(\n    `Cannot attach a receipt while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,\n  );\n}\nconst item = state.lineItems.find((x) => x.id === action.input.lineItemId);\nif (!item) {\n  throw new Error("Line item matching input.lineItemId not found");\n}\nif (!item.receipts.includes(action.input.receipt)) {\n  item.receipts.push(action.input.receipt);\n}',
              examples: [],
              template: "",
              description: "",
            },
            {
              id: "a11ac6e0-0000-4a00-8a00-000000000005",
              name: "REMOVE_LINE_ITEM_RECEIPT",
              scope: "global",
              errors: [
                {
                  id: "e10c0000-0000-4000-8000-000000000014",
                  code: "RECEIPT_NOT_REMOVABLE",
                  name: "ReceiptNotRemovableError",
                  template: "",
                  description:
                    "Rejected because the invoice status does not permit content edits. Only DRAFT and REJECTED invoices may be edited.",
                },
              ],
              schema:
                "input RemoveLineItemReceiptInput {\n  lineItemId: OID!\n  receipt: AttachmentRef!\n}",
              reducer:
                'if (!["DRAFT", "REJECTED"].includes(state.status)) {\n  throw new ReceiptNotRemovableError(\n    `Cannot remove a receipt while the invoice is ${state.status}; only DRAFT and REJECTED invoices may be edited`,\n  );\n}\nconst item = state.lineItems.find((x) => x.id === action.input.lineItemId);\nif (!item) {\n  throw new Error("Line item matching input.lineItemId not found");\n}\nitem.receipts = (item.receipts ?? []).filter((r) => r !== action.input.receipt);',
              examples: [],
              template: "",
              description: "",
            },
          ],
          description: "",
        },
      ],
      version: 1,
      changeLog: [],
    },
  ],
};
