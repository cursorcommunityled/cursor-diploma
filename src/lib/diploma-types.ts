export const DIPLOMA_DRAFT_VERSION = 1 as const
export const CURSOR_TEMPLATE_BACKGROUND = "#14120B"
export const CURSOR_TEMPLATE_ACCENT = "#FF6600"
export const CURSOR_LOGO_ASSET_URL = "/cursor.svg"

export type EventDetails = {
  id: string
  title: string
  createdAtIso: string
  /** Optional freeform notes (future credits, etc.) */
  notes?: string
}

export type Attendee = {
  id: string
  displayName: string
  sourceRow: Record<string, string>
}

export type TextBoxLayout = {
  /** Horizontal center of the box as % of certificate width (0–100) */
  centerXPercent: number
  /** Vertical center of the box as % of certificate height (0–100) */
  centerYPercent: number
  widthPercent: number
  fontSizePx: number
  color: string
  textAlign: "left" | "center" | "right"
  fontWeight: number
}

/** At most three signature blocks on the certificate. */
export const MAX_SIGNATURE_LINES = 3

export type SignatureLine = {
  id: string
  /** Signer name (printed line) */
  name: string
  /** Role / title under the signature, e.g. "Instructor" */
  role: string
  /** text block center */
  centerXPercent: number
  centerYPercent: number
  fontSizePx: number
  /** Optional ink / stamp image; stored as a data URL like other assets */
  signatureDataUrl: string | null
  /** Width of the signature image as % of certificate width (when an image is set) */
  imageWidthPercent: number
}

export type LogoSlot = {
  id: string
  centerXPercent: number
  centerYPercent: number
  widthPercent: number
  dataUrl: string | null
}

export type DiplomaTemplate = {
  backgroundColor: string
  titleText: string
  subtitleText: string
  eventTitleBox: TextBoxLayout
  titleBox: TextBoxLayout
  subtitleBox: TextBoxLayout
  nameBox: TextBoxLayout
  signatures: Array<SignatureLine>
  logos: Array<LogoSlot>
}

/** Persisted so users can re-pick a name column after reload. */
export type CsvSnapshot = {
  text: string
  fields: Array<string>
  rows: Array<Record<string, string>>
}

export type DiplomaDraftV1 = {
  version: typeof DIPLOMA_DRAFT_VERSION
  event: EventDetails
  attendees: Array<Attendee>
  /** Selected CSV header key for the name column */
  nameColumnKey: string | null
  backgroundDataUrl: string | null
  template: DiplomaTemplate
  /** Raw CSV and parsed rows for re-inference and column changes */
  csv: CsvSnapshot | null
}

export function createId(): string {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

/** Map persisted rows that used `label` (pre–signature image) to `role`. */
export function migrateSignatureLine(
  raw: Record<string, unknown>
): SignatureLine {
  const roleFromLegacy =
    typeof raw.label === "string" ? raw.label : undefined
  const role =
    typeof raw.role === "string" ? raw.role : roleFromLegacy ?? ""
  return {
    id: typeof raw.id === "string" ? raw.id : createId(),
    name: typeof raw.name === "string" ? raw.name : "",
    role,
    centerXPercent:
      typeof raw.centerXPercent === "number" ? raw.centerXPercent : 50,
    centerYPercent:
      typeof raw.centerYPercent === "number" ? raw.centerYPercent : 86,
    fontSizePx: typeof raw.fontSizePx === "number" ? raw.fontSizePx : 12,
    signatureDataUrl:
      typeof raw.signatureDataUrl === "string"
        ? raw.signatureDataUrl
        : null,
    imageWidthPercent:
      typeof raw.imageWidthPercent === "number" ? raw.imageWidthPercent : 18,
  }
}

function migrateTextBoxLayout(
  raw: unknown,
  fallback: TextBoxLayout
): TextBoxLayout {
  if (!raw || typeof raw !== "object") {
    return fallback
  }
  const r = raw as Partial<TextBoxLayout>
  return {
    centerXPercent:
      typeof r.centerXPercent === "number"
        ? r.centerXPercent
        : fallback.centerXPercent,
    centerYPercent:
      typeof r.centerYPercent === "number"
        ? r.centerYPercent
        : fallback.centerYPercent,
    widthPercent:
      typeof r.widthPercent === "number" ? r.widthPercent : fallback.widthPercent,
    fontSizePx:
      typeof r.fontSizePx === "number" ? r.fontSizePx : fallback.fontSizePx,
    color: typeof r.color === "string" ? r.color : fallback.color,
    textAlign:
      r.textAlign === "left" || r.textAlign === "center" || r.textAlign === "right"
        ? r.textAlign
        : fallback.textAlign,
    fontWeight:
      typeof r.fontWeight === "number" ? r.fontWeight : fallback.fontWeight,
  }
}

export function normalizeDiplomaTemplate(
  t: Partial<DiplomaTemplate> & {
    signatures?: Array<Record<string, unknown>>
  }
): DiplomaTemplate {
  const base = createDefaultDiplomaTemplate()
  const rawSigs = Array.isArray(t.signatures) ? t.signatures : base.signatures
  const signatures = rawSigs
    .slice(0, MAX_SIGNATURE_LINES)
    .map((s) => migrateSignatureLine(s))
  return {
    backgroundColor: t.backgroundColor ?? base.backgroundColor,
    titleText: t.titleText ?? base.titleText,
    subtitleText: t.subtitleText ?? base.subtitleText,
    eventTitleBox: migrateTextBoxLayout(t.eventTitleBox, base.eventTitleBox),
    titleBox: migrateTextBoxLayout(t.titleBox, base.titleBox),
    subtitleBox: migrateTextBoxLayout(t.subtitleBox, base.subtitleBox),
    nameBox: migrateTextBoxLayout(t.nameBox, base.nameBox),
    signatures,
    logos: Array.isArray(t.logos) ? t.logos : base.logos,
  }
}

export function normalizeDiplomaDraft(d: DiplomaDraftV1): DiplomaDraftV1 {
  const isEmptyDraft =
    d.attendees.length === 0 && d.csv === null && d.backgroundDataUrl === null
  return {
    ...d,
    template: isEmptyDraft
      ? createDefaultDiplomaTemplate()
      : normalizeDiplomaTemplate(d.template),
  }
}

export function createDefaultEvent(): EventDetails {
  return {
    id: createId(),
    title: "Untitled event",
    createdAtIso: new Date().toISOString(),
  }
}

export function createDefaultDiplomaTemplate(): DiplomaTemplate {
  return {
    backgroundColor: CURSOR_TEMPLATE_BACKGROUND,
    titleText: "Certificate of completion",
    subtitleText: "Presented to",
    eventTitleBox: {
      centerXPercent: 50,
      centerYPercent: 25,
      widthPercent: 75,
      fontSizePx: 24,
      color: "#f7f3ea",
      textAlign: "center",
      fontWeight: 700,
    },
    titleBox: {
      centerXPercent: 50,
      centerYPercent: 36,
      widthPercent: 58,
      fontSizePx: 13,
      color: CURSOR_TEMPLATE_ACCENT,
      textAlign: "center",
      fontWeight: 600,
    },
    subtitleBox: {
      centerXPercent: 50,
      centerYPercent: 41.6666666667,
      widthPercent: 50,
      fontSizePx: 12,
      color: "#a8a29e",
      textAlign: "center",
      fontWeight: 400,
    },
    nameBox: {
      centerXPercent: 50,
      centerYPercent: 50,
      widthPercent: 66.6666666667,
      fontSizePx: 36,
      color: "#fff7ed",
      textAlign: "center",
      fontWeight: 700,
    },
    signatures: [
      {
        id: createId(),
        role: "Organizer",
        name: "",
        centerXPercent: 25,
        centerYPercent: 83.3333333333,
        fontSizePx: 12,
        signatureDataUrl: null,
        imageWidthPercent: 18,
      },
      {
        id: createId(),
        role: "Partner institution",
        name: "",
        centerXPercent: 75,
        centerYPercent: 83.3333333333,
        fontSizePx: 12,
        signatureDataUrl: null,
        imageWidthPercent: 18,
      },
    ],
    logos: [
      {
        id: createId(),
        centerXPercent: 50,
        centerYPercent: 12,
        widthPercent: 24,
        dataUrl: CURSOR_LOGO_ASSET_URL,
      },
      {
        id: createId(),
        centerXPercent: 85,
        centerYPercent: 12,
        widthPercent: 16,
        dataUrl: null,
      },
    ],
  }
}

export function createDefaultDraft(): DiplomaDraftV1 {
  return {
    version: DIPLOMA_DRAFT_VERSION,
    event: createDefaultEvent(),
    attendees: [],
    nameColumnKey: null,
    backgroundDataUrl: null,
    template: createDefaultDiplomaTemplate(),
    csv: null,
  }
}

/** Fresh diploma state for a known hub event (per-event drafts). */
export function createDraftForEvent(event: EventDetails): DiplomaDraftV1 {
  return {
    version: DIPLOMA_DRAFT_VERSION,
    event: {...event},
    attendees: [],
    nameColumnKey: null,
    backgroundDataUrl: null,
    template: createDefaultDiplomaTemplate(),
    csv: null,
  }
}
