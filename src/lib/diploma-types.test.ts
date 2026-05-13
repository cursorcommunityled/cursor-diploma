import { describe, expect, it } from "vitest"

import {
  MAX_SIGNATURE_LINES,
  createDefaultDiplomaTemplate,
  migrateSignatureLine,
  normalizeDiplomaTemplate,
} from "./diploma-types"

describe("diploma-types signatures", () => {
  it("migrates legacy label to role and fills optional fields", () => {
    const s = migrateSignatureLine({
      id: "a",
      label: "Instructor",
      name: "Pat",
      centerXPercent: 10,
      centerYPercent: 20,
      fontSizePx: 11,
    })
    expect(s.role).toBe("Instructor")
    expect(s.name).toBe("Pat")
    expect(s.signatureDataUrl).toBeNull()
    expect(s.imageWidthPercent).toBe(18)
  })

  it("caps signature lines when normalizing", () => {
    const base = createDefaultDiplomaTemplate()
    const many = {
      ...base,
      signatures: [
        ...base.signatures,
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `extra-${i}`,
          role: "R",
          name: "N",
          centerXPercent: 50,
          centerYPercent: 86,
          fontSizePx: 12,
          signatureDataUrl: null,
          imageWidthPercent: 18,
        })),
      ],
    }
    const n = normalizeDiplomaTemplate(many)
    expect(n.signatures.length).toBe(MAX_SIGNATURE_LINES)
  })
})
