import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"
import { zipSync } from "fflate"

import type {
  DiplomaTemplate,
  LogoSlot,
  SignatureLine,
  TextBoxLayout,
} from "@/lib/diploma-types"

const PDF_PAGE_WIDTH_PT = 841.89
const PDF_PAGE_HEIGHT_PT = 595.28
const PDF_IMAGE_DPI = 300
const PDF_PAGE_FORMAT = [PDF_PAGE_WIDTH_PT, PDF_PAGE_HEIGHT_PT] as const
const PDF_FONT_FAMILY = "CursorGothic"
const PDF_FONT_REGULAR_FILE = "CursorGothic-Regular.ttf"
const PDF_FONT_BOLD_FILE = "CursorGothic-Bold.ttf"
const PDF_FONT_REGULAR_URL = "/font/CursorGothic-Regular.ttf"
const PDF_FONT_BOLD_URL = "/font/CursorGothic-Bold.ttf"
const CERTIFICATE_EXPORT_PIXEL_RATIO = 3

type PdfFonts = {
  family: string
  hasBold: boolean
}

export type DiplomaPdfPage = {
  template: DiplomaTemplate
  backgroundDataUrl: string | null
  displayName: string
  eventTitle?: string | null
}

function getExportBackgroundColor(el: HTMLElement): string | undefined {
  const computed =
    typeof getComputedStyle === "function"
      ? getComputedStyle(el).backgroundColor
      : undefined
  const color = computed || el.style.backgroundColor
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return undefined
  }
  return color
}

export async function certificateElementToPng(
  el: HTMLElement
): Promise<Blob> {
  const backgroundColor = getExportBackgroundColor(el)
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: CERTIFICATE_EXPORT_PIXEL_RATIO,
    ...(backgroundColor ? { backgroundColor } : {}),
    filter: (node) =>
      node instanceof HTMLElement
        ? node.dataset.exportHidden !== "true"
        : true,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

const fontBase64Cache = new Map<string, string | null>()

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchBase64(url: string): Promise<string | null> {
  if (fontBase64Cache.has(url)) {
    return fontBase64Cache.get(url) ?? null
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Unable to load ${url}`)
    }
    const base64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()))
    fontBase64Cache.set(url, base64)
    return base64
  } catch {
    fontBase64Cache.set(url, null)
    return null
  }
}

async function registerPdfFonts(pdf: jsPDF): Promise<PdfFonts> {
  const [regular, bold] = await Promise.all([
    fetchBase64(PDF_FONT_REGULAR_URL),
    fetchBase64(PDF_FONT_BOLD_URL),
  ])
  if (!regular) {
    return { family: "helvetica", hasBold: true }
  }

  pdf.addFileToVFS(PDF_FONT_REGULAR_FILE, regular)
  pdf.addFont(PDF_FONT_REGULAR_FILE, PDF_FONT_FAMILY, "normal")

  if (bold) {
    pdf.addFileToVFS(PDF_FONT_BOLD_FILE, bold)
    pdf.addFont(PDF_FONT_BOLD_FILE, PDF_FONT_FAMILY, "bold")
  }

  return { family: PDF_FONT_FAMILY, hasBold: Boolean(bold) }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function imageSourceToDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) {
    return src
  }
  const res = await fetch(src)
  if (!res.ok) {
    throw new Error("Image failed to load")
  }
  return blobToDataUrl(await res.blob())
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

function pdfPixels(pt: number): number {
  return Math.max(1, Math.ceil((pt / 72) * PDF_IMAGE_DPI))
}

async function rasterizeImage(
  src: string,
  widthPt: number,
  heightPt: number,
  fit: "contain" | "cover"
): Promise<string> {
  const dataUrl = await imageSourceToDataUrl(src)
  const img = await loadImage(dataUrl)
  const widthPx = pdfPixels(widthPt)
  const heightPx = pdfPixels(heightPt)
  const canvas = document.createElement("canvas")
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext("2d")
  if (!ctx || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return dataUrl
  }

  const srcRatio = img.naturalWidth / img.naturalHeight
  const targetRatio = widthPx / heightPx
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight

  if (fit === "cover" && srcRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio
    sx = (img.naturalWidth - sw) / 2
  } else if (fit === "cover" && srcRatio < targetRatio) {
    sh = img.naturalWidth / targetRatio
    sy = (img.naturalHeight - sh) / 2
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, widthPx, heightPx)
  return canvas.toDataURL("image/png")
}

function parseCssColor(color: string): [number, number, number] {
  const trimmed = color.trim()
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1)
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => `${c}${c}`)
            .join("")
        : hex
    const value = Number.parseInt(normalized, 16)
    if (Number.isFinite(value)) {
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    }
  }

  const rgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
  )
  if (rgb) {
    return [
      Math.round(Number(rgb[1])),
      Math.round(Number(rgb[2])),
      Math.round(Number(rgb[3])),
    ]
  }

  return [0, 0, 0]
}

function setFillColor(pdf: jsPDF, color: string): void {
  pdf.setFillColor(...parseCssColor(color))
}

function setTextColor(pdf: jsPDF, color: string): void {
  pdf.setTextColor(...parseCssColor(color))
}

function setDrawColor(pdf: jsPDF, color: string): void {
  pdf.setDrawColor(...parseCssColor(color))
}

function scaledPdfFontSize(px: number): number {
  return px * 1.18
}

function setCertificateFont(
  pdf: jsPDF,
  fonts: PdfFonts,
  weight: number
): void {
  pdf.setFont(fonts.family, weight >= 600 && fonts.hasBold ? "bold" : "normal")
}

function boxCenterX(percent: number): number {
  return (percent / 100) * PDF_PAGE_WIDTH_PT
}

function boxCenterY(percent: number): number {
  return (percent / 100) * PDF_PAGE_HEIGHT_PT
}

function drawTextBlock(
  pdf: jsPDF,
  fonts: PdfFonts,
  box: TextBoxLayout,
  text: string,
  uppercase = false
): void {
  const content = uppercase ? text.toUpperCase() : text
  const fontSize = scaledPdfFontSize(box.fontSizePx)
  const width = (box.widthPercent / 100) * PDF_PAGE_WIDTH_PT
  const x =
    box.textAlign === "left"
      ? boxCenterX(box.centerXPercent) - width / 2
      : box.textAlign === "right"
        ? boxCenterX(box.centerXPercent) + width / 2
        : boxCenterX(box.centerXPercent)
  const centerY = boxCenterY(box.centerYPercent)
  setCertificateFont(pdf, fonts, box.fontWeight)
  pdf.setFontSize(fontSize)
  setTextColor(pdf, box.color)

  const split = pdf.splitTextToSize(content || " ", width)
  const lines = Array.isArray(split) ? split : [split]
  const lineHeight = fontSize * 1.15
  const totalHeight = lineHeight * (lines.length - 1) + fontSize
  const startY = centerY - totalHeight / 2 + fontSize * 0.74
  lines.forEach((line, i) => {
    pdf.text(line, x, startY + i * lineHeight, {
      align: box.textAlign,
      maxWidth: width,
    })
  })
}

async function drawPdfImage(
  pdf: jsPDF,
  src: string,
  centerX: number,
  centerY: number,
  widthPt: number
): Promise<void> {
  const dataUrl = await imageSourceToDataUrl(src)
  const img = await loadImage(dataUrl)
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return
  }
  const heightPt = widthPt / (img.naturalWidth / img.naturalHeight)
  const png = await rasterizeImage(src, widthPt, heightPt, "contain")
  pdf.addImage(
    png,
    "PNG",
    centerX - widthPt / 2,
    centerY - heightPt / 2,
    widthPt,
    heightPt
  )
}

async function drawLogo(pdf: jsPDF, logo: LogoSlot): Promise<void> {
  if (!logo.dataUrl) {
    return
  }
  await drawPdfImage(
    pdf,
    logo.dataUrl,
    boxCenterX(logo.centerXPercent),
    boxCenterY(logo.centerYPercent),
    (logo.widthPercent / 100) * PDF_PAGE_WIDTH_PT
  )
}

async function drawSignature(
  pdf: jsPDF,
  fonts: PdfFonts,
  signature: SignatureLine
): Promise<void> {
  const centerX = boxCenterX(signature.centerXPercent)
  const centerY = boxCenterY(signature.centerYPercent)
  const fontSize = scaledPdfFontSize(signature.fontSizePx)
  const blockW =
    (Math.max(22, signature.imageWidthPercent) / 100) * PDF_PAGE_WIDTH_PT
  let roleY = centerY - fontSize * 0.6

  if (signature.signatureDataUrl) {
    const imageW = (signature.imageWidthPercent / 100) * PDF_PAGE_WIDTH_PT
    const dataUrl = await imageSourceToDataUrl(signature.signatureDataUrl)
    const img = await loadImage(dataUrl)
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const imageH = imageW / (img.naturalWidth / img.naturalHeight)
      const imageY = centerY - imageH - fontSize * 1.1
      const png = await rasterizeImage(
        signature.signatureDataUrl,
        imageW,
        imageH,
        "contain"
      )
      pdf.addImage(png, "PNG", centerX - imageW / 2, imageY, imageW, imageH)
      roleY = imageY + imageH + fontSize * 0.8
    }
  }

  setCertificateFont(pdf, fonts, 400)
  pdf.setFontSize(fontSize * 0.7)
  setTextColor(pdf, "#8a8780")
  pdf.text(signature.role.toUpperCase(), centerX, roleY, {
    align: "center",
    maxWidth: blockW,
  })

  const lineY = roleY + fontSize * 0.75
  setDrawColor(pdf, "#59554e")
  pdf.setLineWidth(1)
  pdf.line(centerX - blockW / 2, lineY, centerX + blockW / 2, lineY)

  pdf.setFontSize(fontSize)
  setTextColor(pdf, "#fff7ed")
  pdf.text(signature.name || "-", centerX, lineY + fontSize * 1.05, {
    align: "center",
    maxWidth: blockW,
  })
}

async function drawDiplomaPdfPage(
  pdf: jsPDF,
  fonts: PdfFonts,
  page: DiplomaPdfPage
): Promise<void> {
  setFillColor(pdf, page.template.backgroundColor)
  pdf.rect(0, 0, PDF_PAGE_WIDTH_PT, PDF_PAGE_HEIGHT_PT, "F")

  if (page.backgroundDataUrl) {
    const background = await rasterizeImage(
      page.backgroundDataUrl,
      PDF_PAGE_WIDTH_PT,
      PDF_PAGE_HEIGHT_PT,
      "cover"
    )
    pdf.addImage(
      background,
      "PNG",
      0,
      0,
      PDF_PAGE_WIDTH_PT,
      PDF_PAGE_HEIGHT_PT
    )
  }

  for (const logo of page.template.logos) {
    await drawLogo(pdf, logo)
  }

  const eventTitle = page.eventTitle?.trim()
  if (eventTitle) {
    drawTextBlock(pdf, fonts, page.template.eventTitleBox, eventTitle, true)
  }
  drawTextBlock(pdf, fonts, page.template.titleBox, page.template.titleText, true)
  drawTextBlock(pdf, fonts, page.template.subtitleBox, page.template.subtitleText)
  drawTextBlock(pdf, fonts, page.template.nameBox, page.displayName)

  for (const signature of page.template.signatures) {
    await drawSignature(pdf, fonts, signature)
  }
}

export async function buildPdfFromDiplomas(
  pages: Array<DiplomaPdfPage>
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error("No pages to add to PDF")
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: [...PDF_PAGE_FORMAT],
    orientation: "landscape",
    compress: true,
  })
  const fonts = await registerPdfFonts(pdf)

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage([...PDF_PAGE_FORMAT], "landscape")
    }
    await drawDiplomaPdfPage(pdf, fonts, pages[i])
  }

  return pdf.output("blob")
}

function fullBleedImageRect(
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: PDF_PAGE_WIDTH_PT,
      height: PDF_PAGE_HEIGHT_PT,
    }
  }

  const pageRatio = PDF_PAGE_WIDTH_PT / PDF_PAGE_HEIGHT_PT
  const imageRatio = imageWidth / imageHeight
  const width =
    imageRatio > pageRatio
      ? PDF_PAGE_HEIGHT_PT * imageRatio
      : PDF_PAGE_WIDTH_PT
  const height =
    imageRatio > pageRatio
      ? PDF_PAGE_HEIGHT_PT
      : PDF_PAGE_WIDTH_PT / imageRatio

  return {
    x: (PDF_PAGE_WIDTH_PT - width) / 2,
    y: (PDF_PAGE_HEIGHT_PT - height) / 2,
    width,
    height,
  }
}

/** Multi-page PDF: one fixed A4 landscape page per captured preview PNG. */
export async function buildPdfFromPngBlobs(pngBlobs: Array<Blob>): Promise<Blob> {
  if (pngBlobs.length === 0) {
    throw new Error("No pages to add to PDF")
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: [...PDF_PAGE_FORMAT],
    orientation: "landscape",
    compress: true,
  })

  let pageIndex = 0
  for (const b of pngBlobs) {
    const dataUrl = await blobToDataUrl(b)
    const img = await loadImage(dataUrl)
    const placement = fullBleedImageRect(img.naturalWidth, img.naturalHeight)
    if (pageIndex > 0) {
      pdf.addPage([...PDF_PAGE_FORMAT], "landscape")
    }
    pdf.addImage(
      dataUrl,
      "PNG",
      placement.x,
      placement.y,
      placement.width,
      placement.height
    )
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
  a.style.display = "none"
  document.body.append(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}
