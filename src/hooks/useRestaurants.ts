"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RestaurantMapPin } from "@/types/restaurant";

interface BBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

interface UseRestaurantsResult {
  restaurants: RestaurantMapPin[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const FETCH_THRESHOLD = 0.001;

function bboxChanged(prev: BBox | null, next: BBox): boolean {
  if (!prev) return true;
  return (
    Math.abs(prev.swLat - next.swLat) > FETCH_THRESHOLD ||
    Math.abs(prev.swLng - next.swLng) > FETCH_THRESHOLD ||
    Math.abs(prev.neLat - next.neLat) > FETCH_THRESHOLD ||
    Math.abs(prev.neLng - next.neLng) > FETCH_THRESHOLD
  );
}

export function useRestaurants(bbox: BBox | null): UseRestaurantsResult {
  const [restaurants, setRestaurants] = useState<RestaurantMapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBbox = useRef<BBox | null>(null);
  const bboxRef = useRef<BBox | null>(bbox);
  const abortRef = useRef<AbortController | null>(null);

  // Keep bboxRef current so refresh() always has the latest bbox
  useEffect(() => {
    bboxRef.current = bbox;
  }, [bbox]);

  const fetchRestaurants = useCallback(async (box: BBox) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const params = `${box.swLat},${box.swLng},${box.neLat},${box.neLng}`;

    try {
      const res = await fetch(`/api/restaurants?bbox=${params}`, {
        signal: abortRef.current.signal,
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data: RestaurantMapPin[] = await res.json();
      setRestaurants(data);
      lastBbox.current = box;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Failed to load restaurants");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bbox) return;
    if (!bboxChanged(lastBbox.current, bbox)) return;
    fetchRestaurants(bbox);
  }, [bbox, fetchRestaurants]);

  const refresh = useCallback(() => {
    const currentBbox = bboxRef.current;
    if (!currentBbox) return;
    lastBbox.current = null;
    fetchRestaurants(currentBbox);
  }, [fetchRestaurants]);

  return { restaurants, loading, error, refresh };
}
