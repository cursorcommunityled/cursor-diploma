/** Allowed image types for certificate signature graphics (per slot). */
export const ALLOWED_SIGNATURE_IMAGE_MIMES = [
  "image/png",
  "image/svg+xml",
] as const

const EXT_PNG_SVG = /\.(png|svg)$/i

/**
 * Returns `null` if the file is an acceptable PNG or SVG. Otherwise returns a
 * short user-facing error message. Uses MIME when present, and file extension
 * when the browser omits or misreports the type.
 */
export function getSignatureImageRejectionMessage(file: File): string | null {
  if (file.size === 0) {
    return "Choose a non-empty file."
  }
  const type = (file.type || "").toLowerCase().trim()
  const extOk = EXT_PNG_SVG.test(file.name)
  const mimeOk =
    type === "image/png" || type === "image/svg+xml"
  if (mimeOk) {
    return null
  }
  if (type) {
    return "Signature image must be PNG or SVG. Other image types are not allowed."
  }
  if (extOk) {
    return null
  }
  return "Signature image must be a .png or .svg file."
}
