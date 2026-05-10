"use client";

import { useEffect, useRef, useState } from "react";
import type { RestaurantMapPin, WalkInStatus } from "@/types/restaurant";
import { ConfirmationFlow } from "./ConfirmationFlow";
import { useAuth } from "@/hooks/useAuth";

// ── Status badge ────────────────────────────────────────────

const STATUS_CONFIG: Record<
  WalkInStatus,
  { label: string; bg: string; text: string }
> = {
  walk_in_only: {
    label: "Walk-in only",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  bar_seating: {
    label: "Bar seating only",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  large_parties_only: {
    label: "Walk-in for 1–4",
    bg: "bg-orange-100",
    text: "text-orange-800",
  },
  reservations_required: {
    label: "Reservations required",
    bg: "bg-gray-100",
    text: "text-gray-600",
  },
};

function StatusBadge({ status }: { status: WalkInStatus }) {
  const { label, bg, text } = STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// ── Hours display ───────────────────────────────────────────

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

type DayKey = typeof DAY_NAMES[number];

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
}

function TodayHours({ hours }: { hours: RestaurantMapPin["hours"] }) {
  if (!hours) return <p className="text-sm text-gray-400">Hours not listed</p>;

  const today = DAY_NAMES[new Date().getDay()];
  const todayHours = hours[today as DayKey];

  if (!todayHours) {
    return <p className="text-sm text-gray-500">Closed today</p>;
  }

  return (
    <p className="text-sm text-gray-600">
      <span className="font-medium">Today </span>
      {formatTime(todayHours.open)} – {formatTime(todayHours.close)}
    </p>
  );
}

// ── Last confirmed ──────────────────────────────────────────

function LastConfirmed({
  lastConfirmedAt,
  isStale,
}: {
  lastConfirmedAt: string | null;
  isStale: boolean;
}) {
  if (!lastConfirmedAt) {
    return <p className="text-xs text-gray-400">Never confirmed by community</p>;
  }

  const date = new Date(lastConfirmedAt);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <p className={`text-xs ${isStale ? "text-amber-600" : "text-gray-400"}`}>
      {isStale
        ? `Last confirmed ${formatted} — has anything changed?`
        : `Confirmed ${formatted}`}
    </p>
  );
}

// ── Main card ───────────────────────────────────────────────

interface RestaurantCardProps {
  restaurant: RestaurantMapPin;
  onClose: () => void;
  onSignInRequired?: () => void;
  onConfirmed?: (newStatus: WalkInStatus | "still_walk_in") => void;
}

export function RestaurantCard({ restaurant, onClose, onSignInRequired, onConfirmed }: RestaurantCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [localRestaurant, setLocalRestaurant] = useState(restaurant);

  // Sync if parent passes a freshly-merged restaurant (e.g. on re-open)
  useEffect(() => {
    setLocalRestaurant(restaurant);
  }, [restaurant]);

  function handleConfirmed(newStatus: WalkInStatus | "still_walk_in") {
    setLocalRestaurant((prev) => ({
      ...prev,
      confirmation_count: prev.confirmation_count + 1,
      confirmation_count_30d: prev.confirmation_count_30d + 1,
      last_confirmed_at: new Date().toISOString(),
      is_stale: false,
      walk_in_status: newStatus === "still_walk_in" ? prev.walk_in_status : newStatus as WalkInStatus,
    }));
    onConfirmed?.(newStatus);
  }

  // Close on backdrop tap (map area)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const status = localRestaurant.walk_in_status as WalkInStatus;

  return (
    <>
      {/* Invisible backdrop — tap map to dismiss */}
      <div
        className="fixed inset-0 z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={restaurant.name}
        className="fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl
                   animate-slide-up max-w-lg mx-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-4">
          {/* Close button */}
          <div className="flex justify-end -mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Two-column layout: info left, photo right */}
          <div className="flex gap-4 items-start">
            {/* Left: all info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                  {localRestaurant.name}
                </h2>
                {localRestaurant.cuisine_type && (
                  <p className="text-sm text-gray-500 mt-0.5">{localRestaurant.cuisine_type}</p>
                )}
              </div>
              <StatusBadge status={status} />
              <TodayHours hours={localRestaurant.hours} />
              <p className="text-sm text-gray-500">{localRestaurant.address.replace(/,?\s*\d{5}(-\d{4})?$/, "")}</p>
              <div className="space-y-0.5">
                <p className="text-xs text-gray-400">
                  {localRestaurant.confirmation_count_30d === 0
                    ? "No community confirmations in the last 30 days"
                    : `${localRestaurant.confirmation_count_30d} confirmation${localRestaurant.confirmation_count_30d === 1 ? "" : "s"} in the last 30 days`}
                </p>
                <LastConfirmed
                  lastConfirmedAt={localRestaurant.last_confirmed_at}
                  isStale={localRestaurant.is_stale}
                />
              </div>
            </div>

            {/* Right: photo */}
            {localRestaurant.photo_url && (() => {
              let src = localRestaurant.photo_url;
              try {
                const u = new URL(src);
                const ref = u.searchParams.get("photo_reference");
                if (ref) src = `/api/photos?ref=${encodeURIComponent(ref)}`;
              } catch {}
              return (
                <div className="w-36 h-36 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                  <img
                    src={src}
                    alt={localRestaurant.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Community tip summary */}
          {localRestaurant.tip_summary && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-700">Tip </span>
              {localRestaurant.tip_summary}
            </p>
          )}

          {/* Confirmation flow */}
          <ConfirmationFlow
            restaurantId={localRestaurant.id}
            currentStatus={status}
            isStale={localRestaurant.is_stale}
            isSignedIn={!!user}
            onConfirmed={handleConfirmed}
            onSignInRequired={() => {
              onClose();
              onSignInRequired?.();
            }}
          />
        </div>
      </div>
    </>
  );
}
