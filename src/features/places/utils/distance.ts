/** Haversine distance between two lat/lng points, in meters. */
import type { Place } from '../types';
import type { SearchLocation } from '../services/searchLocation';

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter a list of places to only those within `radiusMeters` of `center`.
 * Places with no location coordinates are kept (can't evaluate → don't penalize).
 */
export function filterByRadius(
  places: Place[],
  center: SearchLocation | null | undefined,
  radiusMeters: number | undefined,
): Place[] {
  if (!center || !radiusMeters) return places;
  return places.filter((p) => {
    if (!p.location) return true;
    return haversineMeters(center.lat, center.lng, p.location.lat, p.location.lng) <= radiusMeters;
  });
}
