/**
 * Shared contract for the parcel-drawing satellite map. The component reads
 * and writes everything through the app store (points, location fix, HUD
 * text), so — exactly like the web original — it takes no props. The
 * interface exists so both platform files publish one surface: consumers
 * import the extensionless `./parcel-map` path and Metro picks the platform
 * file at bundle time (tsc resolves `.native` via `moduleSuffixes`).
 */
export interface ParcelMapProps {}
