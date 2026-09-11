"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Loader2, Activity, Search } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  actor: { uid: string; role: string | null };
  target: { collection: string; id: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  metadata: { requestId?: string; ipHash?: string } | null;
  timestamp: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Login",
  "auth.logout": "Logout",
  "auth.login_denied": "Login Denied",
  "user.bootstrap": "User Bootstrap",
  "user.invite": "User Invited",
  "user.update": "User Updated",
  "user.role_change": "Role Changed",
  "record.create": "Record Created",
  "record.correct": "Record Corrected",
  "record.archive": "Record Archived",
  "record.recalculate": "Record Recalculated",
  "fund.create": "Fund Created",
  "fund.update": "Fund Updated",
  "rate.create": "Rate Created",
  "rate.update": "Rate Updated",
  "settings.update": "Settings Updated",
  "bill.payment": "Bill Payment",
  "bill.reminder": "Bill Reminder",
  "report.export": "Report Exported",
};

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  "auth.login": { color: "#2e7d32", bg: "#e8f5e9" },
  "auth.logout": { color: "#757575", bg: "#f5f5f5" },
  "auth.login_denied": { color: "#c62828", bg: "#fce4ec" },
  "record.create": { color: "#1565c0", bg: "#e3f2fd" },
  "record.correct": { color: "#e65100", bg: "#fff3e0" },
  "record.archive": { color: "#c62828", bg: "#fce4ec" },
  "user.invite": { color: "#6a1b9a", bg: "#f3e5f5" },
  "user.role_change": { color: "#e65100", bg: "#fff3e0" },
  "report.export": { color: "#00695c", bg: "#e0f2f1" },
};

const COLLECTIONS = ["expenses", "salaries", "transportLogs", "bills", "billPayments", "revenue", "monthlyFunds", "exchangeRates", "users", "settings", "auditLogs"];
const ACTIONS = Object.keys(ACTION_LABELS);

export function AuditLogList() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [action, setAction] = useState("");
  const [collection, setCollection] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (collection) params.set("collection", collection);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [action, collection, startDate, endDate]);

  const fetchEntries = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const qs = buildQueryString();
      const cursorParam = cursor ? `&cursor=${cursor}` : "";
      const res = await fetch(`/api/audit-logs?${qs}${cursorParam}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load audit logs."); return; }
      if (cursor) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setNextCursor(data.nextCursor);
    } catch { setError("Network error."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [buildQueryString]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getActionStyle = (act: string) => ACTION_COLORS[act] ?? { color: "#424242", bg: "#f5f5f5" };

  return (
    <div className="audit-log">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Audit Trail</h1>
          <p>A traceable history of every change and action in the system.</p>
        </div>
      </div>

      <div className="list-controls" style={{ flexWrap: "wrap" }}>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="filter-select">
          <option value="">All Actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
        </select>
        <select value={collection} onChange={(e) => setCollection(e.target.value)} className="filter-select">
          <option value="">All Targets</option>
          {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start Date" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End Date" />
        </div>
        {(action || collection || startDate || endDate) && (
          <button onClick={() => { setAction(""); setCollection(""); setStartDate(""); setEndDate(""); }} className="button secondary">
            Reset Filters
          </button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert"><AlertCircle size={16} /> {error}</p>
      )}

      {loading ? (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading audit trail…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-icon"><Activity size={28} /></span>
          <h3>No audit entries found</h3>
          <p>Try adjusting your filters or check back after some activity.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "30px" }}></th>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const style = getActionStyle(entry.action);
                  const isExpanded = expandedId === entry.id;
                  return (
                    <>
                      <tr key={entry.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                        <td>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDate(entry.timestamp)}</td>
                        <td>
                          <span className="badge" style={{ color: style.color, background: style.bg }}>
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <span title={entry.actor.uid}>{entry.actor.uid.slice(0, 8)}…</span>
                          {entry.actor.role && (
                            <span className="badge neutral" style={{ marginLeft: 4, fontSize: 10 }}>
                              {entry.actor.role === "super_admin" ? "Admin" : entry.actor.role}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <code style={{ fontSize: 12 }}>{entry.target.collection}/{entry.target.id.slice(0, 10)}</code>
                        </td>
                        <td style={{ fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.reason || "—"}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="audit-detail-row">
                          <td colSpan={6} style={{ padding: "16px 24px", background: "var(--surface)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                              {entry.before && (
                                <div>
                                  <strong style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase" }}>Before</strong>
                                  <pre style={{ fontSize: 12, background: "var(--bg)", padding: "12px", borderRadius: "6px", overflow: "auto", maxHeight: "300px", marginTop: "4px" }}>
                                    {JSON.stringify(entry.before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {entry.after && (
                                <div>
                                  <strong style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase" }}>After</strong>
                                  <pre style={{ fontSize: 12, background: "var(--bg)", padding: "12px", borderRadius: "6px", overflow: "auto", maxHeight: "300px", marginTop: "4px" }}>
                                    {JSON.stringify(entry.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {entry.reason && (
                              <div style={{ marginTop: "12px" }}>
                                <strong style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase" }}>Reason</strong>
                                <p style={{ marginTop: "4px", fontSize: 14 }}>{entry.reason}</p>
                              </div>
                            )}
                            {entry.metadata && (
                              <div style={{ marginTop: "12px" }}>
                                <strong style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase" }}>Metadata</strong>
                                <pre style={{ fontSize: 12, background: "var(--bg)", padding: "8px", borderRadius: "6px", marginTop: "4px" }}>
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div style={{ marginTop: "8px", fontSize: 11, color: "var(--text-secondary)" }}>
                              ID: <code>{entry.id}</code> • Full actor UID: <code>{entry.actor.uid}</code> • Full target: <code>{entry.target.collection}/{entry.target.id}</code>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
              <button className="button secondary" onClick={() => fetchEntries(nextCursor)} disabled={loadingMore}>
                {loadingMore ? <><Loader2 size={16} className="spin" /> Loading…</> : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
