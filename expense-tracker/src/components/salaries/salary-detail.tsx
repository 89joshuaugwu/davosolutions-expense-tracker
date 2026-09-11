"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Calendar, Check, Loader2, LockKeyhole, Trash2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/domain/money";
import type { SalaryLog } from "@/domain/models";
import { currentBusinessDate } from "@/domain/dates";

export function SalaryDetail({ salaryId, isSuperAdmin }: { salaryId: string; isSuperAdmin: boolean }) {
  const [salary, setSalary] = useState<SalaryLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [reason, setReason] = useState("");

  async function fetchDetail() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/salaries/${salaryId}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Failed to load salary."); return; }
      setSalary(data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    fetchDetail();
  }, [salaryId]);

  async function handleArchive() {
    if (!reason.trim()) { setActionError("Reason is required to archive."); return; }
    if (!confirm("Are you sure you want to archive this record?")) return;
    
    setActioning(true);
    setActionError("");
    try {
      const response = await fetch(`/api/salaries/${salaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", reason, expectedRevision: salary?.revision }),
      });
      if (!response.ok) {
        const data = await response.json();
        setActionError(data.error || "Failed to archive.");
      } else {
        setActionSuccess("Record archived successfully.");
        await fetchDetail();
      }
    } catch { setActionError("Network error."); }
    finally { setActioning(false); }
  }

  async function handlePay() {
    if (!confirm("Mark this salary as paid? This will create a ledger entry.")) return;
    
    setActioning(true);
    setActionError("");
    try {
      const response = await fetch(`/api/salaries/${salaryId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate: currentBusinessDate(), expectedRevision: salary?.revision }),
      });
      if (!response.ok) {
        const data = await response.json();
        setActionError(data.error || "Failed to mark as paid.");
      } else {
        setActionSuccess("Salary marked as paid.");
        await fetchDetail();
      }
    } catch { setActionError("Network error."); }
    finally { setActioning(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !salary) {
    return (
      <div className="max-w-3xl mx-auto mt-8 p-6 bg-red-50 border border-red-100 rounded-xl">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{error || "Record not found."}</p>
        </div>
        <div className="mt-6">
          <Link href="/salaries" className="inline-flex items-center gap-2 text-sm text-red-700 hover:text-red-800">
            <ArrowLeft className="w-4 h-4" /> Back to Salaries
          </Link>
        </div>
      </div>
    );
  }

  const isArchived = !!salary.archivedAt;
  const isPending = salary.status === "pending";
  const canModify = isSuperAdmin && !isArchived;
  const cDef = CURRENCIES[salary.currency as CurrencyCode];
  const bDef = CURRENCIES[salary.baseCurrency as CurrencyCode];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/salaries" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Salaries
        </Link>
        {isArchived && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <LockKeyhole className="w-3.5 h-3.5" /> Archived
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Salary Record</h1>
            <p className="text-sm text-gray-500 mt-1">ID: <span className="font-mono text-xs">{salary.id}</span></p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {cDef?.symbol}{formatMoney(salary.originalAmountMinor, salary.currency as CurrencyCode)}
            </div>
            {salary.currency !== salary.baseCurrency && (
              <div className="text-sm text-gray-500 mt-1 flex items-center justify-end gap-1">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{bDef?.symbol}{formatMoney(salary.baseAmountMinor, salary.baseCurrency as CurrencyCode)} base</span>
                <span className="text-xs" title={`Rate captured at ${salary.rateDate}`}>
                  @{salary.exchangeRateSnapshot}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Worker Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium text-gray-900">{salary.workerName || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600">Period</span>
                  <span className="font-medium text-gray-900">{salary.period || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600">Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPending ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                    {isPending ? "Pending" : "Paid"}
                  </span>
                </div>
                {!isPending && salary.paymentDate && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-600">Payment Date</span>
                    <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {salary.paymentDate}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {salary.notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                  {salary.notes}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">System Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900" title={salary.createdAt}>{new Date(salary.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Last Modified</span>
                  <span className="text-gray-900" title={salary.updatedAt}>{new Date(salary.updatedAt).toLocaleDateString()}</span>
                </div>
                {isArchived && (
                  <>
                    <div className="flex justify-between items-center py-1 mt-2 pt-2 border-t border-red-100 text-red-800">
                      <span>Archived</span>
                      <span title={salary.archivedAt!}>{new Date(salary.archivedAt!).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {salary.attachments && salary.attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Attachments
                </h3>
                <ul className="space-y-2">
                  {salary.attachments.map((att) => (
                    <li key={att.id}>
                      <a
                        href={`/api/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 p-3 bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-400 group-hover:text-indigo-600 transition-colors">
                          {att.contentType.startsWith("image/") ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{att.fileName}</p>
                          <p className="text-xs text-gray-500">{(att.sizeBytes / 1024).toFixed(1)} KB</p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {canModify && (
        <div className="bg-red-50 rounded-xl border border-red-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-100/50 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-700" />
            <h2 className="font-semibold text-red-900">Danger Zone (Super Admin)</h2>
          </div>
          <div className="p-6 space-y-4">
            {actionError && (
              <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4" /> {actionSuccess}
              </div>
            )}
            
            {isPending && (
              <div className="bg-white p-4 rounded-lg border border-red-100">
                <h3 className="text-sm font-medium text-gray-900 mb-1">Mark as Paid</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Marks this pending salary as paid for today and generates a ledger posting.
                </p>
                <button
                  onClick={handlePay}
                  disabled={actioning}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Mark Paid
                </button>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg border border-red-100">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Archive Record</h3>
              <p className="text-sm text-gray-500 mb-4">
                Archiving will soft-delete this record and reverse any ledger postings. This cannot be easily undone.
              </p>
              <div className="flex items-start gap-4 flex-col sm:flex-row">
                <input
                  type="text"
                  placeholder="Reason for archiving..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1 w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
                  disabled={actioning}
                />
                <button
                  onClick={handleArchive}
                  disabled={actioning || !reason.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors w-full sm:w-auto shrink-0"
                >
                  {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
