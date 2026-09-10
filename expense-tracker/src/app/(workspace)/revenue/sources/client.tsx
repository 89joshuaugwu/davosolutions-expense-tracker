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
    <div className="layout-panel">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue Sources</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the sources from which your company generates revenue.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="btn-primary"
          disabled={isAdding}
        >
          Add Source
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <form onSubmit={handleAdd} className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="newSourceName" className="block text-sm font-medium text-gray-700 mb-1">
                Source Name
              </label>
              <input
                id="newSourceName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Consulting, Product Sales"
                className="input-field"
                required
                disabled={loading}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewName("");
                  setError("");
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading || !newName.trim()}>
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {sources.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No revenue sources found. Add one to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sources.map((source) => (
              <li key={source.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <h3 className={`font-medium ${source.status === "archived" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {source.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: <span className="capitalize">{source.status}</span>
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => handleToggleStatus(source)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {source.status === "active" ? "Archive" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
