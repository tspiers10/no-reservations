"use client";

import type { RestaurantMapPin, WalkInStatus } from "@/types/restaurant";

const STATUS_CONFIG: Record<WalkInStatus, { label: string; color: string }> = {
  walk_in_only:          { label: "Walk-in only",         color: "#22c55e" },
  bar_seating:           { label: "Bar seating only",     color: "#eab308" },
  large_parties_only:    { label: "Walk-in for 1–4",      color: "#f97316" },
  reservations_required: { label: "Reservations required", color: "#9ca3af" },
};

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

function todayHoursString(hours: RestaurantMapPin["hours"]): string {
  if (!hours) return "Hours not listed";
  const today = DAY_NAMES[new Date().getDay()];
  const h = hours[today as DayKey];
  if (!h) return "Closed today";
  return `${formatTime(h.open)} – ${formatTime(h.close)}`;
}

interface RestaurantListProps {
  restaurants: RestaurantMapPin[];
  loading: boolean;
  onSelect: (restaurant: RestaurantMapPin) => void;
}

export function RestaurantList({ restaurants, loading, onSelect }: RestaurantListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-sm text-gray-400 space-y-1">
        <p>No restaurants in this area</p>
        <p className="text-xs">Try zooming out or panning the map</p>
      </div>
    );
  }

  // Hide reservations-required by default (same as map)
  const visible = restaurants.filter((r) => r.walk_in_status !== "reservations_required");

  return (
    <div className="divide-y divide-gray-100 overflow-y-auto h-full">
      {visible.map((r) => {
        const status = STATUS_CONFIG[r.walk_in_status as WalkInStatus];
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100
                       transition-colors flex items-start gap-3"
          >
            {/* Status dot */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
              style={{ backgroundColor: r.is_stale ? "#d1d5db" : status.color }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 text-sm leading-snug truncate">
                  {r.name}
                </p>
                {r.is_stale && (
                  <span className="text-xs text-amber-500 flex-shrink-0">Unconfirmed</span>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-0.5">{status.label}</p>

              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-gray-400">{todayHoursString(r.hours)}</p>
                {r.confirmation_count > 0 && (
                  <p className="text-xs text-gray-400">
                    {r.confirmation_count} confirmation{r.confirmation_count === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              {r.cuisine_type && (
                <p className="text-xs text-gray-400 mt-0.5">{r.cuisine_type}</p>
              )}
            </div>

            {/* Chevron */}
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
