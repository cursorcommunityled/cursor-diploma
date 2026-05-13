import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getEventById,
  loadEvents,
  registerNewEvent,
  upsertEventRecord,
} from "./events-storage"

const store: Record<string, string> = {}

describe("events-storage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    for (const k of Object.keys(store)) {
      delete store[k]
    }
  })

  it("registers and loads events", () => {
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

    const a = registerNewEvent({ title: "A", notes: "n" })
    expect(getEventById(a.id)?.title).toBe("A")
    upsertEventRecord({ ...a, title: "A2" })
    expect(getEventById(a.id)?.title).toBe("A2")
    expect(loadEvents().length).toBe(1)
  })
})
