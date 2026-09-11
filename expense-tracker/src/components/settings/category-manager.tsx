"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Archive, Check, Loader2, Plus, RotateCcw, X } from "lucide-react";
import type { Category, ExpenseKind } from "@/domain/models";

const TYPE_LABELS: Record<ExpenseKind, string> = {
  general: "General",
  salary: "Salary",
  transport: "Transport",
  bill: "Bill",
  other: "Other",
};

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load categories."); return; }
      setCategories(data.categories);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleToggleStatus = async (cat: Category) => {
    const newStatus = cat.status === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update category.");
        return;
      }
      fetchCategories();
    } catch { setError("Network error."); }
  };

  const activeCategories = categories.filter((c) => c.status === "active");
  const archivedCategories = categories.filter((c) => c.status === "archived");

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Expense Categories</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
            Manage the categories available for expense classification.
          </p>
        </div>
        <button className="button secondary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Category</>}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert" style={{ marginBottom: "12px" }}>
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {showAddForm && (
        <AddCategoryForm
          onCreated={() => { setShowAddForm(false); fetchCategories(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <div className="loading-state" style={{ padding: "1rem" }}>
          <Loader2 size={20} className="spin" />
          <p>Loading categories…</p>
        </div>
      ) : (
        <>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Sort Order</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeCategories.map((cat) => (
                <tr key={cat.id}>
                  <td><strong>{cat.name}</strong></td>
                  <td><span className="badge neutral">{TYPE_LABELS[cat.type] ?? cat.type}</span></td>
                  <td>{cat.sortOrder}</td>
                  <td><span className="badge success">Active</span></td>
                  <td className="text-right">
                    <button className="text-link" onClick={() => handleToggleStatus(cat)} title="Archive category">
                      <Archive size={14} /> Archive
                    </button>
                  </td>
                </tr>
              ))}
              {archivedCategories.map((cat) => (
                <tr key={cat.id} className="archived-row">
                  <td>{cat.name}</td>
                  <td><span className="badge neutral">{TYPE_LABELS[cat.type] ?? cat.type}</span></td>
                  <td>{cat.sortOrder}</td>
                  <td><span className="badge" style={{ color: "#c4403b", background: "#fff2f1" }}>Archived</span></td>
                  <td className="text-right">
                    <button className="text-link" onClick={() => handleToggleStatus(cat)} title="Restore category">
                      <RotateCcw size={14} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function AddCategoryForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ExpenseKind>("general");
  const [sortOrder, setSortOrder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body: any = { name, type };
      if (sortOrder) body.sortOrder = parseInt(sortOrder, 10);

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create category."); return; }
      onCreated();
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "16px", background: "var(--surface)", borderRadius: "8px", marginBottom: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cat-name">Category Name</label>
          <input id="cat-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cat-type">Type</label>
          <select id="cat-type" value={type} onChange={(e) => setType(e.target.value as ExpenseKind)}>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="cat-sort">Sort Order (optional)</label>
          <input id="cat-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={1} max={999} />
        </div>
      </div>
      {error && <p className="form-error" role="alert" style={{ marginTop: "8px" }}><AlertCircle size={16} /> {error}</p>}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? <><Loader2 size={16} className="spin" /> Creating…</> : <><Check size={16} /> Create</>}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
