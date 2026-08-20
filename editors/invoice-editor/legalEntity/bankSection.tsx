import {
  type ComponentPropsWithRef,
  forwardRef,
  type Ref,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";
import { twMerge } from "tailwind-merge";
import type { EditLegalEntityBankInput } from "./legalEntity.js";
import { CountryForm } from "../components/countryForm.js";
import type { ValidationResult } from "../validation/validationManager.js";
import { Select, TextInput } from "@powerhousedao/document-engineering/ui";
import { focusNextOnEnter, toInputWarnings } from "../utils/inputHelpers.js";
import { isValidIBAN } from "../validation/validationRules.js";
import { STATE_PROVINCE_OPTIONS } from "./legalEntity.js";

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "TRUST"] as const;

export type LegalEntityBankSectionProps = Omit<
  ComponentPropsWithRef<"div">,
  "children"
> & {
  readonly value: EditLegalEntityBankInput;
  readonly onChange: (value: EditLegalEntityBankInput) => void;
  readonly countryvalidation?: ValidationResult | null;
  readonly ibanvalidation?: ValidationResult | null;
  readonly bicvalidation?: ValidationResult | null;
  readonly routingNumbervalidation?: ValidationResult | null;
  readonly banknamevalidation?: ValidationResult | null;
  readonly accountNumbervalidation?: ValidationResult | null;
  readonly currency: string;
};

function flattenBankInput(value: any) {
  return {
    ...value,
    ...(value.address && {
      streetAddress: value.address.streetAddress ?? "",
      extendedAddress: value.address.extendedAddress ?? "",
      city: value.address.city ?? "",
      postalCode: value.address.postalCode ?? "",
      country: value.address.country ?? "",
      stateProvince: value.address.stateProvince ?? "",
    }),
    ...(value.intermediaryBank && {
      ABAIntermediary: value.intermediaryBank.ABA ?? "",
      BICIntermediary: value.intermediaryBank.BIC ?? "",
      SWIFTIntermediary: value.intermediaryBank.SWIFT ?? "",
      accountNumIntermediary: value.intermediaryBank.accountNum ?? "",
      accountTypeIntermediary: value.intermediaryBank.accountType ?? "",
      beneficiaryIntermediary: value.intermediaryBank.beneficiary ?? "",
      memoIntermediary: value.intermediaryBank.memo ?? "",
      nameIntermediary: value.intermediaryBank.name ?? "",
      streetAddressIntermediary:
        value.intermediaryBank.address?.streetAddress ?? "",
      extendedAddressIntermediary:
        value.intermediaryBank.address?.extendedAddress ?? "",
      cityIntermediary: value.intermediaryBank.address?.city ?? "",
      postalCodeIntermediary: value.intermediaryBank.address?.postalCode ?? "",
      countryIntermediary: value.intermediaryBank.address?.country ?? "",
      stateProvinceIntermediary:
        value.intermediaryBank.address?.stateProvince ?? "",
    }),
  };
}

export const LegalEntityBankSection = forwardRef(
  function LegalEntityBankSection(
    props: LegalEntityBankSectionProps,
    ref: Ref<HTMLDivElement>,
  ) {
    const {
      value,
      onChange,
      countryvalidation,
      ibanvalidation,
      bicvalidation,
      routingNumbervalidation,
      banknamevalidation,
      accountNumbervalidation,
      currency,
      ...divProps
    } = props;
    const [showIntermediary, setShowIntermediary] = useState<boolean>(false);

    const [localState, setLocalState] = useState(flattenBankInput(value));

    useEffect(() => {
      setLocalState(flattenBankInput(value));

      // Check if there's any intermediary bank data
      const hasIntermediaryData = !!(
        localState.accountNumIntermediary ||
        localState.nameIntermediary ||
        localState.beneficiaryIntermediary ||
        localState.ABAIntermediary ||
        localState.BICIntermediary ||
        localState.SWIFTIntermediary ||
        localState.streetAddressIntermediary ||
        localState.cityIntermediary ||
        localState.countryIntermediary
      );

      setShowIntermediary(hasIntermediaryData);
    }, [value]);

    const handleInputChange = useCallback(function handleInputChange(
      field: keyof EditLegalEntityBankInput,
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) {
      setLocalState((prevState: ReturnType<typeof flattenBankInput>) => ({
        ...prevState,
        [field]: event.target.value,
      }));
    }, []);

    const handleBlur = useCallback(
      function handleBlur(
        field: keyof EditLegalEntityBankInput,
        event: React.FocusEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) {
        onChange({
          [field]: event.target.value,
        } as Partial<EditLegalEntityBankInput>);
      },
      [onChange],
    );

    const handleIntermediaryToggle = useCallback(
      function handleIntermediaryToggle(
        event: React.ChangeEvent<HTMLInputElement>,
      ) {
        setShowIntermediary(event.target.checked);
      },
      [showIntermediary],
    );

    function createInputHandler(field: keyof EditLegalEntityBankInput) {
      return function handleFieldChange(
        event: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) {
        handleInputChange(field, event);
      };
    }

    function createBlurHandler(field: keyof EditLegalEntityBankInput) {
      return function handleFieldBlur(
        event: React.FocusEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) {
        handleBlur(field, event);
      };
    }

    const SEPA_SWIFT_CURRENCIES = ["EUR", "DKK", "GBP", "CHF", "JPY"];

    const usdIbanPayment = useMemo(
      () => isValidIBAN(localState.accountNum ?? "") && currency === "USD",
      [localState.accountNum, currency],
    );

    return (
      <div
        {...divProps}
        className={twMerge(
          "rounded-lg border border-border bg-card p-6",
          props.className,
        )}
        ref={ref}
      >
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Banking Information
        </h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Account Number
                  {isValidIBAN(localState.accountNum ?? "") && (
                    <span className="ml-2 text-status-success font-medium">
                      IBAN
                    </span>
                  )}
                </label>
                <TextInput
                  // input={localState.accountNum ?? ""}
                  value={localState.accountNum ?? ""}
                  placeholder="Account Number"
                  onBlur={createBlurHandler("accountNum")}
                  onChange={createInputHandler("accountNum")}
                  className="h-10 w-full text-md mb-2 border-border"
                  warnings={toInputWarnings(
                    // Prefer the first failing validation between IBAN and generic account number
                    (() => {
                      const firstInvalid =
                        (ibanvalidation &&
                          !ibanvalidation.isValid &&
                          ibanvalidation) ||
                        (accountNumbervalidation &&
                          !accountNumbervalidation.isValid &&
                          accountNumbervalidation);
                      return (
                        firstInvalid ||
                        ibanvalidation ||
                        accountNumbervalidation ||
                        null
                      );
                    })(),
                  )}
                  onKeyDown={focusNextOnEnter}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block mb-1 text-sm font-medium text-foreground">
                    Account Type
                  </label>
                  <Select
                    className="h-10 w-full text-md mb-2 text-foreground border-border"
                    options={ACCOUNT_TYPES.map((type) => ({
                      label: type,
                      value: type,
                    }))}
                    contentClassName="bg-popover border border-border"
                    value={localState.accountType ?? ""}
                    onChange={(value) => {
                      // Update local state
                      setLocalState(
                        (prevState: ReturnType<typeof flattenBankInput>) => ({
                          ...prevState,
                          accountType: value as string,
                        }),
                      );
                      // Dispatch to parent component
                      onChange({
                        accountType: value as string,
                      } as Partial<EditLegalEntityBankInput>);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  {SEPA_SWIFT_CURRENCIES.includes(currency) ? (
                    <TextInput
                      value={(localState.BIC || localState.SWIFT) ?? ""}
                      label="SWIFT/BIC"
                      placeholder="SWIFT/BIC"
                      onBlur={createBlurHandler("BIC")}
                      onChange={createInputHandler("BIC")}
                      className="h-10 w-full text-md mb-2 border-border"
                      warnings={toInputWarnings(bicvalidation)}
                      onKeyDown={focusNextOnEnter}
                    />
                  ) : (
                    <div>
                      <TextInput
                        value={localState.ABA ?? ""}
                        label="Routing Number (ABA/ACH)"
                        placeholder="Routing Number (ABA/ACH)"
                        onBlur={createBlurHandler("ABA")}
                        onChange={createInputHandler("ABA")}
                        className="h-10 w-full text-md mb-2 border-border"
                        warnings={toInputWarnings(
                          usdIbanPayment ? null : routingNumbervalidation,
                        )}
                        onKeyDown={focusNextOnEnter}
                      />
                      <TextInput
                        value={(localState.BIC || localState.SWIFT) ?? ""}
                        label="SWIFT/BIC"
                        placeholder="SWIFT/BIC"
                        onBlur={createBlurHandler("SWIFT")}
                        onChange={createInputHandler("SWIFT")}
                        className="h-10 w-full text-md mb-2 border-border"
                        warnings={toInputWarnings(bicvalidation)}
                        onKeyDown={focusNextOnEnter}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <TextInput
              // input={localState.beneficiary ?? ""}
              value={localState.beneficiary ?? ""}
              label="Beneficiary Information"
              placeholder="Beneficiary Name"
              onBlur={createBlurHandler("beneficiary")}
              onChange={createInputHandler("beneficiary")}
              className="h-10 w-full text-md mb-2 border-border"
              onKeyDown={focusNextOnEnter}
            />
          </div>

          <div className="space-y-4">
            <TextInput
              // input={localState.name ?? ""}
              value={localState.name ?? ""}
              label="Bank Details"
              placeholder="Bank Name"
              onBlur={createBlurHandler("name")}
              onChange={createInputHandler("name")}
              className="h-10 w-full text-md mb-2 border-border"
              warnings={toInputWarnings(banknamevalidation)}
              onKeyDown={focusNextOnEnter}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-4 rounded-lg">
              <TextInput
                // input={localState.streetAddress ?? ""}
                value={localState.streetAddress ?? ""}
                label="Bank Address"
                placeholder="Street Address"
                onBlur={createBlurHandler("streetAddress")}
                onChange={createInputHandler("streetAddress")}
                className="h-10 w-full text-md mb-2 border-border"
                onKeyDown={focusNextOnEnter}
              />
              <TextInput
                // input={localState.extendedAddress ?? ""}
                value={localState.extendedAddress ?? ""}
                placeholder="Extended Address"
                onBlur={createBlurHandler("extendedAddress")}
                onChange={createInputHandler("extendedAddress")}
                className="h-10 w-full text-md mb-2 border-border"
                onKeyDown={focusNextOnEnter}
              />
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  // input={localState.city ?? ""}
                  value={localState.city ?? ""}
                  label="City"
                  placeholder="City"
                  onBlur={createBlurHandler("city")}
                  onChange={createInputHandler("city")}
                  className="h-10 w-full text-md mb-2 border-border"
                  onKeyDown={focusNextOnEnter}
                />
                <div className="space-y-2">
                  {localState.country === "US" ? (
                    <>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        State/Province
                      </label>
                      <Select
                        className="h-10 w-full text-md mb-2 text-foreground border-border"
                        options={STATE_PROVINCE_OPTIONS}
                        value={localState.stateProvince ?? ""}
                        onChange={(value) => {
                          createBlurHandler("stateProvince")({
                            target: { value: value as string },
                          } as React.FocusEvent<HTMLInputElement>);
                        }}
                        searchable={true}
                      />
                    </>
                  ) : (
                    <TextInput
                      // input={localState.stateProvince ?? ""}
                      value={localState.stateProvince ?? ""}
                      label="State/Province"
                      placeholder="State/Province"
                      onBlur={createBlurHandler("stateProvince")}
                      onChange={createInputHandler("stateProvince")}
                      className="h-10 w-full text-md mb-2 border-border"
                      onKeyDown={focusNextOnEnter}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextInput
                  // input={localState.postalCode ?? ""}
                  value={localState.postalCode ?? ""}
                  label="Postal Code"
                  placeholder="Postal Code"
                  onBlur={createBlurHandler("postalCode")}
                  onChange={createInputHandler("postalCode")}
                  className="h-10 w-full text-md mb-2 border-border"
                  onKeyDown={focusNextOnEnter}
                />
                <CountryForm
                  label="Country"
                  country={localState.country ?? ""}
                  handleInputChange={createInputHandler("country")}
                  handleBlur={createBlurHandler("country")}
                  className="h-10 w-full text-md mb-2 border-border"
                  validation={countryvalidation}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <TextInput
              // input={localState.memo ?? ""}
              value={localState.memo ?? ""}
              label="Memo"
              placeholder="Memo"
              onBlur={createBlurHandler("memo")}
              onChange={createInputHandler("memo")}
              className="h-10 w-full text-md mb-2 border-border"
              onKeyDown={focusNextOnEnter}
            />
          </div>

          <div className="pt-4">
            <label className="flex items-center space-x-2">
              <input
                checked={showIntermediary}
                className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                id="showIntermediary"
                onChange={handleIntermediaryToggle}
                type="checkbox"
              />
              <span className="text-sm font-medium text-foreground">
                Include Intermediary Bank
              </span>
            </label>
          </div>

          {showIntermediary ? (
            <div className="bg-primary/10 mt-4 space-y-6 rounded-lg border border-primary/30 p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Intermediary Bank Details
              </h3>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <TextInput
                      // input={localState.accountNumIntermediary ?? ""}
                      value={localState.accountNumIntermediary ?? ""}
                      label="Account Number"
                      placeholder="Intermediary Account Number"
                      onBlur={createBlurHandler("accountNumIntermediary")}
                      onChange={createInputHandler(
                        "accountNumIntermediary",
                      )}
                      className="h-10 w-full text-md mb-2 border-border"
                      onKeyDown={focusNextOnEnter}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="block mb-1 text-sm font-medium text-foreground">
                          Account Type
                        </label>
                        <Select
                          className="h-10 w-full text-md mb-2 text-foreground border-border"
                          options={ACCOUNT_TYPES.map((type) => ({
                            label: type,
                            value: type,
                          }))}
                          value={localState.accountType ?? ""}
                          onChange={(value) => {
                            // Update local state
                            setLocalState(
                              (
                                prevState: ReturnType<typeof flattenBankInput>,
                              ) => ({
                                ...prevState,
                                accountType: value as string,
                              }),
                            );
                            // Dispatch to parent component
                            onChange({
                              accountType: value as string,
                            } as Partial<EditLegalEntityBankInput>);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        {SEPA_SWIFT_CURRENCIES.includes(currency) ? (
                          <TextInput
                            value={
                              (localState.SWIFTIntermediary ||
                                localState.BICIntermediary) ??
                              ""
                            }
                            label="SWIFT/BIC"
                            placeholder="SWIFT/BIC"
                            onBlur={createBlurHandler("BICIntermediary")}
                            onChange={createInputHandler(
                              "BICIntermediary",
                            )}
                            className="h-10 w-full text-md mb-2 border-border"
                            warnings={toInputWarnings(bicvalidation)}
                            onKeyDown={focusNextOnEnter}
                          />
                        ) : (
                          <div>
                            <TextInput
                              value={localState.ABAIntermediary ?? ""}
                              label="Routing Number (ABA/ACH)"
                              placeholder="Routing Number (ABA/ACH)"
                              onBlur={createBlurHandler("ABAIntermediary")}
                              onChange={createInputHandler(
                                "ABAIntermediary",
                              )}
                              className="h-10 w-full text-md mb-2 border-border"
                              onKeyDown={focusNextOnEnter}
                            />
                            <TextInput
                              value={
                                (localState.SWIFTIntermediary ||
                                  localState.BICIntermediary) ??
                                ""
                              }
                              label="SWIFT/BIC"
                              placeholder="SWIFT/BIC"
                              onBlur={createBlurHandler("SWIFTIntermediary")}
                              onChange={createInputHandler(
                                "SWIFTIntermediary",
                              )}
                              className="h-10 w-full text-md mb-2 border-border"
                              onKeyDown={focusNextOnEnter}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <TextInput
                    // input={localState.beneficiaryIntermediary ?? ""}
                    value={localState.beneficiaryIntermediary ?? ""}
                    label="Beneficiary Information"
                    placeholder="Intermediary Beneficiary Name"
                    onBlur={createBlurHandler("beneficiaryIntermediary")}
                    onChange={createInputHandler(
                      "beneficiaryIntermediary",
                    )}
                    className="h-10 w-full text-md mb-2 border-border"
                    onKeyDown={focusNextOnEnter}
                  />
                </div>

                <div className="space-y-4">
                  <TextInput
                    // input={localState.nameIntermediary ?? ""}
                    value={localState.nameIntermediary ?? ""}
                    label="Bank Details"
                    placeholder="Intermediary Bank Name"
                    onBlur={createBlurHandler("nameIntermediary")}
                    onChange={createInputHandler("nameIntermediary")}
                    className="h-10 w-full text-md mb-2 border-border"
                    onKeyDown={focusNextOnEnter}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-4 rounded-lg">
                    <TextInput
                      // input={localState.streetAddressIntermediary ?? ""}
                      value={localState.streetAddressIntermediary ?? ""}
                      label="Bank Address"
                      placeholder="Street Address"
                      onBlur={createBlurHandler("streetAddressIntermediary")}
                      onChange={createInputHandler(
                        "streetAddressIntermediary",
                      )}
                      className="h-10 w-full text-md mb-2 border-border"
                      onKeyDown={focusNextOnEnter}
                    />
                    <TextInput
                      // input={localState.extendedAddressIntermediary ?? ""}
                      value={localState.extendedAddressIntermediary ?? ""}
                      placeholder="Extended Address"
                      onBlur={createBlurHandler("extendedAddressIntermediary")}
                      onChange={createInputHandler(
                        "extendedAddressIntermediary",
                      )}
                      className="h-10 w-full text-md mb-2 border-border"
                      onKeyDown={focusNextOnEnter}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <TextInput
                        // input={localState.cityIntermediary ?? ""}
                        value={localState.cityIntermediary ?? ""}
                        label="City"
                        placeholder="City"
                        onBlur={createBlurHandler("cityIntermediary")}
                        onChange={createInputHandler(
                          "cityIntermediary",
                        )}
                        className="h-10 w-full text-md mb-2 border-border"
                        onKeyDown={focusNextOnEnter}
                      />
                      <div className="space-y-2">
                        {localState.countryIntermediary === "US" ? (
                          <>
                            <label className="mb-2 block text-sm font-medium text-foreground">
                              State/Province
                            </label>
                            <Select
                              className="h-10 w-full text-md mb-2 text-foreground border-border"
                              options={STATE_PROVINCE_OPTIONS}
                              value={localState.stateProvinceIntermediary ?? ""}
                              onChange={(value) => {
                                createBlurHandler("stateProvinceIntermediary")({
                                  target: { value: value as string },
                                } as React.FocusEvent<HTMLInputElement>);
                              }}
                              searchable={true}
                            />
                          </>
                        ) : (
                          <TextInput
                            // input={localState.stateProvince ?? ""}
                            value={localState.stateProvinceIntermediary ?? ""}
                            label="State/Province"
                            placeholder="State/Province"
                            onBlur={createBlurHandler(
                              "stateProvinceIntermediary",
                            )}
                            onChange={createInputHandler(
                              "stateProvince",
                            )}
                            className="h-10 w-full text-md mb-2 border-border"
                            onKeyDown={focusNextOnEnter}
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <TextInput
                        // input={localState.postalCodeIntermediary ?? ""}
                        value={localState.postalCodeIntermediary ?? ""}
                        label="Postal Code"
                        placeholder="Postal Code"
                        onBlur={createBlurHandler("postalCodeIntermediary")}
                        onChange={createInputHandler(
                          "postalCodeIntermediary",
                        )}
                        className="h-10 w-full text-md mb-2 border-border"
                        onKeyDown={focusNextOnEnter}
                      />
                      <CountryForm
                        label="Country"
                        country={localState.countryIntermediary ?? ""}
                        handleInputChange={createInputHandler(
                          "countryIntermediary",
                        )}
                        handleBlur={createBlurHandler("countryIntermediary")}
                        className="h-10 w-full text-md mb-2 border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <TextInput
                    // input={localState.memoIntermediary ?? ""}
                    value={localState.memoIntermediary ?? ""}
                    label="Memo"
                    placeholder="Memo"
                    onBlur={createBlurHandler("memoIntermediary")}
                    onChange={createInputHandler("memoIntermediary")}
                    className="h-10 w-full text-md mb-2 border-border"
                    onKeyDown={focusNextOnEnter}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
