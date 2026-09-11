"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RevenueSource } from "@/domain/models";

export function RevenueSourcesClient({ initialSources }: { initialSources: RevenueSource[] }) {
  const router = useRouter();
  const [sources, setSources] = useState<RevenueSource[]>(initialSources);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/revenue/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), sortOrder: sources.length }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add source");
      }

      const data = await res.json();
      const newSource: RevenueSource = {
        id: data.id,
        name: newName.trim(),
        status: "active",
        sortOrder: sources.length,
      };

      setSources([...sources, newSource]);
      setNewName("");
      setIsAdding(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (source: RevenueSource) => {
    const newStatus = source.status === "active" ? "archived" : "active";
    const originalSources = [...sources];
    
    // Optimistic update
    setSources(sources.map((s) => (s.id === source.id ? { ...s, status: newStatus } : s)));

    try {
      const res = await fetch(`/api/revenue/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update source");
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message);
      // Revert on failure
      setSources(originalSources);
    }
  };

  return (
    <div>
      <div className="page-heading">
        <div>
          <h1>Revenue Sources</h1>
          <p>
            Manage the sources from which your company generates revenue.
          </p>
        </div>
        <div className="heading-actions">
          <button
            onClick={() => setIsAdding(true)}
            className="button primary"
            disabled={isAdding}
          >
            Add Source
          </button>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isAdding && (
        <div className="panel" style={{ padding: "20px", marginBottom: "20px" }}>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: "15px", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="newSourceName">Source Name</label>
              <input
                id="newSourceName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Consulting, Product Sales"
                required
                disabled={loading}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewName("");
                  setError("");
                }}
                className="button secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={loading || !newName.trim()}>
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Source Name</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  No revenue sources found. Add one to get started.
                </td>
              </tr>
            ) : (
              sources.map((source) => (
                <tr key={source.id} className={source.status === "archived" ? "archived-row" : ""}>
                  <td>
                    <strong>{source.name}</strong>
                  </td>
                  <td>
                    <span className={`badge ${source.status === "active" ? "success" : "neutral"}`}>
                      {source.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleToggleStatus(source)}
                      className="text-button"
                    >
                      {source.status === "active" ? "Archive" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
