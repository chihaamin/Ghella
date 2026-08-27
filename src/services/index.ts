/**
 * The public surface of the data layer. Screens and the store import from here
 * so no component ever needs to know which host an answer came from.
 */

export { cacheKey, cached, getJson, isHttpError, roundCoord } from "./http"
export type { FetchOptions, HttpError, HttpErrorKind } from "./http"

export { reverseGeocode } from "./geocode"
export { fetchArchive, fetchForecast } from "./weather"
export { fetchElevations } from "./elevation"
export { fetchSoil } from "./soil"
