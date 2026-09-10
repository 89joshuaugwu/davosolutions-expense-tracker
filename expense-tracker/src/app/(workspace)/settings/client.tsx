"use client";

import { useState } from "react";
import type { CompanySettings, ExchangeRate } from "@/domain/models";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { ExchangeRatesManager } from "@/components/settings/exchange-rates-manager";

interface Props {
  initialSettings: CompanySettings;
  initialRates: ExchangeRate[];
}

export function SettingsClient({ initialSettings, initialRates }: Props) {
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [rates, setRates] = useState<ExchangeRate[]>(initialRates);

  function handleSettingsSaved(newSettings: CompanySettings) {
    setSettings(newSettings);
  }

  function handleRateAdded(newRate: ExchangeRate) {
    // Replace the previous active rate for this pair with the new one
    setRates(prev => {
      const filtered = prev.filter(r => r.fromCurrency !== newRate.fromCurrency || r.toCurrency !== newRate.toCurrency);
      return [newRate, ...filtered];
    });
  }

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <h1>Company Settings</h1>
          <p>Manage your organization's financial preferences and active exchange rates.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <GeneralSettingsForm 
          initialSettings={settings} 
          onSaved={handleSettingsSaved} 
        />

        <ExchangeRatesManager 
          settings={settings} 
          activeRates={rates} 
          onRateAdded={handleRateAdded} 
        />
      </div>
    </div>
  );
}
