import { describe, expect, it } from "vitest"

import { getSignatureImageRejectionMessage } from "./signature-asset"

function file(
  name: string,
  type: string,
  body = new ArrayBuffer(8)
): File {
  return new File([body], name, { type })
}

describe("signature-asset", () => {
  it("accepts PNG and SVG by MIME", () => {
    expect(
      getSignatureImageRejectionMessage(
        file("a.png", "image/png", new ArrayBuffer(1))
      )
    ).toBeNull()
    expect(
      getSignatureImageRejectionMessage(
        file("a.svg", "image/svg+xml", new ArrayBuffer(1))
      )
    ).toBeNull()
  })

  it("rejects a non-empty wrong MIME and allows extension if MIME is empty", () => {
    const jpeg = getSignatureImageRejectionMessage(
      file("x.png", "image/jpeg", new ArrayBuffer(1))
    )
    expect(jpeg).not.toBeNull()

    const emptyMimePng = getSignatureImageRejectionMessage(
      file("x.png", "", new ArrayBuffer(1))
    )
    expect(emptyMimePng).toBeNull()

    const noExt = getSignatureImageRejectionMessage(
      file("x", "", new ArrayBuffer(1))
    )
    expect(noExt).not.toBeNull()
  })

  it("rejects empty file", () => {
    expect(
      getSignatureImageRejectionMessage(
        file("a.png", "image/png", new ArrayBuffer(0))
      )
    ).not.toBeNull()
  })
})
