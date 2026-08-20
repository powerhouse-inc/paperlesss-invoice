import countries from "world-countries";
type Country = {
  name: {
    common: string;
    official: string;
    native?: Record<string, { common: string; official: string }>;
  };
  cca2: string;
};
const countriesArray = countries as unknown as Country[];

// Function to convert country name to country code
export const getCountryCodeFromName = (
  countryName: string | undefined | null,
): string => {
  if (!countryName) return "";

  // Special case handling for common abbreviations and alternative names
  const specialCases: Record<string, string> = {
    uk: "GB",
    "united kingdom": "GB",
    england: "GB",
    britain: "GB",
    deutschland: "DE",
    germany: "DE",
    usa: "US",
    "united states of america": "US",
    america: "US",
  };

  const lowerCountryName = countryName.toLowerCase().trim();

  // Check special cases first
  if (specialCases[lowerCountryName]) {
    return specialCases[lowerCountryName];
  }

  // Check if input is already a valid country code (2-letter code)
  if (countryName.length === 2 && /^[A-Z]{2}$/.test(countryName)) {
    const isValidCode = countriesArray.some((c) => c.cca2 === countryName);
    if (isValidCode) return countryName;
  }

  // Try exact match first (case-insensitive)
  const exactMatch = countriesArray.find(
    (c) => c.name.common.toLowerCase() === lowerCountryName,
  );
  if (exactMatch) return exactMatch.cca2;

  // Try official name match
  const officialMatch = countriesArray.find(
    (c) => c.name.official.toLowerCase() === lowerCountryName,
  );
  if (officialMatch) return officialMatch.cca2;

  // Try native name matches
  const nativeMatch = countriesArray.find((c) => {
    if (!c.name.native) return false;
    return Object.values(c.name.native).some(
      (n) =>
        n.common.toLowerCase() === lowerCountryName ||
        n.official.toLowerCase() === lowerCountryName,
    );
  });
  if (nativeMatch) return nativeMatch.cca2;

  // Try partial match if no exact match found
  const partialMatch = countriesArray.find(
    (c) =>
      c.name.common.toLowerCase().includes(lowerCountryName) ||
      lowerCountryName.includes(c.name.common.toLowerCase()),
  );
  if (partialMatch) return partialMatch.cca2;

  // If no match found, return original value
  return countryName;
};

// Chain configuration interface
export interface ChainConfig {
  chainName: string;
  chainId: string;
  rpc: string;
}

// Single source of truth for blockchain chain configurations (browser-safe, public RPCs only)
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base: {
    chainName: "Base",
    chainId: "8453",
    rpc: "https://base-mainnet.public.blastapi.io",
  },
  ethereum: {
    chainName: "Ethereum",
    chainId: "1",
    rpc: "https://ethereum-rpc.publicnode.com",
  },
  "arbitrum one": {
    chainName: "Arbitrum One",
    chainId: "42161",
    rpc: "https://arb1.arbitrum.io/rpc",
  },
};

// Default chain configuration (Ethereum)
export const DEFAULT_CHAIN_CONFIG: ChainConfig = CHAIN_CONFIGS.ethereum;

/**
 * Maps a chain name to its full configuration including chainId and RPC endpoint
 * Normalizes case and handles various chain name formats
 * @param chainName - Chain name from various sources (Claude AI, user input, etc.)
 * @returns ChainConfig object with chainName, chainId, and rpc
 */
export function mapChainNameToConfig(
  chainName: string | null | undefined,
): ChainConfig {
  if (!chainName) {
    return DEFAULT_CHAIN_CONFIG;
  }

  const normalizedChainName = chainName.toLowerCase().trim();

  // Direct lookup
  if (CHAIN_CONFIGS[normalizedChainName]) {
    return CHAIN_CONFIGS[normalizedChainName];
  }

  // Handle alternative names and variations
  const chainAliases: Record<string, string> = {
    eth: "ethereum",
    mainnet: "ethereum",
    arb: "arbitrum one",
    arbitrum: "arbitrum one",
    "arb one": "arbitrum one",
  };

  const aliasedName = chainAliases[normalizedChainName];
  if (aliasedName && CHAIN_CONFIGS[aliasedName]) {
    return CHAIN_CONFIGS[aliasedName];
  }

  // If no match found, return default (Ethereum)
  console.warn(
    `Unknown chain name: "${chainName}". Using default chain: ${DEFAULT_CHAIN_CONFIG.chainName}`,
  );
  return DEFAULT_CHAIN_CONFIG;
}

/**
 * Get all available chain configurations as an array
 * Useful for UI dropdowns and validation
 */
export function getAllChainConfigs(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS);
}

/**
 * Get chain configuration by chainId
 * @param chainId - The numeric chain ID as string
 * @returns ChainConfig if found, null otherwise
 */
export function getChainConfigByChainId(chainId: string): ChainConfig | null {
  return (
    Object.values(CHAIN_CONFIGS).find((config) => config.chainId === chainId) ||
    null
  );
}

// ============================================
// Shared Currency, Formatting & Date Utilities
// Single source of truth - React 19 / TS 5.9 best practices 2026
// ============================================

export const currencyList = [
  { ticker: "USDS", crypto: true },
  { ticker: "USDC", crypto: true },
  { ticker: "DAI", crypto: true },
  { ticker: "EURC", crypto: true },
  { ticker: "EURE", crypto: true },
  { ticker: "USD", crypto: false },
  { ticker: "EUR", crypto: false },
  { ticker: "DKK", crypto: false },
  { ticker: "GBP", crypto: false },
  { ticker: "JPY", crypto: false },
  { ticker: "CNY", crypto: false },
  { ticker: "CHF", crypto: false },
];

export type CurrencyInfo = { ticker: string; crypto: boolean };

export function isFiatCurrency(currency: string): boolean {
  const entry = currencyList.find((c) => c.ticker === currency);
  return entry ? entry.crypto === false : false;
}

/**
 * Get decimal precision for a currency.
 * Stablecoins/crypto like USDS/DAI use 6 decimals for display/calc.
 */
export function getCurrencyPrecision(currency: string): number {
  return currency === "USDS" || currency === "DAI" ? 6 : 2;
}

/**
 * Format a number for display (always 2 fraction digits for money presentation).
 * Note: Does not apply currency-specific precision for display.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts a date-only string (YYYY-MM-DD) to ISO datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)
 * Used when dispatching date values to match the Zod schema / DateTime scalar requirements.
 */
export function dateToDatetime(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  // If it's already a datetime string, return as is
  if (dateStr.includes("T")) return dateStr;
  // Convert date-only to datetime at midnight UTC
  return `${dateStr}T00:00:00.000Z`;
}

/**
 * Converts an ISO datetime string to date-only string (YYYY-MM-DD) for DatePicker / display.
 */
export function datetimeToDate(
  datetimeStr: string | null | undefined,
): string {
  if (!datetimeStr || datetimeStr.trim() === "") return "";
  // Extract date part from datetime string
  return datetimeStr.split("T")[0];
}

import type { InvoiceLineItem } from "document-models/invoice";

export interface EditingItemOverlay {
  id: string;
  quantity: number;
  unitPriceTaxExcl: number;
  unitPriceTaxIncl: number;
}

/**
 * Computes line items total, optionally overriding the contribution of a currently edited item.
 * Pure function - easy to test and reuse.
 */
export function calculateLineItemsTotal(
  lineItems: InvoiceLineItem[] | undefined,
  editing: EditingItemOverlay | null,
  useTaxIncl: boolean,
): number {
  if (!lineItems || lineItems.length === 0) return 0;

  let total = lineItems.reduce((sum: number, item: InvoiceLineItem) => {
    const price = useTaxIncl ? item.unitPriceTaxIncl : item.unitPriceTaxExcl;
    return sum + (item.quantity || 0) * price;
  }, 0);

  if (editing) {
    const original = lineItems.find((item) => item.id === editing.id);
    if (original) {
      const origPrice = useTaxIncl
        ? original.unitPriceTaxIncl
        : original.unitPriceTaxExcl;
      const editPrice = useTaxIncl
        ? editing.unitPriceTaxIncl
        : editing.unitPriceTaxExcl;
      total =
        total -
        (original.quantity || 0) * origPrice +
        editing.quantity * editPrice;
    }
  }

  return total;
}
