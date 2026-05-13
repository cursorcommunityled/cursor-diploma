import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { flushSync } from "react-dom"
import { Link } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  RotateCcw,
} from "lucide-react"

import { AttendeeReview } from "./attendee-review"
import { BackgroundUpload } from "./background-upload"
import { CsvUpload } from "./csv-upload"
import { DiplomaPreview } from "./diploma-preview"
import { EventDetailsForm } from "./event-details-form"
import { ExportPanel } from "./export-panel"
import { TemplateControls } from "./template-controls"
import type { DiplomaPreviewHandle } from "./diploma-preview"
import type {
  DiplomaDraftV1,
  DiplomaTemplate,
  EventDetails,
} from "@/lib/diploma-types"
import type { ParsedCsv } from "@/lib/csv-attendees"
import {
  clearDiplomaDraft,
  loadDiplomaDraft,
  saveDiplomaDraft,
} from "@/lib/diploma-storage"
import { inferNameColumnKey, rowsToAttendees } from "@/lib/csv-attendees"
import { createDraftForEvent } from "@/lib/diploma-types"
import {
  attendeePngName,
  buildPdfFromPngBlobs,
  buildZipOfPngs,
  certificateElementToPng,
  downloadBlob,
} from "@/lib/diploma-export"
import { eventDetailsFromRecord, getEventById } from "@/lib/events-storage"
import { Button } from "@/components/ui/button"

function safeFileStem(s: string): string {
  return (
    s
      .replaceAll(/[<>:"/\\|?*]/g, "-")
      .replaceAll(/\s+/g, "-")
      .slice(0, 80) || "diplomas"
  )
}

function raf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function waitForCertificateFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return
  }
  try {
    await document.fonts.ready
  } catch {
    // Font loading should not block exports if the browser rejects the promise.
  }
}

function seedEventForDiploma(eventId: string): EventDetails {
  if (typeof globalThis.localStorage === "undefined") {
    return {
      id: eventId,
      title: "Event",
      createdAtIso: new Date().toISOString(),
    }
  }
  const r = getEventById(eventId)
  if (r) {
    return eventDetailsFromRecord(r)
  }
  return {
    id: eventId,
    title: "Event",
    createdAtIso: new Date().toISOString(),
  }
}

function ControlSection({
  controlId,
  active,
  title,
  description,
  children,
}: {
  controlId?: string
  active?: boolean
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      data-control-id={controlId}
      data-active-control={active ? "true" : undefined}
      className="border-border/70 border-t px-4 py-5 transition-colors duration-500 data-[active-control=true]:bg-brand/8"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export type DiplomaWorkspaceProps = {
  eventId: string
}

export function DiplomaWorkspace({ eventId }: DiplomaWorkspaceProps) {
  const [draft, setDraft] = useState<DiplomaDraftV1 | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [storageHint, setStorageHint] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [activeControlId, setActiveControlId] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const previewRef = useRef<DiplomaPreviewHandle>(null)
  const previewIdxBeforeExport = useRef(0)

  useEffect(() => {
    setDraft(loadDiplomaDraft(eventId, seedEventForDiploma(eventId)))
  }, [eventId])

  const previewDisplayName =
    draft?.attendees[previewIdx]?.displayName ?? "Marisol Ventura"

  useEffect(() => {
    if (!draft) {
      return
    }
    const t = window.setTimeout(() => {
      const { ok, backgroundSkipped } = saveDiplomaDraft(eventId, draft)
      if (!ok) {
        setStorageHint(
          "Could not save draft to local storage (quota or privacy mode)."
        )
      } else if (backgroundSkipped) {
        setStorageHint(
          "Background image was not saved to local storage. Re-upload after refresh if needed."
        )
      } else {
        setStorageHint(null)
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [draft, eventId])

  useEffect(() => {
    if (!draft) {
      return
    }
    if (draft.attendees.length === 0) {
      setPreviewIdx(0)
      return
    }
    setPreviewIdx((i) => Math.min(i, draft.attendees.length - 1))
  }, [draft?.attendees.length])

  const updateTemplate = useCallback((template: DiplomaTemplate) => {
    setDraft((d) => (d ? { ...d, template } : d))
  }, [])

  const updateEvent = useCallback(
    (event: EventDetails) => {
      setDraft((d) => (d ? { ...d, event: { ...event, id: eventId } } : d))
    },
    [eventId]
  )

  const updateBackground = useCallback((dataUrl: string | null) => {
    setDraft((d) => (d ? { ...d, backgroundDataUrl: dataUrl } : d))
  }, [])

  const focusSidebarControl = useCallback((controlId: string) => {
    setActiveControlId(controlId)
    window.setTimeout(() => {
      setActiveControlId((current) => (current === controlId ? null : current))
    }, 1300)
    window.requestAnimationFrame(() => {
      const container = sidebarRef.current
      const target = container?.querySelector<HTMLElement>(
        `[data-control-id="${CSS.escape(controlId)}"]`
      )
      target?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      })
    })
  }, [])

  const onCsvParsed = useCallback((parsed: ParsedCsv, rawText: string) => {
    const key: string | null =
      inferNameColumnKey(parsed.fields) ?? parsed.fields.at(0) ?? null
    const { attendees, issues } = rowsToAttendees(parsed.rows, key)
    setParseError(issues[0] ?? null)
    setDraft((d) =>
      d
        ? {
            ...d,
            csv: {
              text: rawText,
              fields: parsed.fields,
              rows: parsed.rows,
            },
            nameColumnKey: key,
            attendees,
          }
        : d
    )
    setPreviewIdx(0)
  }, [])

  const onNameColumnKey = useCallback((key: string) => {
    setDraft((d) => {
      if (!d) {
        return d
      }
      if (!d.csv) {
        return { ...d, nameColumnKey: key }
      }
      const { attendees, issues } = rowsToAttendees(d.csv.rows, key)
      setParseError(issues[0] ?? null)
      return { ...d, nameColumnKey: key, attendees }
    })
  }, [])

  const onAttendeeNameChange = useCallback((id: string, name: string) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            attendees: d.attendees.map((a) =>
              a.id === id ? { ...a, displayName: name } : a
            ),
          }
        : d
    )
  }, [])

  const runExport = useCallback(
    async (mode: "pdf" | "zip") => {
      if (!draft) {
        return
      }
      setExportError(null)
      const el = previewRef.current?.getCertificateElement()
      if (!el) {
        setExportError("Certificate preview is not ready.")
        return
      }
      if (draft.attendees.length === 0) {
        setExportError("Add at least one attendee from your CSV.")
        return
      }
      previewIdxBeforeExport.current = previewIdx
      setExportBusy(true)
      try {
        await waitForCertificateFonts()
        const blobs: Array<Blob> = []
        for (let i = 0; i < draft.attendees.length; i++) {
          flushSync(() => setPreviewIdx(i))
          await raf()
          await raf()
          blobs.push(await certificateElementToPng(el))
        }
        const stem = safeFileStem(draft.event.title)
        if (mode === "pdf") {
          const pdf = await buildPdfFromPngBlobs(blobs)
          downloadBlob(`${stem}.pdf`, pdf)
        } else {
          const files = draft.attendees.map((a, i) => ({
            fileName: attendeePngName(a.displayName, i),
            blob: blobs[i],
          }))
          const z = await buildZipOfPngs(files)
          downloadBlob(`${stem}.zip`, z)
        }
      } catch (e) {
        setExportError(
          e instanceof Error ? e.message : "Export failed. Try again."
        )
      } finally {
        flushSync(() => setPreviewIdx(previewIdxBeforeExport.current))
        setExportBusy(false)
      }
    },
    [draft, previewIdx]
  )

  const resetDraft = useCallback(() => {
    if (
      !window.confirm(
        "Reset this event's diploma draft to the current default? CSV, background, and layout for this event are removed in this browser."
      )
    ) {
      return
    }
    const fresh = createDraftForEvent(seedEventForDiploma(eventId))
    setDraft(fresh)
    clearDiplomaDraft(eventId)
    setPreviewIdx(0)
    setParseError(null)
    setStorageHint(null)
  }, [eventId])

  if (!draft) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Loading diploma workspace...
        </p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden bg-background text-foreground">
      <div className="flex h-full overflow-hidden">
        <aside
          ref={sidebarRef}
          aria-label="Diploma customization controls"
          className="border-border/70 bg-background h-full w-[23rem] shrink-0 overflow-y-auto border-r"
        >
          <div className="border-border/70 sticky top-0 z-20 border-b bg-background/95 px-4 py-4 backdrop-blur">
            <nav
              className="mb-3 flex items-center gap-1 text-xs text-muted-foreground"
              aria-label="Breadcrumb"
            >
              <Link to="/events" className="font-medium hover:text-foreground">
                Events
              </Link>
              <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
              <Link
                to="/events/$eventId"
                params={{ eventId }}
                className="max-w-[11rem] truncate font-medium hover:text-foreground"
              >
                {draft.event.title}
              </Link>
            </nav>
            <div className="space-y-3">
              <div>
                <h1 className="text-xl font-semibold leading-tight">
                  Diploma editor
                </h1>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Desktop certificate layout with draggable grid snapping.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="border-border/60 bg-muted/20 border p-2">
                  <p className="text-muted-foreground">Attendees</p>
                  <p className="mt-1 font-medium text-foreground">
                    {draft.attendees.length}
                  </p>
                </div>
                <div className="border-border/60 bg-muted/20 border p-2">
                  <p className="text-muted-foreground">Preview</p>
                  <p className="mt-1 font-medium text-foreground">
                    {draft.attendees.length > 0 ? previewIdx + 1 : 1}
                  </p>
                </div>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={resetDraft}
                >
                  <RotateCcw className="size-3.5" />
                  Reset
                </Button>
              </div>
              {storageHint ? (
                <p className="border-brand/30 bg-brand/5 px-2 py-1.5 text-xs text-brand">
                  {storageHint}
                </p>
              ) : null}
            </div>
          </div>

          <ControlSection
            controlId="event-details"
            title="Event details"
            description="The event title appears as a draggable text block."
          >
            <EventDetailsForm event={draft.event} onChange={updateEvent} />
          </ControlSection>

          <ControlSection
            controlId="attendees"
            title="Attendees"
            description="Upload the CSV and verify the display names."
          >
            <div className="space-y-4">
              <CsvUpload
                onParsed={onCsvParsed}
                parseError={parseError}
                onError={setParseError}
              />
              <AttendeeReview
                fields={draft.csv?.fields ?? []}
                nameColumnKey={draft.nameColumnKey}
                onNameColumnKey={onNameColumnKey}
                attendees={draft.attendees}
                onAttendeeNameChange={onAttendeeNameChange}
              />
            </div>
          </ControlSection>

          <ControlSection
            controlId="background"
            title="Background image"
            description="Optional image layer above the background color."
          >
            <BackgroundUpload
              dataUrl={draft.backgroundDataUrl}
              onDataUrl={updateBackground}
            />
          </ControlSection>

          <TemplateControls
            template={draft.template}
            onChange={updateTemplate}
            activeControlId={activeControlId}
          />

          <ControlSection
            controlId="export"
            title="Export"
            description="Editor grid and handles are excluded from output."
          >
            <ExportPanel
              busy={exportBusy}
              canExport={draft.attendees.length > 0}
              onExportPdf={() => void runExport("pdf")}
              onExportZip={() => void runExport("zip")}
              error={exportError}
            />
          </ControlSection>
        </aside>

        <main className="flex min-w-0 flex-1 overflow-hidden bg-[#0d0d0d]">
          <div className="flex h-full min-w-0 flex-1 flex-col">
            <div className="border-border/70 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/35 px-6">
              <div>
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-4 text-brand" aria-hidden />
                  <h2 className="text-sm font-semibold">Certificate preview</h2>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  12x12 snap grid. Drag any foreground item.
                </p>
              </div>
              {draft.attendees.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous attendee"
                    disabled={previewIdx <= 0}
                    onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-muted-foreground min-w-16 text-center text-xs">
                    {previewIdx + 1} / {draft.attendees.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next attendee"
                    disabled={previewIdx >= draft.attendees.length - 1}
                    onClick={() =>
                      setPreviewIdx((i) =>
                        Math.min(draft.attendees.length - 1, i + 1)
                      )
                    }
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-6">
              <div className="flex h-full items-center justify-center">
                <div
                  className="max-w-full"
                  style={{
                    width:
                      "min(60vw, calc((100dvh - 3.5rem - 4rem - 3rem) * 1.4142857143), calc(100vw - 23rem - 3rem))",
                  }}
                >
                  <DiplomaPreview
                    ref={previewRef}
                    className="w-full"
                    template={draft.template}
                    backgroundDataUrl={draft.backgroundDataUrl}
                    displayName={previewDisplayName}
                    onTemplateChange={updateTemplate}
                    onItemFocus={focusSidebarControl}
                    layoutEditing
                    eventTitle={draft.event.title}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
