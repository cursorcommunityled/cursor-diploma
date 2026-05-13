import type { DiplomaDraftV1, EventDetails } from "@/lib/diploma-types"
import {
  DIPLOMA_DRAFT_VERSION,
  createDraftForEvent,
  normalizeDiplomaDraft,
} from "@/lib/diploma-types"
import { upsertFromEventDetails } from "@/lib/events-storage"

const LEGACY_STORAGE_KEY = "cursor-community-hub:diploma:draft"

export function diplomaDraftStorageKey(eventId: string): string {
  return `cursor-community-hub:diploma:draft:${eventId}`
}

/** Skip persisting very large data URLs in localStorage */
export const MAX_BACKGROUND_PERSIST_BYTES = 2_500_000

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown
  } catch {
    return null
  }
}

function isV1(raw: unknown): raw is DiplomaDraftV1 {
  if (!raw || typeof raw !== "object") {
    return false
  }
  const o = raw as Record<string, unknown>
  if (o.version !== DIPLOMA_DRAFT_VERSION) {
    return false
  }
  if (!o.event || !o.template) {
    return false
  }
  if (o.csv != null && typeof o.csv !== "object") {
    return false
  }
  return true
}

function normalizeDraftForEvent(
  eventId: string,
  seedEvent: EventDetails,
  parsed: DiplomaDraftV1
): DiplomaDraftV1 {
  const event: EventDetails =
    parsed.event.id === eventId
      ? {...parsed.event, id: eventId}
      : {...seedEvent, id: eventId}
  return normalizeDiplomaDraft({
    ...parsed,
    event,
    csv: parsed.csv ?? null,
  })
}

export function loadDiplomaDraft(
  eventId: string,
  seedEvent: EventDetails
): DiplomaDraftV1 {
  if (typeof globalThis.localStorage === "undefined") {
    return createDraftForEvent({...seedEvent, id: eventId})
  }
  const raw = globalThis.localStorage.getItem(diplomaDraftStorageKey(eventId))
  if (!raw) {
    return createDraftForEvent({...seedEvent, id: eventId})
  }
  const parsed = safeJsonParse(raw)
  if (isV1(parsed)) {
    return normalizeDraftForEvent(eventId, seedEvent, parsed)
  }
  return createDraftForEvent({...seedEvent, id: eventId})
}

export function saveDiplomaDraft(
  eventId: string,
  draft: DiplomaDraftV1
): {
  ok: boolean
  backgroundSkipped: boolean
} {
  if (typeof globalThis.localStorage === "undefined") {
    return { ok: false, backgroundSkipped: false }
  }
  const aligned: DiplomaDraftV1 = {
    ...draft,
    event: {...draft.event, id: eventId},
  }
  upsertFromEventDetails(aligned.event)
  let backgroundSkipped = false
  const toSave: DiplomaDraftV1 = {...aligned}
  if (aligned.backgroundDataUrl) {
    const size = new Blob([aligned.backgroundDataUrl]).size
    if (size > MAX_BACKGROUND_PERSIST_BYTES) {
      toSave.backgroundDataUrl = null
      backgroundSkipped = true
    }
  }
  try {
    globalThis.localStorage.setItem(
      diplomaDraftStorageKey(eventId),
      JSON.stringify(toSave)
    )
    return { ok: true, backgroundSkipped }
  } catch {
    return { ok: false, backgroundSkipped }
  }
}

export function clearDiplomaDraft(eventId: string): void {
  if (typeof globalThis.localStorage === "undefined") {
    return
  }
  globalThis.localStorage.removeItem(diplomaDraftStorageKey(eventId))
}

/**
 * One-time migration from the pre-events global draft key.
 * Registers the event and returns its id if migration ran.
 */
export function migrateLegacyGlobalDiplomaDraft(): string | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null
  }
  const raw = globalThis.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) {
    return null
  }
  const parsed = safeJsonParse(raw)
  if (!isV1(parsed)) {
    globalThis.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return null
  }
  const draft = normalizeDiplomaDraft({
    ...parsed,
    event: parsed.event,
    csv: parsed.csv ?? null,
  })
  const eventId = draft.event.id
  upsertFromEventDetails(draft.event)
  try {
    globalThis.localStorage.setItem(
      diplomaDraftStorageKey(eventId),
      JSON.stringify({
        ...draft,
        event: {...draft.event, id: eventId},
        csv: draft.csv ?? null,
      })
    )
    globalThis.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    return null
  }
  return eventId
}
