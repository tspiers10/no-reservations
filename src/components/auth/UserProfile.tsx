"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface ConfirmationRecord {
  id: string;
  status_submitted: string;
  note: string | null;
  created_at: string;
  restaurants: {
    id: string;
    name: string;
    address: string;
    walk_in_status: string;
  } | null;
}

interface SuggestionRecord {
  id: string;
  name: string;
  address: string;
  cuisine_type: string | null;
  walk_in_status: string;
  status: "pending" | "approved" | "rejected" | "duplicate";
  submitted_at: string;
  reviewed_at: string | null;
}

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onSignOut: () => void;
}

type Tab = "confirmations" | "suggestions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function confirmationLabel(status: string): string {
  const map: Record<string, string> = {
    still_walk_in:         "Confirmed still walk-in ✓",
    walk_in_only:          "Changed → Walk-in only",
    bar_seating:           "Changed → Bar seating only",
    large_parties_only:    "Changed → Walk-in for 1–4",
    reservations_required: "Changed → Reservations required",
  };
  return map[status] ?? status;
}

const SUGGESTION_STATUS: Record<
  SuggestionRecord["status"],
  { label: string; bg: string; text: string }
> = {
  pending:   { label: "Under review",   bg: "bg-amber-100",  text: "text-amber-700" },
  approved:  { label: "Added to map ✓", bg: "bg-green-100",  text: "text-green-700" },
  rejected:  { label: "Not added",      bg: "bg-gray-100",   text: "text-gray-500"  },
  duplicate: { label: "Already listed", bg: "bg-gray-100",   text: "text-gray-500"  },
};

const WALK_IN_LABELS: Record<string, string> = {
  walk_in_only:          "Walk-in only",
  bar_seating:           "Bar seating only",
  large_parties_only:    "Walk-in for 1–4",
  reservations_required: "Reservations required",
};

export function UserProfile({ user, onClose, onSignOut }: UserProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>("confirmations");
  const [confirmations, setConfirmations] = useState<ConfirmationRecord[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [loadingConfirmations, setLoadingConfirmations] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setConfirmations(d.confirmations ?? []))
      .catch(() => setConfirmations([]))
      .finally(() => setLoadingConfirmations(false));

    fetch("/api/profile/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-sm bg-white shadow-2xl
                   flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">{user.email?.split("@")[0]}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("confirmations")}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "confirmations"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Confirmations
            {confirmations.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({confirmations.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "suggestions"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Suggestions
            {suggestions.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({suggestions.length})</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "confirmations" && (
            <>
              {loadingConfirmations ? (
                <p className="px-5 pt-4 text-sm text-gray-400">Loading…</p>
              ) : confirmations.length === 0 ? (
                <p className="px-5 pt-4 text-sm text-gray-400">
                  No confirmations yet — tap a pin and confirm a restaurant!
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {confirmations.map((c) => (
                    <div key={c.id} className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {c.restaurants?.name ?? "Unknown restaurant"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{confirmationLabel(c.status_submitted)}</p>
                      {c.note && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">&quot;{c.note}&quot;</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">{formatDate(c.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "suggestions" && (
            <>
              {loadingSuggestions ? (
                <p className="px-5 pt-4 text-sm text-gray-400">Loading…</p>
              ) : suggestions.length === 0 ? (
                <p className="px-5 pt-4 text-sm text-gray-400">
                  No suggestions yet — use the &quot;+ Add restaurant&quot; button on the map!
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {suggestions.map((s) => {
                    const statusConfig = SUGGESTION_STATUS[s.status];
                    return (
                      <div key={s.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 leading-snug">{s.name}</p>
                          <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {WALK_IN_LABELS[s.walk_in_status] ?? s.walk_in_status}
                          {s.cuisine_type ? ` · ${s.cuisine_type}` : ""}
                        </p>
                        <p className="text-xs text-gray-300 mt-1">Submitted {formatDate(s.submitted_at)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sign out */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => { onSignOut(); onClose(); }}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
