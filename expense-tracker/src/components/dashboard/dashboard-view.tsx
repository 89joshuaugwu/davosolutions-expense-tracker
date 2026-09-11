"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, BarChart, Loader2, RefreshCw, Wallet, PiggyBank, Receipt, TrendingUp, TrendingDown, ClipboardList } from "lucide-react";
import { formatMoney, CURRENCIES } from "@/domain/money";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function DashboardView({ userRole, userName }: { userRole: string, userName: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?month=${month}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load dashboard");
      } else {
        setData(json);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isSuperAdmin = userRole === "super_admin";
  // The API returns analytics only if the user has permission to view them.
  const analytics = data?.analytics;
  const recent = data?.recentActivity;
  const summary = analytics?.summary;

  return (
    <div className="dashboard-container">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Welcome, {userName.split(" ")[0]}.</h1>
          <p>{isSuperAdmin ? "Here is your company's financial snapshot." : "Your day-to-day workspace starts here."}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input 
              type="month" 
              value={month} 
              onChange={e => setMonth(e.target.value)} 
              aria-label="Reporting Month"
            />
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="icon-button"
            style={{ border: '1px solid var(--line)', background: 'white', width: '38px', height: '38px' }}
            title="Refresh dashboard"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <p className="notice error" role="alert">
          <AlertCircle size={18} /> {error}
        </p>
      )}

      {loading && !data && (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading dashboard...</p>
        </div>
      )}

      {data && (
        <>
          {/* Super Admin / Permitted Analytics View */}
          {analytics && summary && (
            <div className="analytics-section">
              <div className="metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="panel metric-card">
                  <div className="metric-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <PiggyBank size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Opening Fund</span>
                  </div>
                  <h2 style={{ fontSize: '1.75rem', margin: '8px 0 4px' }}>
                    {formatMoney(summary.openingFundMinor, summary.baseCurrency)}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {analytics.hasFund ? "Allocated for month" : "No fund allocated"}
                  </p>
                </div>

                <div className="panel metric-card">
                  <div className="metric-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <TrendingUp size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Revenue</span>
                  </div>
                  <h2 style={{ fontSize: '1.75rem', margin: '8px 0 4px', color: 'var(--success)' }}>
                    {formatMoney(summary.totalRevenueMinor, summary.baseCurrency)}
                  </h2>
                </div>

                <div className="panel metric-card">
                  <div className="metric-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Receipt size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Expenses</span>
                  </div>
                  <h2 style={{ fontSize: '1.75rem', margin: '8px 0 4px', color: 'var(--error)' }}>
                    {formatMoney(summary.totalExpensesMinor, summary.baseCurrency)}
                  </h2>
                </div>

                <div className="panel metric-card">
                  <div className="metric-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Wallet size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Net Profit</span>
                  </div>
                  <h2 style={{ fontSize: '1.75rem', margin: '8px 0 4px' }}>
                    {formatMoney(summary.netProfitMinor, summary.baseCurrency)}
                  </h2>
                  {summary.profitMarginPercent !== null && (
                    <span className={`badge ${summary.netProfitMinor >= 0 ? 'success' : 'warning'}`}>
                      {summary.profitMarginPercent > 0 ? "+" : ""}{summary.profitMarginPercent}% margin
                    </span>
                  )}
                </div>
              </div>

              {/* Charts area */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div className="panel">
                  <h3 style={{ marginBottom: '16px' }}>Expense Breakdown</h3>
                  {analytics.categoryBreakdown.length > 0 ? (
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={analytics.categoryBreakdown.slice(0, 5)} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="categoryId" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={100} />
                          <Tooltip 
                            formatter={(value: any) => formatMoney(value, summary.baseCurrency)}
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                          />
                          <Bar dataKey="totalMinor" radius={[0, 4, 4, 0]}>
                            {analytics.categoryBreakdown.slice(0, 5).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill="var(--primary)" />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      <p>No expenses for this month.</p>
                    </div>
                  )}
                </div>
                
                <div className="panel">
                  <h3 style={{ marginBottom: '16px' }}>Revenue Sources</h3>
                  {analytics.revenueBreakdown.length > 0 ? (
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={analytics.revenueBreakdown.slice(0, 5)} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="sourceId" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={100} />
                          <Tooltip 
                            formatter={(value: any) => formatMoney(value, summary.baseCurrency)}
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                          />
                          <Bar dataKey="totalMinor" radius={[0, 4, 4, 0]}>
                            {analytics.revenueBreakdown.slice(0, 5).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill="var(--success)" />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      <p>No revenue for this month.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions (For both roles, tailored) */}
          <div className="panel" style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '16px' }}>Quick Actions</h3>
            <div className="quick-actions" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link className="button secondary" href="/expenses/new">
                <ArrowUpRight size={16} /> Log Expense
              </Link>
              <Link className="button secondary" href="/salaries/new">
                <ArrowUpRight size={16} /> Record Salary
              </Link>
              <Link className="button secondary" href="/transport/new">
                <ArrowUpRight size={16} /> Log Transport
              </Link>
              {isSuperAdmin && (
                <Link className="button secondary" href="/revenue/new">
                  <ArrowUpRight size={16} /> Record Revenue
                </Link>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {recent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>Recent Expenses</h3>
                  <Link href="/expenses" className="button secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>View all</Link>
                </div>
                {recent.recentExpenses.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recent.recentExpenses.map((exp: any) => (
                      <li key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
                        <div>
                          <strong>{exp.title}</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{exp.createdAt.split('T')[0]}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatMoney(exp.originalAmountMinor, exp.currency)}</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{exp.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="notice">No recent expenses.</p>
                )}
              </div>

              <div className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>Upcoming Bills</h3>
                  <Link href="/bills" className="button secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>View all</Link>
                </div>
                {recent.upcomingBills.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recent.upcomingBills.map((bill: any) => (
                      <li key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
                        <div>
                          <strong>{bill.name}</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Due: {bill.nextDueDate}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{formatMoney(bill.amountMinor, bill.currency)}</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{bill.frequency}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="notice">No upcoming bills.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
