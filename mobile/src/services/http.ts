/**
 * The one place this app touches the network.
 *
 * Everything here assumes the worst connection in the room: a farmer standing
 * in a field with one bar of signal. So every request carries a hard deadline,
 * only the failures worth retrying are retried, and every answer worth keeping
 * is written to device storage — a stale answer beats a spinner that never stops.
 */

import { kvGet, kvKeys, kvRemove, kvSet } from "./storage"

const CACHE_PREFIX = "ghella:cache:v1:"
const DEFAULT_TIMEOUT_MS = 10_000

/** First backoff step, ms. Doubles per retry: 400, 800, 1600… */
const BACKOFF_BASE_MS = 400

export interface FetchOptions {
  /** Hard deadline for a single attempt. Default 10 000 ms. */
  timeoutMs?: number
  /** Extra attempts after the first. Default 1. */
  retries?: number
  /** The caller's signal — pass a React effect's so an unmount cancels cleanly. */
  signal?: AbortSignal
}

/** The four failure flavours the UI needs to tell apart. */
export type HttpErrorKind = "timeout" | "network" | "http" | "parse"

export interface HttpError extends Error {
  status?: number
  url: string
  kind: HttpErrorKind
}

/**
 * Narrow an unknown `catch` value to a transport failure raised by `getJson`.
 * Anything else — an abort, a mapping error thrown by a service — is not one.
 */
export function isHttpError(e: unknown): e is HttpError {
  if (!(e instanceof Error)) return false
  const candidate = e as Partial<HttpError>
  return typeof candidate.url === "string" && typeof candidate.kind === "string"
}

/**
 * Build the typed error. There are no classes in this codebase, and subclassing
 * Error is fragile across transpile targets anyway — a plain Error with fields
 * bolted on keeps `instanceof Error`, the stack and the message intact.
 */
function makeError(
  kind: HttpErrorKind,
  url: string,
  message: string,
  status?: number
): HttpError {
  return Object.assign(new Error(message), { kind, url, status })
}

function abortError(): Error {
  return Object.assign(new Error("Aborted"), { name: "AbortError" })
}

/** True for the browser's own DOMException and for the one above. */
function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError"
}

/** Only a flaky link or a struggling server is worth asking twice. A 4xx never is. */
function isRetryable(e: unknown): boolean {
  if (!isHttpError(e)) return false
  if (e.kind === "network") return true
  return e.kind === "http" && (e.status ?? 0) >= 500
}

/** Sleep that rejects the moment `signal` aborts, so a backoff never outlives its component. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer)
      reject(abortError())
    }
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * One attempt: fetch a URL AND read its body, under a single deadline chained
 * to the caller's signal.
 *
 * The body read has to live inside this function, not after it. `fetch`
 * resolves the moment the headers land; the megabyte of archive rows arrives
 * afterwards, and that is the part that stalls on a weak link. Parsing outside
 * the `finally` below would mean parsing after the deadline had been cleared
 * and the caller's abort unhooked — a stalled body would then hang forever,
 * which is precisely the failure the deadline exists to prevent.
 */
async function fetchJsonOnce<T>(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) throw abortError()

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  // The two signals are composed by hand: AbortSignal.any is too new to rely on
  // for the phones this ships to.
  const relay = () => controller.abort()
  signal?.addEventListener("abort", relay, { once: true })

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw makeError("http", url, `Server replied ${res.status}`, res.status)
    }
    try {
      return (await res.json()) as T
    } catch (e) {
      // A body that was cut off by our own deadline or the caller's abort is a
      // transport failure, not malformed JSON: let the outer catch name it.
      if (timedOut || signal?.aborted || isAbortError(e)) throw e
      throw makeError("parse", url, "The service sent something we could not read")
    }
  } catch (e) {
    // Already classified — a status code, or a body we genuinely could not read.
    if (isHttpError(e)) throw e
    // fetch reports a timeout and an unmount identically, so the flags decide.
    if (timedOut) {
      throw makeError("timeout", url, `No answer in ${Math.round(timeoutMs / 1000)} s`)
    }
    if (signal?.aborted) throw abortError()
    throw makeError("network", url, "No connection to the service")
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", relay)
  }
}

/**
 * GET a URL and parse it as JSON, with a deadline, backoff and typed failures.
 *
 * Aborts propagate untouched as an `AbortError` so a React effect that unmounts
 * mid-flight stays silent instead of being reported to the farmer as a fault.
 */
export async function getJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = Math.max(0, options.retries ?? 1)

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await delay(BACKOFF_BASE_MS * 2 ** (attempt - 1), options.signal)
    }
    try {
      return await fetchJsonOnce<T>(url, timeoutMs, options.signal)
    } catch (e) {
      // An unmount, a 4xx or a broken body: none of those get better by asking again.
      if (isAbortError(e) || attempt === retries || !isRetryable(e)) throw e
    }
  }

  // Unreachable — the final attempt always returns or throws.
  throw makeError("network", url, "Request failed")
}

/**
 * A serialiser for a service that publishes a request-rate limit.
 *
 * Two of these exist — Nominatim at one request a second, SoilGrids at about
 * five a minute — and both punish a burst by hanging rather than by answering
 * 429, so the app has to pace itself. Each limiter owns one promise chain: a
 * task runs after every task already queued and never sooner than `minGapMs`
 * after the previous one STARTED, which is the interval the policies are
 * written in.
 *
 * Two details that are easy to get wrong and matter here. The chain swallows
 * outcomes, so one rejection cannot wedge every later caller. And the wait is
 * abort-aware: six parcels queued behind a thirteen-second gap is over a minute
 * of waiting, and a farmer who has already left the screen should not be made
 * to finish it.
 */
export function rateLimiter(minGapMs: number): <T>(
  task: () => Promise<T>,
  signal?: AbortSignal
) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  let lastStartedAt = 0

  return <T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    const run = tail.then(async () => {
      if (signal?.aborted) throw abortError()
      const wait = lastStartedAt + minGapMs - Date.now()
      if (wait > 0) await delay(wait, signal)
      lastStartedAt = Date.now()
      return task()
    })
    tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}

interface CacheEntry<T> {
  v: T
  at: number
}

/** Reads survive a wiped store and half-written JSON. */
function readEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = kvGet(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T> | null
    if (!parsed || typeof parsed.at !== "number") return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Drop the oldest quarter of our own entries. Called only when a write fails,
 * which in practice means the quota is full — clearing a slice leaves room for
 * the write without wiping answers the farmer may need offline tomorrow.
 */
function pruneOldest(): void {
  const entries = kvKeys(CACHE_PREFIX).map((key) => ({
    key,
    at: readEntry(key.slice(CACHE_PREFIX.length))?.at ?? 0,
  }))
  entries.sort((a, b) => a.at - b.at)
  for (const entry of entries.slice(0, Math.max(1, Math.ceil(entries.length / 4)))) {
    kvRemove(entry.key)
  }
}

const MAX_CACHE_ENTRIES = 400

function writeEntry<T>(key: string, value: T): void {
  let payload: string
  try {
    payload = JSON.stringify({ v: value, at: Date.now() })
  } catch {
    return
  }
  // AsyncStorage never throws on quota the way localStorage does; keep the
  // cache bounded ourselves so years of tiles-worth of JSON can't pile up.
  if (kvKeys(CACHE_PREFIX).length >= MAX_CACHE_ENTRIES) pruneOldest()
  kvSet(CACHE_PREFIX + key, payload)
}

/**
 * Run `load` at most once per TTL, remembering the result in device storage.
 *
 * On failure a stale entry is served instead of throwing — that fallback is the
 * whole reason this app still works when the signal drops halfway up a hill.
 * An abort is not a failure, so it is never papered over with stale data.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const hit = readEntry<T>(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.v
  try {
    const fresh = await load()
    writeEntry(key, fresh)
    return fresh
  } catch (e) {
    if (hit && !isAbortError(e)) return hit.v
    throw e
  }
}

/** Stable key from parts: `cacheKey("soil", 36.55, -120.05)` → `"soil|36.55|-120.05"`. */
export function cacheKey(...parts: (string | number)[]): string {
  return parts.map(part => String(part)).join("|")
}

/**
 * Round a coordinate so nearby taps share one cache entry and one URL.
 * 3 dp is roughly 110 m — finer than any of these datasets resolve anyway.
 */
export function roundCoord(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  // -0 and 0 must produce the same key and the same query string.
  return rounded === 0 ? 0 : rounded
}
