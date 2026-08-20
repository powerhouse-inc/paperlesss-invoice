import {
  editIssuer,
  editIssuerBank,
  editIssuerWallet,
  editPayer,
  editPayerBank,
  editPayerWallet,
  reducer,
  utils,
  type InvoiceDocument,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

/**
 * The issuer and payer operations share identical logic (see
 * src/reducers/parties.ts), only differing in:
 *  - which `state.<party>` object is mutated
 *  - which field of `LegalEntityId` is populated by the `id` input
 *    (issuer -> corpRegId, payer -> taxId)
 *
 * `describe.each` drives both parties through the same scenarios while the
 * `idField` lets us assert the party-specific `LegalEntityId` shape.
 */
const parties = [
  {
    party: "issuer" as const,
    editParty: editIssuer,
    editBank: editIssuerBank,
    editWallet: editIssuerWallet,
    idField: "corpRegId" as const,
    otherIdField: "taxId" as const,
  },
  {
    party: "payer" as const,
    editParty: editPayer,
    editBank: editPayerBank,
    editWallet: editPayerWallet,
    idField: "taxId" as const,
    otherIdField: "corpRegId" as const,
  },
];

function getParty(document: InvoiceDocument, party: "issuer" | "payer") {
  return document.state.global[party];
}

describe.each(parties)(
  "PartiesOperations – $party",
  ({ party, editParty, editBank, editWallet, idField, otherIdField }) => {
    describe("editParty (address / contactInfo / country / id / name)", () => {
      it("sets address, contactInfo, country, id and name when all fields are provided", () => {
        const document = utils.createDocument();

        const updated = reducer(
          document,
          editParty({
            city: "New York",
            country: "USA",
            extendedAddress: "Suite 100",
            postalCode: "10001",
            stateProvince: "NY",
            streetAddress: "5th Avenue",
            tel: "+1 555 0100",
            email: "contact@example.com",
            id: "ID-123",
            name: "Acme Corp",
          }),
        );

        const entity = getParty(updated, party);
        expect(entity.address).toEqual({
          city: "New York",
          country: "USA",
          extendedAddress: "Suite 100",
          postalCode: "10001",
          stateProvince: "NY",
          streetAddress: "5th Avenue",
        });
        expect(entity.contactInfo).toEqual({
          tel: "+1 555 0100",
          email: "contact@example.com",
        });
        expect(entity.country).toBe("USA");
        expect(entity.id).toEqual({ [idField]: "ID-123", [otherIdField]: null });
        expect(entity.name).toBe("Acme Corp");
        expect(updated.operations.global[0].error).toBeUndefined();
      });

      it("does nothing when no recognized fields are provided", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editParty({}));

        expect(getParty(updated, party)).toEqual(getParty(document, party));
        expect(updated.operations.global[0].error).toBeUndefined();
      });

      it("falls back to null for address/contactInfo fields when the party has no prior address on a fresh document", () => {
        const document = utils.createDocument();

        // postalCode triggers the address block; city is explicitly present
        // but undefined, and state.issuer/payer.address is still null here,
        // so the fallback chain must resolve to null (not throw).
        const updated = reducer(
          document,
          editParty({
            postalCode: "10001",
            city: undefined,
            country: undefined,
            extendedAddress: undefined,
            stateProvince: undefined,
            streetAddress: undefined,
          }),
        );

        const entity = getParty(updated, party);
        expect(entity.address).toEqual({
          city: null,
          country: null,
          extendedAddress: null,
          postalCode: "10001",
          stateProvince: null,
          streetAddress: null,
        });
        // top-level country if-block also triggers since "country" is a key
        // of the input (even though its value is undefined)
        expect(entity.country).toBeNull();
      });

      it("falls back to null for contactInfo fields when the party has no prior contactInfo on a fresh document", () => {
        const document = utils.createDocument();

        const updated = reducer(
          document,
          editParty({ email: "new@example.com", tel: undefined }),
        );

        const entity = getParty(updated, party);
        expect(entity.contactInfo).toEqual({
          tel: null,
          email: "new@example.com",
        });
      });

      it("falls back to null for the email field when the party has no prior contactInfo on a fresh document", () => {
        const document = utils.createDocument();

        const updated = reducer(
          document,
          editParty({ tel: "+1 555 0100", email: undefined }),
        );

        const entity = getParty(updated, party);
        expect(entity.contactInfo).toEqual({
          tel: "+1 555 0100",
          email: null,
        });
      });

      it("falls back to null for the top-level name when absent on a fresh document", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editParty({ name: undefined }));

        expect(getParty(updated, party).name).toBeNull();
      });

      it("preserves previously set address/contactInfo/country/name fields when the same keys are sent as undefined", () => {
        let document = utils.createDocument();
        document = reducer(
          document,
          editParty({
            city: "New York",
            country: "USA",
            extendedAddress: "Suite 100",
            postalCode: "10001",
            stateProvince: "NY",
            streetAddress: "5th Avenue",
            tel: "+1 555 0100",
            email: "contact@example.com",
            name: "Acme Corp",
          }),
        );
        const before = getParty(document, party);

        const updated = reducer(
          document,
          editParty({
            city: undefined,
            country: undefined,
            extendedAddress: undefined,
            postalCode: undefined,
            stateProvince: undefined,
            streetAddress: undefined,
            tel: undefined,
            email: undefined,
            name: undefined,
          }),
        );

        expect(getParty(updated, party)).toEqual(before);
      });

      it("overwrites only the address fields explicitly provided, keeping the rest", () => {
        let document = utils.createDocument();
        document = reducer(
          document,
          editParty({
            city: "New York",
            postalCode: "10001",
            stateProvince: "NY",
          }),
        );

        const updated = reducer(document, editParty({ city: "Boston" }));

        expect(getParty(updated, party).address).toEqual({
          city: "Boston",
          country: null,
          extendedAddress: null,
          postalCode: "10001",
          stateProvince: "NY",
          streetAddress: null,
        });
      });

      it("sets id to null when a falsy id is provided", () => {
        let document = utils.createDocument();
        document = reducer(document, editParty({ id: "ID-123" }));
        expect(getParty(document, party).id).toEqual({
          [idField]: "ID-123",
          [otherIdField]: null,
        });

        const updated = reducer(document, editParty({ id: "" }));

        expect(getParty(updated, party).id).toBeNull();
      });

      it("leaves id untouched when the id key is absent", () => {
        let document = utils.createDocument();
        document = reducer(document, editParty({ id: "ID-123" }));

        const updated = reducer(document, editParty({ name: "Someone Else" }));

        expect(getParty(updated, party).id).toEqual({
          [idField]: "ID-123",
          [otherIdField]: null,
        });
      });
    });

    describe("editBank", () => {
      const fullBankInput = {
        ABA: "ABA-1",
        BIC: "BIC-1",
        SWIFT: "SWIFT-1",
        accountNum: "ACC-1",
        accountType: "CHECKING" as const,
        beneficiary: "Beneficiary 1",
        city: "City 1",
        country: "Country 1",
        extendedAddress: "Ext 1",
        memo: "Memo 1",
        name: "Bank 1",
        postalCode: "PC-1",
        stateProvince: "SP-1",
        streetAddress: "Street 1",
        ABAIntermediary: "ABA-2",
        BICIntermediary: "BIC-2",
        SWIFTIntermediary: "SWIFT-2",
        accountNumIntermediary: "ACC-2",
        accountTypeIntermediary: "SAVINGS" as const,
        beneficiaryIntermediary: "Beneficiary 2",
        cityIntermediary: "City 2",
        countryIntermediary: "Country 2",
        extendedAddressIntermediary: "Ext 2",
        memoIntermediary: "Memo 2",
        nameIntermediary: "Bank 2",
        postalCodeIntermediary: "PC-2",
        stateProvinceIntermediary: "SP-2",
        streetAddressIntermediary: "Street 2",
      };

      it("creates paymentRouting and defaults every field to null/empty-string when no paymentRouting exists and no input is given", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editBank({}));

        const entity = getParty(updated, party);
        expect(entity.paymentRouting?.wallet).toBeNull();
        expect(entity.paymentRouting?.bank).toEqual({
          ABA: null,
          BIC: null,
          SWIFT: null,
          accountNum: "",
          accountType: null,
          address: {
            city: null,
            country: null,
            extendedAddress: null,
            postalCode: null,
            stateProvince: null,
            streetAddress: null,
          },
          beneficiary: null,
          name: "",
          memo: null,
          intermediaryBank: {
            ABA: null,
            BIC: null,
            SWIFT: null,
            accountNum: "",
            accountType: null,
            address: {
              city: null,
              country: null,
              extendedAddress: null,
              postalCode: null,
              stateProvince: null,
              streetAddress: null,
            },
            beneficiary: null,
            name: "",
            memo: null,
          },
        });
      });

      it("sets every bank and intermediary bank field when fully provided (paymentRouting already exists)", () => {
        let document = utils.createDocument();
        // first call creates paymentRouting with a null bank
        document = reducer(document, editBank({}));

        const updated = reducer(document, editBank(fullBankInput));

        const bank = getParty(updated, party).paymentRouting?.bank;
        expect(bank).toEqual({
          ABA: "ABA-1",
          BIC: "BIC-1",
          SWIFT: "SWIFT-1",
          accountNum: "ACC-1",
          accountType: "CHECKING",
          address: {
            city: "City 1",
            country: "Country 1",
            extendedAddress: "Ext 1",
            postalCode: "PC-1",
            stateProvince: "SP-1",
            streetAddress: "Street 1",
          },
          beneficiary: "Beneficiary 1",
          name: "Bank 1",
          memo: "Memo 1",
          intermediaryBank: {
            ABA: "ABA-2",
            BIC: "BIC-2",
            SWIFT: "SWIFT-2",
            accountNum: "ACC-2",
            accountType: "SAVINGS",
            address: {
              city: "City 2",
              country: "Country 2",
              extendedAddress: "Ext 2",
              postalCode: "PC-2",
              stateProvince: "SP-2",
              streetAddress: "Street 2",
            },
            beneficiary: "Beneficiary 2",
            name: "Bank 2",
            memo: "Memo 2",
          },
        });
      });

      it("preserves every previously set bank and intermediary bank field when an empty input is sent again", () => {
        let document = utils.createDocument();
        document = reducer(document, editBank({}));
        document = reducer(document, editBank(fullBankInput));
        const before = getParty(document, party).paymentRouting?.bank;

        const updated = reducer(document, editBank({}));

        expect(getParty(updated, party).paymentRouting?.bank).toEqual(before);
      });

      it("does not recreate paymentRouting.wallet when only the bank is edited after a wallet already exists", () => {
        let document = utils.createDocument();
        document = reducer(document, editWallet({ address: "0xabc" }));

        const updated = reducer(document, editBank({}));

        expect(getParty(updated, party).paymentRouting?.wallet).toEqual({
          address: "0xabc",
          chainId: null,
          chainName: null,
          rpc: null,
        });
      });
    });

    describe("editWallet", () => {
      it("creates paymentRouting and defaults every field to null when no paymentRouting exists and no input is given", () => {
        const document = utils.createDocument();

        const updated = reducer(document, editWallet({}));

        expect(getParty(updated, party).paymentRouting).toEqual({
          bank: null,
          wallet: { address: null, chainId: null, chainName: null, rpc: null },
        });
      });

      it("sets every wallet field when fully provided (paymentRouting already exists)", () => {
        let document = utils.createDocument();
        document = reducer(document, editWallet({}));

        const updated = reducer(
          document,
          editWallet({
            address: "0x1234",
            chainId: "1",
            chainName: "Ethereum",
            rpc: "https://rpc.example.com",
          }),
        );

        expect(getParty(updated, party).paymentRouting?.wallet).toEqual({
          address: "0x1234",
          chainId: "1",
          chainName: "Ethereum",
          rpc: "https://rpc.example.com",
        });
      });

      it("preserves every previously set wallet field when an empty input is sent again", () => {
        let document = utils.createDocument();
        document = reducer(document, editWallet({}));
        document = reducer(
          document,
          editWallet({
            address: "0x1234",
            chainId: "1",
            chainName: "Ethereum",
            rpc: "https://rpc.example.com",
          }),
        );
        const before = getParty(document, party).paymentRouting?.wallet;

        const updated = reducer(document, editWallet({}));

        expect(getParty(updated, party).paymentRouting?.wallet).toEqual(
          before,
        );
      });

      it("does not recreate paymentRouting.bank when only the wallet is edited after a bank already exists", () => {
        let document = utils.createDocument();
        document = reducer(document, editBank({ name: "Bank 1" }));

        const updated = reducer(document, editWallet({}));

        expect(getParty(updated, party).paymentRouting?.bank?.name).toBe(
          "Bank 1",
        );
      });
    });
  },
);

describe("PartiesOperations – cross-party isolation", () => {
  it("editing the issuer does not affect the payer and vice versa", () => {
    let document = utils.createDocument();
    document = reducer(document, editIssuer({ name: "Issuer Co" }));
    document = reducer(document, editPayer({ name: "Payer Co" }));

    expect(document.state.global.issuer.name).toBe("Issuer Co");
    expect(document.state.global.payer.name).toBe("Payer Co");
    expect(document.state.global.issuer.id).toBeNull();
    expect(document.state.global.payer.id).toBeNull();
  });

  it("scenario: a full editing flow across issuer and payer, bank and wallet, in sequence", () => {
    let document = utils.createDocument();

    document = reducer(
      document,
      editIssuer({ name: "Issuer Co", country: "USA", id: "ISS-1" }),
    );
    document = reducer(document, editIssuerBank({ name: "Issuer Bank" }));
    document = reducer(document, editIssuerWallet({ address: "0xissuer" }));
    document = reducer(
      document,
      editPayer({ name: "Payer Co", country: "Germany", id: "PAY-1" }),
    );
    document = reducer(document, editPayerBank({ name: "Payer Bank" }));
    document = reducer(document, editPayerWallet({ address: "0xpayer" }));

    // update issuer bank/wallet again to hit the "preserve prior values" path
    document = reducer(document, editIssuerBank({ beneficiary: "Someone" }));
    document = reducer(document, editIssuerWallet({ chainId: "1" }));

    expect(document.operations.global).toHaveLength(8);
    expect(document.operations.global.every((op) => op.error === undefined)).toBe(
      true,
    );
    expect(document.state.global.issuer.name).toBe("Issuer Co");
    expect(document.state.global.issuer.id).toEqual({
      corpRegId: "ISS-1",
      taxId: null,
    });
    expect(document.state.global.issuer.paymentRouting?.bank?.name).toBe(
      "Issuer Bank",
    );
    expect(document.state.global.issuer.paymentRouting?.bank?.beneficiary).toBe(
      "Someone",
    );
    expect(document.state.global.issuer.paymentRouting?.wallet?.address).toBe(
      "0xissuer",
    );
    expect(document.state.global.issuer.paymentRouting?.wallet?.chainId).toBe(
      "1",
    );
    expect(document.state.global.payer.name).toBe("Payer Co");
    expect(document.state.global.payer.id).toEqual({
      taxId: "PAY-1",
      corpRegId: null,
    });
    expect(document.state.global.payer.paymentRouting?.bank?.name).toBe(
      "Payer Bank",
    );
    expect(document.state.global.payer.paymentRouting?.wallet?.address).toBe(
      "0xpayer",
    );
  });
});
