import { type ComponentProps, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import type { EditLegalEntityWalletInput } from "./legalEntity.js";
import type { ValidationResult } from "../validation/validationManager.js";
import { Select, TextInput } from "@powerhousedao/document-engineering/ui";
import { getAllChainConfigs } from "../utils/utils.js";
import { focusNextOnEnter, toInputWarnings } from "../utils/inputHelpers.js";

export type LegalEntityWalletSectionProps = Omit<
  ComponentProps<"div">,
  "children" | "onChange"
> & {
  readonly value: EditLegalEntityWalletInput;
  readonly onChange: (value: EditLegalEntityWalletInput) => void;
  readonly walletvalidation?: ValidationResult | null;
  readonly chainvalidation?: ValidationResult | null;
};

export const LegalEntityWalletSection = (
  props: LegalEntityWalletSectionProps,
) => {
  const {
    value,
    onChange,
    walletvalidation,
    chainvalidation,
    ...divProps
  } = props;
  const [localState, setLocalState] = useState(value);

  useEffect(() => {
    setLocalState(value);
  }, [value]);

  const handleInputChange = (
    field: keyof EditLegalEntityWalletInput,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setLocalState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleBlur = (
    field: keyof EditLegalEntityWalletInput,
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    const newValue = event.target.value;
    onChange({
      // ...localState,
      [field]: newValue,
    });
  };

  const CHAIN_PRESETS = getAllChainConfigs().map((config) => ({
    chainName: config.chainName,
    chainId: config.chainId,
  }));

  // Map CHAIN_PRESETS to Select options
  const chainOptions = CHAIN_PRESETS.map((preset) => ({
    label: preset.chainName,
    value: preset.chainId,
  }));

  // Find the selected option by chainId
  const selectedChain = chainOptions.find(
    (opt) => opt.value === localState.chainId,
  )?.value;

  const handleChainChange = (value: string | string[]) => {
    const chainId = Array.isArray(value) ? value[0] : value;
    const preset = CHAIN_PRESETS.find((p) => p.chainId === chainId);
    if (preset) {
      setLocalState((prev) => ({
        ...prev,
        chainId: preset.chainId,
        chainName: preset.chainName,
      }));
      onChange({
        ...localState,
        chainId: preset.chainId,
        chainName: preset.chainName,
      });
    }
  };

  return (
    <div
      {...divProps}
      className={twMerge(
        "rounded-lg border border-border bg-card p-6",
        props.className,
      )}
    >
      <div className="grid grid-cols-2 gap-4 items-center">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Wallet Information
        </h3>
        <div>
          <Select
            style={{ width: "100%" }}
            options={chainOptions}
            value={selectedChain || ""}
            onChange={handleChainChange}
            placeholder="Select Chain"
            contentClassName="bg-popover border border-border"
            className="text-foreground border-border"
          />
          {chainvalidation && !chainvalidation.isValid && (
            <p className="mt-1 text-xs text-status-warning">
              {chainvalidation.message}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-6">
        <div className="space-y-4">
          <TextInput
            value={localState.address ?? ""}
            label="Wallet Address"
            placeholder="0x..."
            onBlur={(e) => handleBlur("address", e)}
            onChange={(e) => handleInputChange("address", e)}
            warnings={toInputWarnings(walletvalidation)}
            onKeyDown={focusNextOnEnter}
            className="border-border"
          />
        </div>
      </div>
    </div>
  );
};
