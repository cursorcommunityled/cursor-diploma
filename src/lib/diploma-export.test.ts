import { beforeEach, describe, expect, it, vi } from "vitest"
import { toPng } from "html-to-image"

import { createDefaultDiplomaTemplate } from "./diploma-types"
import {
  attendeePngName,
  buildPdfFromDiplomas,
  certificateElementToPng,
} from "./diploma-export"

vi.mock("html-to-image", () => ({
  toPng: vi.fn(() => Promise.resolve("data:image/png;base64,AA==")),
}))

describe("diploma-export", () => {
  beforeEach(() => {
    vi.mocked(toPng).mockClear()
  })

  it("sanitizes PNG filenames for attendees", () => {
    expect(attendeePngName("  Ada Lovelace  ", 0)).toBe("Ada-Lovelace.png")
    expect(attendeePngName("", 2)).toBe("attendee-3.png")
  })

  it("keeps the preview background color during PNG capture", async () => {
    const el = document.createElement("div")
    el.style.backgroundColor = "#14120b"

    await certificateElementToPng(el)

    expect(toPng).toHaveBeenCalledWith(
      el,
      expect.objectContaining({
        backgroundColor: "rgb(20, 18, 11)",
      })
    )
  })

  it("builds PDF output without rasterizing the DOM preview", async () => {
    const template = {
      ...createDefaultDiplomaTemplate(),
      logos: [],
    }

    const pdf = await buildPdfFromDiplomas([
      {
        template,
        backgroundDataUrl: null,
        displayName: "Ada Lovelace",
        eventTitle: "Cursor Lab",
      },
    ])

    expect(pdf.type).toBe("application/pdf")
    expect(pdf.size).toBeGreaterThan(1000)
    expect(toPng).not.toHaveBeenCalled()
  })
})
