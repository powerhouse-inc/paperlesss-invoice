/**
 * Stablecoin -> fiat currency mapping.
 *
 * The FX providers we use (Frankfurter, ExchangeRate-API) only serve *fiat*
 * currencies. Passing a stablecoin ticker as `base` returns 404, which is why
 * every rate lookup has to normalise its inputs first.
 *
 * Each stablecoin is pegged 1:1 to the fiat currency it tracks, so substituting
 * the peg is the correct conversion for accounting purposes — a USDC invoice is
 * reported at the USD rate for that date.
 *
 * The authoritative currency list is `currencyList` in the invoice package
 * (editors/invoice-editor/utils/utils.ts). It is not importable here - the
 * package's `./editors/*` export only exposes `editor.d.ts` - so this map has to
 * be maintained alongside it. Every entry there with `crypto: true` needs a peg
 * below; the `crypto: false` entries (USD, EUR, DKK, GBP, JPY, CNY, CHF) are
 * already fiat and pass straight through.
 *
 * Note the peg cannot be derived from `currencyList` itself: that only records
 * whether a ticker is crypto, not which fiat currency it tracks.
 */
export const STABLECOIN_TO_FIAT: Record<string, string> = {
  // USD-pegged
  USDC: "USD",
  USDS: "USD",
  DAI: "USD",
  // EUR-pegged
  EURC: "EUR",
  EURE: "EUR",
};

/**
 * Returns the fiat currency an FX provider should be queried with.
 * Fiat tickers pass through unchanged; unknown tickers are returned as-is so a
 * new currency degrades to the caller's existing error handling rather than
 * being silently mapped to the wrong peg.
 */
export function toFiatCurrency(currency: string): string {
  if (!currency) return currency;
  const ticker = currency.toUpperCase();
  return STABLECOIN_TO_FIAT[ticker] ?? currency;
}

/** True when the ticker is one of the stablecoins we map to a fiat peg. */
export function isStablecoin(currency: string): boolean {
  return Boolean(currency) && currency.toUpperCase() in STABLECOIN_TO_FIAT;
}

/**
 * CoinGecko coin ids for our stablecoins, used by the crypto rate fallback.
 *
 * These are asset ids, not tickers, and they are not guessable - each one below
 * was verified against api.coingecko.com/api/v3/simple/price. Getting one wrong
 * silently returns the price of a *different* asset rather than an error, so
 * verify before editing (a bad id returns `{}`).
 */
export const COINGECKO_IDS: Record<string, string> = {
  USDC: "usd-coin",
  USDS: "usds",
  DAI: "dai",
  EURC: "euro-coin",
  EURE: "monerium-eur-money",
};

/** CoinGecko id for a stablecoin ticker, or undefined if we don't map it. */
export function coinGeckoId(currency: string): string | undefined {
  if (!currency) return undefined;
  return COINGECKO_IDS[currency.toUpperCase()];
}
