"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatMoney } from "@/domain/money";
import { AlertCircle, Calendar, Plus } from "lucide-react";

interface BillListItem {
  id: string;
  name: string;
  provider: string;
  amountMinor: number;
  currency: string;
  frequency: string;
  nextDueDate: string;
  status: "active" | "paused" | "completed";
}

export function BillList() {
  const [bills, setBills] = useState<BillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | "completed">("active");

  const fetchBills = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills?status=${status}`);
      if (!res.ok) throw new Error("Failed to load bills");
      const data = await res.json();
      setBills(data.bills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills(statusFilter);
  }, [statusFilter, fetchBills]);

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric"
    }).format(new Date(dateStr));
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case "active": return <span className="badge success">Active</span>;
      case "paused": return <span className="badge warning">Paused</span>;
      case "completed": return <span className="badge neutral">Completed</span>;
      default: return null;
    }
  };

  // Compute "due today" / "overdue" / "upcoming" locally
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bill-list-page">
      <div className="page-heading">
        <div>
          <h1>Bills & Occurrences</h1>
          <p>Track subscriptions and upcoming payments.</p>
        </div>
        <div className="heading-actions">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="active">Active Bills</option>
              <option value="paused">Paused Bills</option>
              <option value="completed">Completed Bills</option>
            </select>
          </div>
          <Link href="/bills/new" className="button primary">
            <Plus size={16} /> New Bill
          </Link>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading ? (
        <div className="loading-state">
          <p>Loading bills...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Calendar size={28} />
          </span>
          <h3>No {statusFilter} bills found</h3>
          <p>You have no bills matching this status.</p>
          <Link href="/bills/new" className="button primary">
            Add a new bill
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill Name</th>
                <th>Provider</th>
                <th className="text-right">Amount</th>
                <th>Frequency</th>
                <th>Next Due Date</th>
                <th className="center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const isOverdue = bill.status === "active" && bill.nextDueDate < today;
                const isDueToday = bill.status === "active" && bill.nextDueDate === today;
                return (
                  <tr key={bill.id}>
                    <td><strong>{bill.name}</strong></td>
                    <td>{bill.provider}</td>
                    <td className="text-right amount-cell">
                      <strong>{formatMoney(bill.amountMinor, bill.currency as any)}</strong>
                    </td>
                    <td><span className="badge neutral" style={{ textTransform: 'capitalize' }}>{bill.frequency.replace("_", "-")}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={isOverdue ? "muted" : isDueToday ? "muted" : ""}>
                          {formatDate(bill.nextDueDate)}
                        </span>
                        {isOverdue && <span className="badge" style={{ color: '#c4403b', background: '#fff2f1' }}>Overdue</span>}
                        {isDueToday && <span className="badge" style={{ color: '#bc8a36', background: '#fff8ee' }}>Due Today</span>}
                      </div>
                    </td>
                    <td className="center">
                      {getStatusDisplay(bill.status)}
                    </td>
                    <td className="text-right">
                      <Link href={`/bills/${bill.id}`} className="text-link">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
