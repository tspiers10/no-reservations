"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useAuth } from "@/hooks/useAuth";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { RestaurantList } from "@/components/restaurant/RestaurantList";
import { SuggestRestaurantModal } from "@/components/restaurant/SuggestRestaurantModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserProfile } from "@/components/auth/UserProfile";
import type { RestaurantMapPin, WalkInStatus } from "@/types/restaurant";

// Pin colors per walk-in status
const PIN_COLORS: Record<WalkInStatus, string> = {
  walk_in_only: "#22c55e",          // green
  bar_seating: "#eab308",           // yellow
  large_parties_only: "#f97316",    // orange
  reservations_required: "#9ca3af", // grey
};

const PIN_LABELS: Record<WalkInStatus, string> = {
  walk_in_only: "Walk-in",
  bar_seating: "Bar only",
  large_parties_only: "1–4 only",
  reservations_required: "Reservations",
};

interface PinProps {
  status: WalkInStatus;
  isStale: boolean;
}

function RestaurantPin({ status, isStale }: PinProps) {
  const color = isStale ? "#9ca3af" : PIN_COLORS[status];
  return (
    <div className="cursor-pointer transition-transform hover:scale-110 active:scale-95 drop-shadow-lg"
         style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}>
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Teardrop body */}
        <path
          d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
          fill={color}
        />
        {/* White inner circle */}
        <circle cx="14" cy="13" r="5" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

interface MapEventsProps {
  onBoundsChange: (bounds: MapBounds) => void;
  onPinSelect: (restaurant: RestaurantMapPin) => void;
  restaurants: RestaurantMapPin[];
}

interface CoverageArea {
  id: string;
  name: string;
  boundary: { type: string; coordinates: number[][][][] | number[][][] };
}

function CoveragePolygons({ areas }: { areas: CoverageArea[] }) {
  const map = useMap();
  const polygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (!map) return;

    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    areas.forEach((area) => {
      const { type, coordinates } = area.boundary;

      // Normalise to array of rings: MultiPolygon has one extra nesting level
      const rings: number[][][][] =
        type === "MultiPolygon"
          ? (coordinates as number[][][][])
          : [(coordinates as number[][][])];

      rings.forEach((polygonRings) => {
        const paths = polygonRings.map((ring) =>
          ring.map(([lng, lat]) => ({ lat, lng }))
        );
        const polygon = new google.maps.Polygon({
          paths,
          strokeColor: "#64748b",
          strokeOpacity: 0.5,
          strokeWeight: 2,
          fillColor: "#64748b",
          fillOpacity: 0.05,
          map,
        });
        polygonsRef.current.push(polygon);
      });
    });

    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
    };
  }, [map, areas]);

  return null;
}

function MapEvents({ onBoundsChange, onPinSelect, restaurants }: MapEventsProps) {
  const map = useMap();

  const handleBoundsChanged = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onBoundsChange({
      swLat: sw.lat(),
      swLng: sw.lng(),
      neLat: ne.lat(),
      neLng: ne.lng(),
    });
  }, [map, onBoundsChange]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", handleBoundsChanged);
    return () => listener.remove();
  }, [map, handleBoundsChanged]);

  return (
    <>
      {restaurants.map((r) => (
        <AdvancedMarker
          key={r.id}
          position={{ lat: r.lat, lng: r.lng }}
          onClick={() => onPinSelect(r)}
          title={r.name}
        >
          <RestaurantPin
            status={r.walk_in_status as WalkInStatus}
            isStale={r.is_stale}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}

interface MapContainerProps {
  defaultLat: number;
  defaultLng: number;
  defaultZoom?: number;
  onRestaurantSelect?: (restaurant: RestaurantMapPin | null) => void;
}

export function MapContainer({
  defaultLat,
  defaultLng,
  defaultZoom = 15,
  onRestaurantSelect,
}: MapContainerProps) {
  const [bbox, setBbox] = useState<MapBounds | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantMapPin | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [showProfile, setShowProfile] = useState(false);
  // Local overrides applied after a confirmation, so re-opening a card shows fresh data
  const [overrides, setOverrides] = useState<Record<string, Partial<RestaurantMapPin>>>({});
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    setDarkMode(localStorage.getItem("mapDarkMode") === "true");
  }, []);
  const { restaurants, loading } = useRestaurants(bbox);

  // Merge local overrides into restaurant data so pin clicks always have fresh counts
  const displayRestaurants = useMemo(
    () => restaurants.map((r) => ({ ...r, ...(overrides[r.id] ?? {}) })),
    [restaurants, overrides]
  );
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetch("/api/coverage")
      .then((r) => r.json())
      .then((d) => setCoverageAreas(d.areas ?? []));
  }, []);

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("mapDarkMode", String(next));
      return next;
    });
  }

  const handlePinSelect = useCallback(
    (restaurant: RestaurantMapPin) => {
      setSelectedRestaurant(restaurant);
      onRestaurantSelect?.(restaurant);
    },
    [onRestaurantSelect]
  );

  const handleConfirmed = useCallback(
    (newStatus: WalkInStatus | "still_walk_in") => {
      if (!selectedRestaurant) return;
      const patch: Partial<RestaurantMapPin> = {
        confirmation_count: (selectedRestaurant.confirmation_count ?? 0) + 1,
        confirmation_count_30d: (selectedRestaurant.confirmation_count_30d ?? 0) + 1,
        last_confirmed_at: new Date().toISOString(),
        is_stale: false,
        walk_in_status:
          newStatus === "still_walk_in"
            ? selectedRestaurant.walk_in_status
            : (newStatus as WalkInStatus),
      };
      setOverrides((prev) => ({
        ...prev,
        [selectedRestaurant.id]: { ...(prev[selectedRestaurant.id] ?? {}), ...patch },
      }));
    },
    [selectedRestaurant]
  );

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="relative w-full h-full">
        <Map
          defaultCenter={{ lat: defaultLat, lng: defaultLng }}
          defaultZoom={defaultZoom}
          mapId="9a97ed0b328b6526fd5a0048"
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          mapTypeControl={false}
          streetViewControl={false}
          colorScheme={darkMode ? "DARK" : "LIGHT"}
          className="w-full h-full"
        >
          <CoveragePolygons areas={coverageAreas} />
          <MapEvents
            onBoundsChange={setBbox}
            onPinSelect={handlePinSelect}
            restaurants={displayRestaurants}
          />
        </Map>

        {/* Map / List toggle — top center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-white rounded-full shadow flex text-sm font-medium overflow-hidden">
            <button
              onClick={() => setView("map")}
              className={`px-4 py-2 transition-colors ${
                view === "map" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 transition-colors ${
                view === "list" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* List view panel — right side panel */}
        {view === "list" && (
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-white z-10 flex flex-col shadow-xl">
            <div className="px-4 pt-16 pb-2 border-b border-gray-100">
              <p className="text-xs text-gray-400">
                {displayRestaurants.filter(r => r.walk_in_status !== "reservations_required").length} restaurants in view
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <RestaurantList
                restaurants={displayRestaurants}
                loading={loading}
                onSelect={(r) => {
                  handlePinSelect(r);
                }}
              />
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className={`absolute top-4 z-20 bg-white rounded-full w-9 h-9 shadow flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all ${
            view === "list" ? "right-[29rem]" : "right-36"
          }`}
          aria-label="Toggle dark mode"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        {/* Auth button — top right */}
        <div className={`absolute top-4 z-10 transition-all ${view === "list" ? "right-[21rem]" : "right-4"}`}>
          {user ? (
            <button
              onClick={() => setShowProfile(true)}
              className="bg-white rounded-full px-4 py-2 shadow text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {user.email?.split("@")[0]}
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-white rounded-full px-4 py-2 shadow text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Auth modal */}
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}

        {/* User profile panel */}
        {showProfile && user && (
          <UserProfile
            user={user}
            onClose={() => setShowProfile(false)}
            onSignOut={signOut}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1 shadow text-xs text-gray-500">
            Loading…
          </div>
        )}

        {/* Restaurant card / bottom sheet */}
        {selectedRestaurant && (
          <RestaurantCard
            restaurant={displayRestaurants.find(r => r.id === selectedRestaurant.id) ?? selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            onSignInRequired={() => {
              setSelectedRestaurant(null);
              setShowAuthModal(true);
            }}
            onConfirmed={handleConfirmed}
          />
        )}

        {/* Pin legend */}
        <div className="absolute bottom-8 left-4 bg-white rounded-xl shadow-lg p-3 space-y-1.5 text-xs">
          {(Object.entries(PIN_LABELS) as [WalkInStatus, string][])
            .filter(([status]) => status !== "reservations_required")
            .map(([status, label]) => (
              <div key={status} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: PIN_COLORS[status] }}
                />
                <span className="text-gray-600">{label}</span>
              </div>
            ))}
        </div>

        {/* Add restaurant button — bottom right, above map controls */}
        <button
          onClick={() => {
            if (user) {
              setShowSuggestModal(true);
            } else {
              setShowAuthModal(true);
            }
          }}
          className={`absolute bottom-8 z-20 bg-gray-900 text-white rounded-full px-4 py-2 shadow-lg text-sm font-medium hover:bg-gray-700 transition-all flex items-center gap-1.5 ${view === "list" ? "right-[21rem]" : "right-4"}`}
          aria-label="Suggest a restaurant"
        >
          <span className="text-base leading-none">+</span>
          <span>Add restaurant</span>
        </button>

        {/* Suggest restaurant modal */}
        {showSuggestModal && (
          <SuggestRestaurantModal
            isSignedIn={!!user}
            onClose={() => setShowSuggestModal(false)}
            onSignInRequired={() => {
              setShowSuggestModal(false);
              setShowAuthModal(true);
            }}
          />
        )}
      </div>
    </APIProvider>
  );
}
