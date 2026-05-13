import type { EventDetails } from "@/lib/diploma-types"
import { createId } from "@/lib/diploma-types"

const EVENTS_KEY = "cursor-community-hub:events:v1"

export type HubEventRecord = {
  id: string
  title: string
  /** ISO 8601 */
  createdAt: string
  notes?: string
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown
  } catch {
    return null
  }
}

function isEventRecord(raw: unknown): raw is HubEventRecord {
  if (!raw || typeof raw !== "object") {
    return false
  }
  const o = raw as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.createdAt === "string"
  )
}

function isEventRecordArray(raw: unknown): raw is Array<HubEventRecord> {
  return Array.isArray(raw) && raw.every(isEventRecord)
}

export function loadEvents(): Array<HubEventRecord> {
  if (typeof globalThis.localStorage === "undefined") {
    return []
  }
  const raw = globalThis.localStorage.getItem(EVENTS_KEY)
  if (!raw) {
    return []
  }
  const parsed = safeJsonParse(raw)
  if (!isEventRecordArray(parsed)) {
    return []
  }
  return parsed
}

export function saveEvents(events: Array<HubEventRecord>): void {
  if (typeof globalThis.localStorage === "undefined") {
    return
  }
  try {
    globalThis.localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  } catch {
    /* quota */
  }
}

export function getEventById(id: string): HubEventRecord | undefined {
  return loadEvents().find((e) => e.id === id)
}

export function upsertEventRecord(record: HubEventRecord): void {
  const list = loadEvents()
  const i = list.findIndex((e) => e.id === record.id)
  if (i === -1) {
    saveEvents([...list, record])
  } else {
    const next = [...list]
    next[i] = record
    saveEvents(next)
  }
}

export function upsertFromEventDetails(details: EventDetails): void {
  upsertEventRecord({
    id: details.id,
    title: details.title,
    createdAt: details.createdAtIso,
    notes: details.notes,
  })
}

export function eventDetailsFromRecord(r: HubEventRecord): EventDetails {
  return {
    id: r.id,
    title: r.title,
    createdAtIso: r.createdAt,
    notes: r.notes,
  }
}

export function createHubEvent(input: {
  title: string
  notes?: string
}): HubEventRecord {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: input.title.trim() || "Untitled event",
    createdAt: now,
    notes: input.notes?.trim() || undefined,
  }
}

export function registerNewEvent(input: {
  title: string
  notes?: string
}): HubEventRecord {
  const record = createHubEvent(input)
  upsertEventRecord(record)
  return record
}

export function deleteEvent(id: string): void {
  const next = loadEvents().filter((e) => e.id !== id)
  saveEvents(next)
}
