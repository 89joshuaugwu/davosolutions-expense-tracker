"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Bill, BillPayment } from "@/domain/models";
import { formatMoney } from "@/domain/money";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, DollarSign } from "lucide-react";
import { currentBusinessDate } from "@/domain/dates";

export function BillDetail({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{ bill: Bill, payments: BillPayment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  
  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(currentBusinessDate());
  const [payNotes, setPayNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/bills/${id}`);
      if (!res.ok) throw new Error("Failed to load bill details");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (data?.bill) {
      // Initialize payAmount with expected amount
      setPayAmount((data.bill.amountMinor / 100).toFixed(2));
    }
  }, [data?.bill]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.bill) return;
    
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/bills/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceDate: data.bill.nextDueDate,
          paymentDate: payDate,
          actualAmount: payAmount,
          notes: payNotes,
          idempotencyKey,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record payment");

      setIdempotencyKey(crypto.randomUUID());
      setPayNotes("");
      await fetchDetail();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleStatusChange = async (newStatus: "paused" | "completed" | "active") => {
    if (!data?.bill) return;
    if (!isSuperAdmin) {
      alert("Only Super Admins can pause or complete a bill.");
      return;
    }
    const reason = prompt(`Reason for changing status to ${newStatus}?`);
    if (!reason) return;

    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reason,
          expectedRevision: data.bill.revision,
        }),
      });
      if (!res.ok) throw new Error("Failed to change status");
      await fetchDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateStr));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-md m-4">{error}</div>;
  if (!data?.bill) return null;

  const { bill, payments } = data;
  const isOverdue = bill.status === "active" && bill.nextDueDate < currentBusinessDate();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{bill.name}</h1>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
            bill.status === "active" ? "bg-green-100 text-green-800" :
            bill.status === "paused" ? "bg-yellow-100 text-yellow-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {bill.status.toUpperCase()}
          </span>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            {bill.status === "active" && (
              <button onClick={() => handleStatusChange("paused")} className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 font-medium rounded hover:bg-yellow-100 border border-yellow-200">Pause</button>
            )}
            {bill.status === "paused" && (
              <button onClick={() => handleStatusChange("active")} className="px-3 py-1.5 text-sm bg-green-50 text-green-700 font-medium rounded hover:bg-green-100 border border-green-200">Resume</button>
            )}
            {bill.status !== "completed" && (
              <button onClick={() => handleStatusChange("completed")} className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 font-medium rounded hover:bg-gray-100 border border-gray-200">Complete</button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Bill Details & Payment Form */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Provider</p>
                <p className="text-gray-900 font-medium">{bill.provider}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Expected Amount</p>
                <p className="text-xl font-bold text-gray-900">{formatMoney(bill.amountMinor, bill.currency as any)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Frequency</p>
                <p className="text-gray-900 capitalize">{bill.frequency.replace("_", "-")}</p>
              </div>
            </div>
          </div>

          {bill.status === "active" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-blue-100 bg-blue-100/50">
                <h3 className="font-semibold text-blue-900 flex items-center">
                  <DollarSign className="w-5 h-5 mr-1" />
                  Pay Upcoming Occurrence
                </h3>
              </div>
              <form onSubmit={handlePay} className="p-5 space-y-4">
                {payError && (
                  <div className="p-3 bg-red-100 text-red-800 text-xs rounded border border-red-200">{payError}</div>
                )}
                <div>
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Occurrence Date</p>
                  <p className={`font-bold flex items-center gap-2 ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                    <Calendar className="w-5 h-5" />
                    {formatDate(bill.nextDueDate)}
                    {isOverdue && <span className="text-xs bg-red-100 px-1.5 py-0.5 rounded text-red-700 font-semibold">OVERDUE</span>}
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Actual Amount Paid ({bill.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={paying}
                  className="w-full py-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {paying ? "Recording Payment..." : "Record Payment & Advance"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Payment History */}
        <div className="md:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Payment History</h3>
            </div>
            
            {payments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No payments have been recorded for this bill yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {payments.map(payment => (
                  <div key={payment.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="font-semibold text-gray-900">Occurrence: {formatDate(payment.occurrenceDate)}</span>
                        </div>
                        <p className="text-sm text-gray-500 pl-7">Paid on {formatDate(payment.paymentDate)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{formatMoney(payment.originalAmountMinor, payment.currency as any)}</div>
                        {payment.currency !== payment.baseCurrency && (
                          <div className="text-xs text-gray-500">Base: {formatMoney(payment.baseAmountMinor, payment.baseCurrency as any)}</div>
                        )}
                      </div>
                    </div>
                    {payment.notes && (
                      <div className="mt-3 pl-7 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                        {payment.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
