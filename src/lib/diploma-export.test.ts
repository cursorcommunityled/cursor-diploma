import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toPng } from "html-to-image"

import {
  attendeePngName,
  buildPdfFromPngBlobs,
  certificateElementToPng,
  downloadBlob,
} from "./diploma-export"

vi.mock("html-to-image", () => ({
  toPng: vi.fn(() => Promise.resolve("data:image/png;base64,AA==")),
}))

const jspdfMock = vi.hoisted(() => {
  const mock = {
    addFont: vi.fn(),
    addImage: vi.fn(),
    addFileToVFS: vi.fn(),
    addPage: vi.fn(),
    constructor: vi.fn(),
    output: vi.fn(
      () =>
        new Blob(
          [`%PDF-1.3\n/MediaBox [0 0 841.89 595.28]\n${"x".repeat(1000)}`],
          { type: "application/pdf" }
        )
    ),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setLineWidth: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
    rect: vi.fn(),
    line: vi.fn(),
  }
  mock.constructor.mockImplementation(() => ({
    addFont: mock.addFont,
    addImage: mock.addImage,
    addFileToVFS: mock.addFileToVFS,
    addPage: mock.addPage,
    output: mock.output,
    setDrawColor: mock.setDrawColor,
    setFillColor: mock.setFillColor,
    setFont: mock.setFont,
    setFontSize: mock.setFontSize,
    setLineWidth: mock.setLineWidth,
    setTextColor: mock.setTextColor,
    splitTextToSize: mock.splitTextToSize,
    text: mock.text,
    rect: mock.rect,
    line: mock.line,
  }))
  return mock
})

vi.mock("jspdf", () => ({
  jsPDF: jspdfMock.constructor,
}))

function pngBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
}

describe("diploma-export", () => {
  let originalImage: typeof Image

  beforeEach(() => {
    vi.clearAllMocks()
    originalImage = globalThis.Image
    vi.stubGlobal(
      "Image",
      class {
        crossOrigin = ""
        naturalWidth = 3508
        naturalHeight = 2480
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        set src(_value: string) {
          window.setTimeout(() => this.onload?.(), 0)
        }
      }
    )
  })

  afterEach(() => {
    vi.stubGlobal("Image", originalImage)
    vi.useRealTimers()
    document.body.replaceChildren()
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
        pixelRatio: 3,
      })
    )
  })

  it("keeps editor-only chrome hidden during PNG capture", async () => {
    const el = document.createElement("div")
    const hidden = document.createElement("div")
    const visible = document.createElement("div")
    hidden.dataset.exportHidden = "true"

    await certificateElementToPng(el)

    const filter = vi.mocked(toPng).mock.calls[0]?.[1]?.filter
    if (!filter) {
      throw new Error("Expected html-to-image filter")
    }

    expect(filter(hidden)).toBe(false)
    expect(filter(visible)).toBe(true)
  })

  it("builds fixed A4 landscape PDF output from captured PNGs", async () => {
    const pdf = await buildPdfFromPngBlobs([pngBlob(), pngBlob()])

    expect(pdf.type).toBe("application/pdf")
    expect(pdf.size).toBeGreaterThan(1000)
    expect(jspdfMock.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: "pt",
        format: [841.89, 595.28],
        orientation: "landscape",
        compress: true,
      })
    )
    expect(jspdfMock.addImage).toHaveBeenCalledTimes(2)
    expect(jspdfMock.addPage).toHaveBeenCalledTimes(1)
    expect(toPng).not.toHaveBeenCalled()
  })

  it("uses an attached link and delayed cleanup for repeat downloads", () => {
    vi.useFakeTimers()
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURL = vi.fn(() => "blob:test-url")
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    )
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })

    try {
      downloadBlob("Ada.pdf", new Blob(["pdf"], { type: "application/pdf" }))
      const link = document.body.querySelector("a")

      expect(link).not.toBeNull()
      expect(link?.download).toBe("Ada.pdf")
      expect(click).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)

      expect(document.body.querySelector("a")).toBeNull()
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url")
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      })
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      })
      click.mockRestore()
    }
  })
})
