import { assertDateOnly, type DateOnly } from "./dates";

/** V1 explicitly supports currencies with two minor-unit decimal places. */
export const CURRENCIES = {
  NGN: { code: "NGN", symbol: "₦", decimals: 2, name: "Nigerian Naira" },
  USD: { code: "USD", symbol: "$", decimals: 2, name: "US Dollar" },
  GBP: { code: "GBP", symbol: "£", decimals: 2, name: "Pound Sterling" },
  EUR: { code: "EUR", symbol: "€", decimals: 2, name: "Euro" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const DEFAULT_CURRENCY: CurrencyCode = "NGN";
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_RATE_DECIMALS = 12;

export interface MoneySnapshot {
  readonly originalAmountMinor: number;
  readonly currency: CurrencyCode;
  readonly baseCurrency: CurrencyCode;
  /** Base-currency major units per ONE original-currency major unit. */
  readonly exchangeRateSnapshot: string;
  readonly rateDate: DateOnly;
  readonly baseAmountMinor: number;
}

export function assertCurrency(value: string): asserts value is CurrencyCode {
  if (!Object.hasOwn(CURRENCIES, value)) throw new Error("Unsupported currency.");
}

export function assertMinorAmount(value: number, allowNegative = false): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new Error("Amount must be a safe integer in minor units.");
  }
}

function checkedNumber(value: bigint): number {
  if (value > MAX_MINOR || value < -MAX_MINOR) throw new Error("Amount exceeds the safe minor-unit limit.");
  return Number(value);
}

/** Accept decimal text from forms. Never pass through parseFloat or Number first. */
export function parseAmountToMinor(
  decimal: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options: { allowZero?: boolean } = {},
): number {
  assertCurrency(currency);
  const digits = CURRENCIES[currency].decimals;
  if (typeof decimal !== "string") throw new Error("Amount must be supplied as decimal text.");
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(decimal);
  if (!match || (match[2]?.length ?? 0) > digits || decimal.length > 32) {
    throw new Error(`Enter an unsigned decimal amount with at most ${digits} decimal places.`);
  }
  const value = BigInt(match[1]!) * 10n ** BigInt(digits) + BigInt((match[2] ?? "").padEnd(digits, "0"));
  if (!options.allowZero && value === 0n) throw new Error("Amount must be greater than zero.");
  return checkedNumber(value);
}

function parseExchangeRate(rate: string): { numerator: bigint; denominator: bigint } {
  if (typeof rate !== "string") throw new Error("Exchange rate must be supplied as decimal text.");
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(rate);
  if (!match || (match[2]?.length ?? 0) > MAX_RATE_DECIMALS || rate.length > 40) {
    throw new Error("Exchange rate must be a positive decimal with at most 12 decimal places.");
  }
  const decimalPlaces = match[2]?.length ?? 0;
  const numerator = BigInt(`${match[1]}${match[2] ?? ""}`);
  if (numerator === 0n) throw new Error("Exchange rate must be greater than zero.");
  return { numerator, denominator: 10n ** BigInt(decimalPlaces) };
}

export function assertExchangeRate(rate: string): void {
  parseExchangeRate(rate);
}

/** Exact integer conversion, rounded once at the base minor unit using half-up. */
export function convertToBaseMinor(
  originalAmountMinor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  exchangeRate: string,
): number {
  assertMinorAmount(originalAmountMinor);
  assertCurrency(currency);
  assertCurrency(baseCurrency);
  const rate = parseExchangeRate(exchangeRate);
  if (currency === baseCurrency && rate.numerator !== rate.denominator) {
    throw new Error("A base-currency entry must use an exchange rate of 1.");
  }
  const numerator = BigInt(originalAmountMinor) * rate.numerator * 10n ** BigInt(CURRENCIES[baseCurrency].decimals);
  const denominator = rate.denominator * 10n ** BigInt(CURRENCIES[currency].decimals);
  const rounded = numerator / denominator + (2n * (numerator % denominator) >= denominator ? 1n : 0n);
  return checkedNumber(rounded);
}

export function createMoneySnapshot(input: {
  amount: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  exchangeRate: string;
  rateDate: DateOnly;
  allowZero?: boolean;
}): MoneySnapshot {
  assertDateOnly(input.rateDate);
  const originalAmountMinor = parseAmountToMinor(input.amount, input.currency, { allowZero: input.allowZero });
  return {
    originalAmountMinor,
    currency: input.currency,
    baseCurrency: input.baseCurrency,
    exchangeRateSnapshot: input.exchangeRate,
    rateDate: input.rateDate,
    baseAmountMinor: convertToBaseMinor(originalAmountMinor, input.currency, input.baseCurrency, input.exchangeRate),
  };
}

/** Reject inconsistent stored snapshots instead of silently accepting altered totals. */
export function assertMoneySnapshot(snapshot: MoneySnapshot): void {
  assertDateOnly(snapshot.rateDate);
  assertMinorAmount(snapshot.baseAmountMinor);
  const converted = convertToBaseMinor(
    snapshot.originalAmountMinor, snapshot.currency, snapshot.baseCurrency, snapshot.exchangeRateSnapshot,
  );
  if (converted !== snapshot.baseAmountMinor) throw new Error("Stored base amount does not match its exchange-rate snapshot.");
}

export function sumMinorAmounts(amounts: readonly number[]): number {
  return checkedNumber(amounts.reduce((total, amount) => {
    assertMinorAmount(amount, true);
    return total + BigInt(amount);
  }, 0n));
}

export function toDecimalAmount(amountMinor: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  assertMinorAmount(amountMinor, true);
  assertCurrency(currency);
  const amount = BigInt(amountMinor);
  const magnitude = amount < 0n ? -amount : amount;
  const factor = 10n ** BigInt(CURRENCIES[currency].decimals);
  return `${amount < 0n ? "-" : ""}${magnitude / factor}.${String(magnitude % factor).padStart(CURRENCIES[currency].decimals, "0")}`;
}

/** Format integers without losing the final minor unit on large valid amounts. */
export function formatMoney(amountMinor: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  const decimal = toDecimalAmount(amountMinor, currency);
  const [whole, fraction] = decimal.replace(/^-/, "").split(".");
  const formattedWhole = new Intl.NumberFormat("en-NG").format(BigInt(whole!));
  return `${amountMinor < 0 ? "−" : ""}${CURRENCIES[currency].symbol}${formattedWhole}.${fraction}`;
}
