"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { CompanySettings } from "@/domain/models";
import { CURRENCIES, type CurrencyCode } from "@/domain/money";

interface Props {
  initialSettings: CompanySettings;
  onSaved: (settings: CompanySettings) => void;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function GeneralSettingsForm({ initialSettings, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [companyName, setCompanyName] = useState(initialSettings.companyName);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(initialSettings.fiscalYearStartMonth);
  const [timezone, setTimezone] = useState(initialSettings.timezone);
  
  // Base currency is read-only if it has been locked
  const isBaseLocked = initialSettings.baseCurrencyLockedAt !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          fiscalYearStartMonth,
          timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      const updated = await res.json();
      onSaved(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel form-panel">
      <h2>General Settings</h2>
      <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
        Manage your company&apos;s core configuration.
      </p>

      {error && <div className="form-error">{error}</div>}
      {success && (
        <div className="notice success" style={{ marginBottom: 16 }}>
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="companyName">Company Name</label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fiscalYearStart">Fiscal Year Start Month</label>
            <select
              id="fiscalYearStart"
              value={fiscalYearStartMonth}
              onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Base Currency</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={`${CURRENCIES[initialSettings.baseCurrency].name} (${initialSettings.baseCurrency})`}
              disabled
              style={{ flex: 1, backgroundColor: 'var(--canvas)', color: 'var(--muted)' }}
            />
            {isBaseLocked && (
              <span className="badge warning">Locked</span>
            )}
          </div>
          <p className="field-hint">
            {isBaseLocked 
              ? "The base currency cannot be changed after financial records have been created." 
              : "The base currency will be locked when the first financial record is created."}
          </p>
        </div>

        <div className="form-actions">
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
