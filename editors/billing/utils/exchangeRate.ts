import { coinGeckoId, toFiatCurrency } from "./currency.js";

// Cache for exchange rates to avoid repeated API calls
const exchangeRateCache: Record<string, number> = {};

// Type definitions for API responses
interface ExchangeRateAPIResponse {
  rates?: Record<string, number>;
}

interface CoinGeckoResponse {
  [coinId: string]: Record<string, number>;
}

/**
 * Validates if an amount should trigger an exchange rate fetch
 */
const isValidAmount = (amount: number | undefined): boolean => {
  if (amount === undefined) return false;
  return !isNaN(amount) && amount > 0;
};

/**
 * Fetches the exchange rate between two currencies using ExchangeRate-API.
 * Supports both fiat and crypto currencies.
 * @param fromCurrency - The currency code to convert from (e.g., 'USD', 'DAI').
 * @param toCurrency - The currency code to convert to (e.g., 'EUR', 'USDS').
 * @param amount - The amount to convert (optional, used for validation).
 * @returns The exchange rate from fromCurrency to toCurrency.
 */
export const getExchangeRate = async (
  fromCurrency: string,
  toCurrency: string,
  amount?: number,
): Promise<number> => {
  // Keep the tickers as given (uppercased) for the CoinGecko fallback, which
  // needs to know a side was a stablecoin, and resolve each to its fiat peg for
  // the primary lookup (USDC/USDS/DAI -> USD, EURC/EURE -> EUR). ExchangeRate-API
  // only serves fiat, so an unmapped stablecoin ticker makes the request fail.
  const rawBase = (fromCurrency || "").trim().toUpperCase();
  const rawQuote = (toCurrency || "").trim().toUpperCase();
  const base = toFiatCurrency(rawBase);
  const quote = toFiatCurrency(rawQuote);

  // Guard empty currencies
  if (!base || !quote) {
    return 1;
  }

  // Same currency, or two stablecoins sharing a peg (e.g. USDC and USDS): 1:1
  if (base === quote) {
    return 1;
  }

  // Skip API call if amount is explicitly provided and invalid
  if (amount !== undefined && !isValidAmount(amount)) {
    return 1;
  }

  // Create cache key
  const cacheKey = `${base}_${quote}`;

  // Return cached rate if available
  const cachedRate = exchangeRateCache[cacheKey];
  if (cachedRate !== undefined) {
    return cachedRate;
  }

  try {
    // Use a CORS-friendly endpoint that does not redirect
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.status}`);
    }

    const data = (await response.json()) as ExchangeRateAPIResponse;

    if (!data.rates || !data.rates[quote]) {
      throw new Error(`Exchange rate not found for ${base} to ${quote}`);
    }

    const exchangeRate = data.rates[quote];

    // Cache the result
    exchangeRateCache[cacheKey] = exchangeRate;

    return exchangeRate;
  } catch (error) {
    console.error("ExchangeRate-API error:", error);

    // Fallback: when one side was a stablecoin, ask CoinGecko for its live price
    // in the other side's fiat currency. This is checked against the ORIGINAL
    // tickers, not the pegged ones — by this point `base`/`quote` are always fiat,
    // so testing them would make this branch unreachable.
    //
    // CoinGecko's public API needs no key (verified), and `vs_currencies` accepts
    // the fiat codes we support (usd, eur, chf, gbp, jpy, cny, dkk).
    const baseCoin = coinGeckoId(rawBase);
    const quoteCoin = coinGeckoId(rawQuote);

    if (baseCoin || quoteCoin) {
      // Price the stablecoin side in the other side's fiat; invert when it's the
      // quote that's the stablecoin.
      const coin = baseCoin ?? quoteCoin!;
      const vsFiat = (baseCoin ? quote : base).toLowerCase();
      const invert = !baseCoin;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${vsFiat}`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);
        if (response.ok) {
          const data = (await response.json()) as CoinGeckoResponse;
          const price = data[coin]?.[vsFiat];
          if (typeof price === "number" && price > 0) {
            const rate = invert ? 1 / price : price;
            exchangeRateCache[cacheKey] = rate;
            return rate;
          }
        }
      } catch (cryptoError) {
        console.error("Crypto fallback error:", cryptoError);
      }
    }

    return 1; // Final fallback to 1:1 on error
  }
};

/** Currency list for selectors */
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
