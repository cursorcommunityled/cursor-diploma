import { afterEach, describe, expect, it, vi } from "vitest"

import { createDraftForEvent } from "./diploma-types"
import { clearDiplomaDraft, loadDiplomaDraft, saveDiplomaDraft } from "./diploma-storage"

const store: Record<string, string> = {}

describe("diploma-storage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    for (const k of Object.keys(store)) {
      delete store[k]
    }
  })

  it("round-trips a draft in localStorage", () => {
    const ls: Storage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = v
      },
      removeItem: (k) => {
        delete store[k]
      },
      get length() {
        return Object.keys(store).length
      },
      key: (i) => Object.keys(store)[i] ?? null,
      clear: () => {
        for (const k of Object.keys(store)) {
          delete store[k]
        }
      },
    }
    vi.stubGlobal("localStorage", ls)

    const eventId = "e-roundtrip"
    const seed = {
      id: eventId,
      title: "Seeded",
      createdAtIso: "2020-01-01T00:00:00.000Z",
    }
    const d = createDraftForEvent({
      ...seed,
      id: eventId,
      title: "Test event",
    })
    expect(saveDiplomaDraft(eventId, d).ok).toBe(true)
    const read = loadDiplomaDraft(eventId, seed)
    expect(read.event.title).toBe("Test event")
    clearDiplomaDraft(eventId)
    const cleared = loadDiplomaDraft(eventId, seed)
    expect(cleared.event.title).toBe("Seeded")
  })
})
