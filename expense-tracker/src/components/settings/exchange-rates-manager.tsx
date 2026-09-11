"use client";

import { useState } from "react";
import { Loader2, Plus, Clock, Globe } from "lucide-react";
import type { CompanySettings, ExchangeRate } from "@/domain/models";
import { CURRENCIES, type CurrencyCode } from "@/domain/money";
import { currentBusinessDate } from "@/domain/dates";

interface Props {
  settings: CompanySettings;
  activeRates: ExchangeRate[];
  onRateAdded: (newRate: ExchangeRate) => void;
}

export function ExchangeRatesManager({ settings, activeRates, onRateAdded }: Props) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  
  // New Rate Form State
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>(
    settings.enabledCurrencies.find(c => c !== settings.baseCurrency) || "USD"
  );
  const [rate, setRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(currentBusinessDate());

  const availableCurrencies = settings.enabledCurrencies.filter(c => c !== settings.baseCurrency);

  async function handleAddRate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");

    try {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          toCurrency: settings.baseCurrency,
          rate,
          effectiveFrom,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add exchange rate");
      }

      const newRate = await res.json();
      onRateAdded(newRate);
      setRate(""); // reset form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  const baseSymbol = CURRENCIES[settings.baseCurrency].symbol;

  return (
    <div className="panel form-panel">
      <h2>Exchange Rates</h2>
      <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
        Manage active rates for converting enabled currencies into your base currency ({settings.baseCurrency}).
      </p>

      {availableCurrencies.length === 0 ? (
        <div className="notice warning">
          You only have the base currency enabled. Add more currencies in General Settings to manage exchange rates.
        </div>
      ) : (
        <div className="table-container" style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Currency Pair</th>
                <th className="text-right">Rate</th>
                <th>Effective From</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeRates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="center muted py-4">No active exchange rates</td>
                </tr>
              ) : (
                activeRates.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={14} className="muted" />
                        <strong>{r.fromCurrency}</strong> to <strong>{r.toCurrency}</strong>
                      </div>
                    </td>
                    <td className="text-right">
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        1 {CURRENCIES[r.fromCurrency].symbol} = {baseSymbol}{r.rate}
                      </strong>
                    </td>
                    <td>{r.effectiveFrom}</td>
                    <td>
                      <span className="badge success">Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {availableCurrencies.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Add New Rate</h3>
          
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleAddRate} className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
              <label>From Currency</label>
              <select value={fromCurrency} onChange={e => setFromCurrency(e.target.value as CurrencyCode)}>
                {availableCurrencies.map(c => (
                  <option key={c} value={c}>{c} - {CURRENCIES[c].name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 2, minWidth: 150 }}>
              <label>Rate (1 {fromCurrency} = ? {settings.baseCurrency})</label>
              <div className="input-with-prefix">
                <span className="input-prefix">{baseSymbol}</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1600.50"
                  pattern="^\d+(\.\d+)?$"
                  title="Must be a positive number"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ flex: 1.5, minWidth: 150 }}>
              <label>Effective Date</label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
              />
            </div>

            <div className="form-group">
              <button type="submit" className="button primary" disabled={adding}>
                {adding ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                Add Rate
              </button>
            </div>
          </form>
          <p className="field-hint" style={{ marginTop: 8 }}>
            Adding a new rate will automatically supersede the current active rate for that currency pair.
          </p>
        </div>
      )}
    </div>
  );
}
