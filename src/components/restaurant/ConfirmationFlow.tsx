"use client";

import { useState } from "react";
import type { WalkInStatus } from "@/types/restaurant";
import { captureEvent } from "@/lib/posthog";

type FlowStep = "buttons" | "changed-select" | "note" | "done";

interface ConfirmationFlowProps {
  restaurantId: string;
  currentStatus: WalkInStatus;
  isStale: boolean;
  onConfirmed: (newStatus: WalkInStatus | "still_walk_in") => void;
  onSignInRequired: () => void;
  isSignedIn: boolean;
}

const STATUS_OPTIONS: { value: WalkInStatus; label: string }[] = [
  { value: "walk_in_only", label: "Walk-in welcome" },
  { value: "bar_seating", label: "Bar seating only" },
  { value: "large_parties_only", label: "Walk-in for 1–4 only" },
  { value: "reservations_required", label: "Reservations required now" },
];

export function ConfirmationFlow({
  restaurantId,
  currentStatus,
  // isStale intentionally unused in current UI
  onConfirmed,
  onSignInRequired,
  isSignedIn,
}: ConfirmationFlowProps) {
  const [step, setStep] = useState<FlowStep>("buttons");
  const [selectedStatus, setSelectedStatus] = useState<WalkInStatus | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: WalkInStatus | "still_walk_in", noteText?: string) {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          status_submitted: status,
          note: noteText ?? null,
        }),
      });

      if (res.status === 401) {
        onSignInRequired();
        return;
      }

      if (res.status === 429) {
        setError("You've already confirmed this spot in the last 30 days.");
        return;
      }

      if (!res.ok) throw new Error("Failed to submit");

      captureEvent("confirmation_submitted", {
        status_submitted: status,
        restaurant_id: restaurantId,
        had_note: !!noteText,
      });
      setStep("done");
      onConfirmed(status);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="text-center py-2">
        <p className="text-sm font-medium text-red-600">Thanks for confirming! 🙌</p>
      </div>
    );
  }

  if (step === "buttons") {
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (!isSignedIn) { onSignInRequired(); return; }
              submit("still_walk_in");
            }}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium text-sm
                       hover:bg-red-700 active:bg-red-800 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Still walk-in ✓
          </button>
          <button
            onClick={() => {
              if (!isSignedIn) { onSignInRequired(); return; }
              setStep("changed-select");
            }}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm
                       hover:bg-gray-200 active:bg-gray-300 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            This changed ✗
          </button>
        </div>
        {!isSignedIn && (
          <p className="text-center text-xs text-gray-400">
            Sign in to confirm walk-in status
          </p>
        )}
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (step === "changed-select") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">What&apos;s the status now?</p>
        <div className="space-y-2">
          {STATUS_OPTIONS.filter((o) => o.value !== currentStatus).map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSelectedStatus(opt.value); setStep("note"); }}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200
                         hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm text-gray-700"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setStep("buttons")}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (step === "note") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Add a note? <span className="font-normal text-gray-400">(optional)</span></p>
        <textarea
          maxLength={140}
          rows={2}
          placeholder="e.g. Only bar seats available after 7pm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-red-600"
        />
        <p className="text-right text-xs text-gray-400">{note.length}/140</p>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("changed-select")}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm hover:bg-gray-200"
          >
            Back
          </button>
          <button
            onClick={() => submit(selectedStatus!, note || undefined)}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium text-sm
                       hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return null;
}
