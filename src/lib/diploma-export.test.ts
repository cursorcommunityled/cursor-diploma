import { describe, expect, it } from "vitest"

import { attendeePngName } from "./diploma-export"

describe("diploma-export", () => {
  it("sanitizes PNG filenames for attendees", () => {
    expect(attendeePngName("  Ada Lovelace  ", 0)).toBe("Ada-Lovelace.png")
    expect(attendeePngName("", 2)).toBe("attendee-3.png")
  })
})
