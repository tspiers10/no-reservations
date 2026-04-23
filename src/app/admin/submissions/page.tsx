"use client";

import { useCallback, useEffect, useState } from "react";

interface Submission {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_type: string | null;
  walk_in_status: string;
  note: string | null;
  submitted_at: string;
  users: { email: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  walk_in_only:          "Walk-in only",
  bar_seating:           "Bar seating only",
  large_parties_only:    "Walk-in for 1–4",
  reservations_required: "Reservations required",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null); // id currently being approved/rejected

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/submissions");
      if (res.status === 401) {
        setError("Not authorized. Sign in as the founder to access this page.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load submissions");
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      setError("Failed to load submissions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  async function handleApprove(id: string) {
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to approve submission.");
        return;
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Reject this submission?")) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/reject`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to reject submission.");
        return;
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Restaurant Submissions</h1>
            <p className="text-sm text-gray-500 mt-1">Community-suggested restaurants pending review</p>
          </div>
          <button
            onClick={fetchSubmissions}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg px-3 py-1.5"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            No pending submissions 🎉
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <div className="space-y-4">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900">{s.name}</h2>
                      <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 font-medium">
                        {STATUS_LABELS[s.walk_in_status] ?? s.walk_in_status}
                      </span>
                      {s.cuisine_type && (
                        <span className="text-xs text-gray-400">{s.cuisine_type}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{s.address}</p>
                    {s.note && (
                      <p className="text-sm text-gray-600 mt-1 italic">&ldquo;{s.note}&rdquo;</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{s.users?.email ?? "unknown"}</span>
                      <span>·</span>
                      <span>{formatDate(s.submitted_at)}</span>
                      <span>·</span>
                      <a
                        href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        View on map ↗
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={actioning === s.id}
                      className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium
                                 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actioning === s.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(s.id)}
                      disabled={actioning === s.id}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium
                                 hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
