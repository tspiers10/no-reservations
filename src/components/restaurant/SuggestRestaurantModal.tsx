"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { WalkInStatus } from "@/types/restaurant";

interface SuggestRestaurantModalProps {
  isSignedIn: boolean;
  onClose: () => void;
  onSignInRequired: () => void;
}

const STATUS_OPTIONS: { value: WalkInStatus; label: string; description: string }[] = [
  { value: "walk_in_only",       label: "Walk-in only",    description: "Accepts walk-ins for all party sizes" },
  { value: "bar_seating",        label: "Bar seating only", description: "Walk-in only at the bar" },
  { value: "large_parties_only", label: "Walk-in for 1–4", description: "Walk-ins for small parties only" },
];

type Step = "form" | "success";

function isPointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // GeoJSON order: [lng, lat]
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInAnyPolygon(lat: number, lng: number, areas: { coordinates: number[][][] }[]): boolean {
  return areas.some((area) => isPointInPolygon(lat, lng, area.coordinates[0]));
}

export function SuggestRestaurantModal({
  isSignedIn,
  onClose,
  onSignInRequired,
}: SuggestRestaurantModalProps) {
  const placesLib = useMapsLibrary("places");

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [walkInStatus, setWalkInStatus] = useState<WalkInStatus>("walk_in_only");
  const [cuisine, setCuisine] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const coverageAreasRef = useRef<{ coordinates: number[][][] }[]>([]);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Fetch coverage area polygons once on mount for client-side validation
  useEffect(() => {
    fetch("/api/coverage")
      .then((r) => r.json())
      .then((data) => {
        coverageAreasRef.current = (data.areas ?? []).map(
          (a: { boundary: { coordinates: number[][][] } }) => a.boundary
        );
      })
      .catch(() => {});
  }, []);

  // Wire up Google Places Autocomplete once library is loaded
  useEffect(() => {
    if (!placesLib || !addressInputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(addressInputRef.current, {
      types: ["establishment"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "name", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      // Auto-populate restaurant name if field is empty
      if (!name && place.name) {
        setName(place.name);
      }

      if (place.formatted_address) {
        setAddress(place.formatted_address);
      }

      if (place.geometry?.location) {
        const placeLat = place.geometry.location.lat();
        const placeLng = place.geometry.location.lng();
        setLat(placeLat);
        setLng(placeLng);

        // Check coverage client-side for immediate feedback
        const areas = coverageAreasRef.current;
        if (areas.length > 0 && !isPointInAnyPolygon(placeLat, placeLng, areas)) {
          setLocationError(
            "This location is outside our current coverage area (Park Slope, Boerum Hill, Fort Greene, Prospect Heights, Brooklyn Heights)."
          );
        } else {
          setLocationError(null);
        }
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isSignedIn) {
      onClose();
      onSignInRequired();
      return;
    }

    if (!lat || !lng) {
      setError("Please select an address from the autocomplete suggestions so we can pin it on the map.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address,
          lat,
          lng,
          walk_in_status: walkInStatus,
          cuisine_type: cuisine.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        onClose();
        onSignInRequired();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStep("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim().length > 0 && address.length > 0 && lat !== null && lng !== null && !locationError;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suggest a restaurant"
        className="fixed z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {step === "form" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Suggest a restaurant</h2>
                <p className="text-sm text-gray-500 mt-0.5">We&apos;ll review it before adding to the map.</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1 -mr-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={100}
                  placeholder="e.g. Lucali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Address with Places autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  ref={addressInputRef}
                  type="text"
                  required
                  placeholder="Start typing an address…"
                  defaultValue={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setLat(null);
                    setLng(null);
                    setLocationError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {locationError ? (
                  <p className="text-xs text-red-500 mt-1">{locationError}</p>
                ) : lat !== null && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Location confirmed
                  </p>
                )}
              </div>

              {/* Walk-in status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Walk-in policy <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        walkInStatus === opt.value
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="walk_in_status"
                        value={opt.value}
                        checked={walkInStatus === opt.value}
                        onChange={() => setWalkInStatus(opt.value)}
                        className="mt-0.5 accent-gray-900"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cuisine (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuisine <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="e.g. Italian, Japanese, Mexican…"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Note (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anything else? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  maxLength={140}
                  rows={2}
                  placeholder="e.g. Best time to go is before 6pm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-xs text-gray-400 mt-0.5 text-right">{note.length}/140</p>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="pt-1 pb-1">
                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-sm
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:bg-gray-700 transition-colors"
                >
                  {loading ? "Submitting…" : "Submit suggestion"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="px-6 py-10 text-center space-y-3">
            <div className="text-5xl">🙏</div>
            <h2 className="text-lg font-semibold text-gray-900">Thanks!</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              We&apos;ll review your suggestion and add it to the map if it checks out.
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}
