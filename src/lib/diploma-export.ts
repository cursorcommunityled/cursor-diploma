import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"
import { zipSync } from "fflate"

export async function certificateElementToPng(
  el: HTMLElement
): Promise<Blob> {
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "transparent",
    filter: (node) =>
      node instanceof HTMLElement
        ? node.dataset.exportHidden !== "true"
        : true,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Image failed to load"))
    img.src = src
  })
}

/** Multi-page PDF: one page per PNG; page size from first page. */
export async function buildPdfFromPngBlobs(pngBlobs: Array<Blob>): Promise<Blob> {
  if (pngBlobs.length === 0) {
    throw new Error("No pages to add to PDF")
  }
  const firstUrl = await blobToDataUrl(pngBlobs[0] ?? new Blob())
  const firstImg = await loadImage(firstUrl)
  const w = firstImg.naturalWidth
  const h = firstImg.naturalHeight
  const orientation = w >= h ? "landscape" : "portrait"
  const pdf = new jsPDF({
    unit: "px",
    format: [w, h],
    orientation,
  })
  let pageIndex = 0
  for (const b of pngBlobs) {
    const dataUrl = await blobToDataUrl(b)
    if (pageIndex > 0) {
      pdf.addPage([w, h], orientation)
    }
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h)
    pageIndex += 1
  }
  return pdf.output("blob")
}

function safeFileBase(name: string): string {
  return name
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replaceAll(/\s+/g, "-")
    .slice(0, 120)
}

/** ZIP of PNGs keyed by `filename.png`. */
export async function buildZipOfPngs(
  files: Array<{ fileName: string; blob: Blob }>
): Promise<Blob> {
  const out: Record<string, Uint8Array> = {}
  for (const { fileName, blob } of files) {
    const buf = new Uint8Array(await blob.arrayBuffer())
    out[fileName] = buf
  }
  const packed = zipSync(out)
  return new Blob([new Uint8Array(packed)], { type: "application/zip" })
}

export function attendeePngName(attendeeName: string, index: number): string {
  const base =
    safeFileBase(attendeeName.trim()) || `attendee-${index + 1}`
  return `${base}.png`
}

/** Download helper for browsers. */
export function downloadBlob(
  filename: string,
  blob: Blob
): void {
  const a = document.createElement("a")
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
