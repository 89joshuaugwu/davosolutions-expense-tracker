import "server-only";

import { requireSuperAdmin } from "@/lib/auth/server";
import { 
  getCompanySettings, 
  getOrCreateDefaultSettings, 
  updateCompanySettings 
} from "@/lib/server/repositories/settings";
import { 
  getActiveExchangeRates, 
  getExchangeRateHistory, 
  addExchangeRate 
} from "@/lib/server/repositories/exchange-rates";
import type { CompanySettings, ExchangeRate } from "@/domain/models";
import type { UpdateSettingsDto, CreateExchangeRateDto } from "./schema";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/domain/money";

export class SettingsService {
  /**
   * Returns current company settings (creates defaults if missing).
   * Accessible by Super Admin. (Other roles might need this for read-only via other services, but settings page is admin-only).
   */
  async getSettings(): Promise<CompanySettings> {
    await requireSuperAdmin();
    return await getOrCreateDefaultSettings();
  }

  /**
   * Updates company settings.
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<CompanySettings> {
    const user = await requireSuperAdmin();
    return await updateCompanySettings({
      ...dto,
      updatedBy: user.id,
    });
  }

  /**
   * Returns all active exchange rates against the base currency.
   */
  async getActiveRates(): Promise<ExchangeRate[]> {
    await requireSuperAdmin();
    return await getActiveExchangeRates();
  }

  /**
   * Returns exchange rate history for a specific currency converting to the base currency.
   */
  async getRateHistory(fromCurrency: CurrencyCode): Promise<ExchangeRate[]> {
    await requireSuperAdmin();
    const settings = await getOrCreateDefaultSettings();
    return await getExchangeRateHistory(fromCurrency, settings.baseCurrency);
  }

  /**
   * Adds a new exchange rate.
   */
  async addNewExchangeRate(dto: CreateExchangeRateDto): Promise<ExchangeRate> {
    const user = await requireSuperAdmin();
    const settings = await getOrCreateDefaultSettings();

    if (dto.toCurrency !== settings.baseCurrency) {
      throw new Error(`Target currency must be the base currency (${settings.baseCurrency})`);
    }

    if (!settings.enabledCurrencies.includes(dto.fromCurrency)) {
      throw new Error(`Currency ${dto.fromCurrency} is not enabled in settings`);
    }

    // Must be effective in the future or today, though we might allow past backfills in some systems.
    // For now, allow any valid YYYY-MM-DD string as validated by the schema.

    return await addExchangeRate(
      dto.fromCurrency,
      dto.toCurrency,
      dto.rate,
      dto.effectiveFrom as any,
      user.id
    );
  }
}
