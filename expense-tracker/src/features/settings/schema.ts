import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "@/domain/money";

const CurrencyCodeSchema = z.string().refine((val): val is CurrencyCode => val in CURRENCIES, {
  message: "Invalid currency code",
});

export const updateSettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  timezone: z.string().min(1, "Timezone is required").optional(),
  enabledCurrencies: z.array(CurrencyCodeSchema).min(1, "At least one currency must be enabled").optional(),
  reminderDays: z.array(z.number().int().min(1)).optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export const createExchangeRateSchema = z.object({
  fromCurrency: CurrencyCodeSchema,
  toCurrency: CurrencyCodeSchema,
  rate: z.string().regex(/^\d+(\.\d+)?$/, "Rate must be a positive number"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
}).refine((data) => data.fromCurrency !== data.toCurrency, {
  message: "From and To currencies must be different",
  path: ["fromCurrency"],
});

export type CreateExchangeRateDto = z.infer<typeof createExchangeRateSchema>;
