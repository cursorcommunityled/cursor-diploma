import { useEffect, useRef, useState } from "react"
import type { PointerEvent, ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"

import type {
  DiplomaTemplate,
  LogoSlot,
  SignatureLine,
  TextBoxLayout,
} from "@/lib/diploma-types"
import { MAX_SIGNATURE_LINES, createId } from "@/lib/diploma-types"
import { getSignatureImageRejectionMessage } from "@/lib/signature-asset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TemplateControlsProps = {
  template: DiplomaTemplate
  onChange: (t: DiplomaTemplate) => void
  activeControlId?: string | null
}

const CENTER_PERCENT = 50
const SINGLE_LOGO_WIDTH_PERCENT = 22

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeSingleLogoLayout(logos: Array<LogoSlot>): Array<LogoSlot> {
  const selectedLogos = logos.filter((logo) => Boolean(logo.dataUrl))
  if (selectedLogos.length !== 1) {
    return logos
  }
  const selectedId = selectedLogos[0]?.id
  return logos.map((logo) =>
    logo.id === selectedId
      ? {
          ...logo,
          centerXPercent: CENTER_PERCENT,
          centerYPercent: CENTER_PERCENT,
          widthPercent: Math.max(logo.widthPercent, SINGLE_LOGO_WIDTH_PERCENT),
        }
      : logo
  )
}

function SidebarSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-border/70 border-t px-4 py-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function PositionButtons({
  onCenterX,
  onCenterY,
  onCenterBoth,
}: {
  onCenterX: () => void
  onCenterY: () => void
  onCenterBoth: () => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Button type="button" variant="outline" size="xs" onClick={onCenterX}>
        Center X
      </Button>
      <Button type="button" variant="outline" size="xs" onClick={onCenterY}>
        Center Y
      </Button>
      <Button type="button" variant="outline" size="xs" onClick={onCenterBoth}>
        Both
      </Button>
    </div>
  )
}

function TextBoxControls({
  controlId,
  active,
  title,
  box,
  onChange,
}: {
  controlId: string
  active: boolean
  title: string
  box: TextBoxLayout
  onChange: (box: TextBoxLayout) => void
}) {
  return (
    <div
      data-control-id={controlId}
      data-active-control={active ? "true" : undefined}
      className="border-border/50 bg-background/40 space-y-3 border p-3 transition-[background-color,border-color,box-shadow] duration-500 data-[active-control=true]:border-brand/70 data-[active-control=true]:bg-brand/10 data-[active-control=true]:shadow-[inset_3px_0_0_var(--brand)]"
    >
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-size`}>Font size</Label>
          <Input
            id={`${title}-size`}
            type="number"
            min={8}
            max={96}
            value={box.fontSizePx}
            onChange={(e) =>
              onChange({
                ...box,
                fontSizePx: clamp(Number(e.target.value) || box.fontSizePx, 8, 96),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-width`}>Width %</Label>
          <Input
            id={`${title}-width`}
            type="number"
            min={10}
            max={95}
            value={box.widthPercent}
            onChange={(e) =>
              onChange({
                ...box,
                widthPercent: clamp(Number(e.target.value) || box.widthPercent, 10, 95),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-weight`}>Weight</Label>
          <Input
            id={`${title}-weight`}
            type="number"
            min={300}
            max={900}
            step={100}
            value={box.fontWeight}
            onChange={(e) =>
              onChange({
                ...box,
                fontWeight: clamp(Number(e.target.value) || box.fontWeight, 300, 900),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-color`}>Color</Label>
          <Input
            id={`${title}-color`}
            type="color"
            className="h-9 p-1"
            value={box.color}
            onChange={(e) => onChange({ ...box, color: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${title}-align`}>Alignment</Label>
        <select
          id={`${title}-align`}
          className="border-input bg-background/60 text-foreground h-9 w-full border px-2 text-sm"
          value={box.textAlign}
          onChange={(e) =>
            onChange({
              ...box,
              textAlign: e.target.value as TextBoxLayout["textAlign"],
            })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <PositionButtons
        onCenterX={() => onChange({ ...box, centerXPercent: CENTER_PERCENT })}
        onCenterY={() => onChange({ ...box, centerYPercent: CENTER_PERCENT })}
        onCenterBoth={() =>
          onChange({
            ...box,
            centerXPercent: CENTER_PERCENT,
            centerYPercent: CENTER_PERCENT,
          })
        }
      />
    </div>
  )
}

function newSignatureLine(): SignatureLine {
  return {
    id: createId(),
    role: "",
    name: "",
    centerXPercent: 50,
    centerYPercent: 83.3333333333,
    fontSizePx: 12,
    signatureDataUrl: null,
    imageWidthPercent: 18,
  }
}

function SignatureDrawPad({
  signatureId,
  onUseDrawing,
}: {
  signatureId: string
  onUseDrawing: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) {
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 5
    ctx.strokeStyle = "#f7f3ea"
    setHasInk(false)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const pointForEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const clearPad = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) {
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  const finishStroke = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return
    }
    drawingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Draw signature
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-8 py-8 backdrop-blur-md"
          role="presentation"
          onPointerDown={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`sig-draw-title-${signatureId}`}
            className="border-border/70 bg-background w-[min(62rem,calc(100vw-4rem))] border shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="border-border/70 flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h3
                  id={`sig-draw-title-${signatureId}`}
                  className="text-sm font-semibold text-foreground"
                >
                  Draw signature
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Use the large pad below, then apply the drawing to this signer.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-4 p-5">
              <canvas
                ref={canvasRef}
                id={`sig-draw-${signatureId}`}
                width={1200}
                height={420}
                className="border-border/70 bg-muted/20 h-[22rem] w-full touch-none border"
                onPointerDown={(event) => {
                  const canvas = canvasRef.current
                  const ctx = canvas?.getContext("2d")
                  if (!canvas || !ctx) {
                    return
                  }
                  event.preventDefault()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  const point = pointForEvent(event)
                  drawingRef.current = true
                  ctx.beginPath()
                  ctx.moveTo(point.x, point.y)
                  setHasInk(true)
                }}
                onPointerMove={(event) => {
                  if (!drawingRef.current) {
                    return
                  }
                  const ctx = canvasRef.current?.getContext("2d")
                  if (!ctx) {
                    return
                  }
                  const point = pointForEvent(event)
                  ctx.lineTo(point.x, point.y)
                  ctx.stroke()
                }}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs">
                  The existing uploaded signature is unchanged until you apply this drawing.
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={!hasInk}
                    onClick={clearPad}
                  >
                    Clear pad
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!hasInk}
                    onClick={() => {
                      const canvas = canvasRef.current
                      if (canvas) {
                        onUseDrawing(canvas.toDataURL("image/png"))
                        setOpen(false)
                      }
                    }}
                  >
                    Use drawing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TemplateControls({
  template,
  onChange,
  activeControlId,
}: TemplateControlsProps) {
  const [uploadErrById, setUploadErrById] = useState<
    Record<string, string | null>
  >({})

  const setTextBox = (
    key: "eventTitleBox" | "titleBox" | "subtitleBox" | "nameBox",
    box: TextBoxLayout
  ) => {
    onChange({ ...template, [key]: box })
  }

  const setLogo = (id: string, dataUrl: string | null) => {
    const logos = normalizeSingleLogoLayout(
      template.logos.map((logo) => (logo.id === id ? { ...logo, dataUrl } : logo))
    )
    onChange({ ...template, logos })
  }

  const setLogoLayout = (id: string, partial: Partial<LogoSlot>) => {
    onChange({
      ...template,
      logos: template.logos.map((logo) =>
        logo.id === id ? { ...logo, ...partial } : logo
      ),
    })
  }

  const addLogo = () => {
    onChange({
      ...template,
      logos: [
        ...template.logos,
        {
          id: createId(),
          centerXPercent: 50,
          centerYPercent: 25,
          widthPercent: 12,
          dataUrl: null,
        },
      ],
    })
  }

  const removeLogo = (id: string) => {
    onChange({
      ...template,
      logos: template.logos.filter((logo) => logo.id !== id),
    })
  }

  const setSig = (id: string, partial: Partial<SignatureLine>) => {
    onChange({
      ...template,
      signatures: template.signatures.map((s) =>
        s.id === id ? { ...s, ...partial } : s
      ),
    })
  }

  const addSignature = () => {
    if (template.signatures.length >= MAX_SIGNATURE_LINES) {
      return
    }
    onChange({
      ...template,
      signatures: [...template.signatures, newSignatureLine()],
    })
  }

  const removeSignature = (id: string) => {
    onChange({
      ...template,
      signatures: template.signatures.filter((s) => s.id !== id),
    })
  }

  return (
    <div>
      <SidebarSection title="Canvas" description="Set the certificate surface before adding image assets.">
        <div className="space-y-1.5">
          <Label htmlFor="certificate-background-color">Background color</Label>
          <Input
            id="certificate-background-color"
            type="color"
            className="h-9 p-1"
            value={template.backgroundColor}
            onChange={(e) =>
              onChange({ ...template, backgroundColor: e.target.value })
            }
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Wording" description="These text values render directly on the certificate.">
        <div className="space-y-1.5">
          <Label htmlFor="cert-title">Certificate title</Label>
          <Input
            id="cert-title"
            value={template.titleText}
            onChange={(e) =>
              onChange({ ...template, titleText: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-subtitle">Subtitle</Label>
          <Input
            id="cert-subtitle"
            value={template.subtitleText}
            onChange={(e) =>
              onChange({ ...template, subtitleText: e.target.value })
            }
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Text layout" description="Drag text on the preview or adjust exact style here.">
        <TextBoxControls
          controlId="text-event-title"
          active={activeControlId === "text-event-title"}
          title="Event title"
          box={template.eventTitleBox}
          onChange={(box) => setTextBox("eventTitleBox", box)}
        />
        <TextBoxControls
          controlId="text-certificate-title"
          active={activeControlId === "text-certificate-title"}
          title="Certificate title"
          box={template.titleBox}
          onChange={(box) => setTextBox("titleBox", box)}
        />
        <TextBoxControls
          controlId="text-subtitle"
          active={activeControlId === "text-subtitle"}
          title="Subtitle"
          box={template.subtitleBox}
          onChange={(box) => setTextBox("subtitleBox", box)}
        />
        <TextBoxControls
          controlId="text-attendee-name"
          active={activeControlId === "text-attendee-name"}
          title="Attendee name"
          box={template.nameBox}
          onChange={(box) => setTextBox("nameBox", box)}
        />
      </SidebarSection>

      <SidebarSection
        title="Signatures"
        description={`Up to ${MAX_SIGNATURE_LINES} signers. Drag each block on the preview to position.`}
      >
        {template.signatures.map((s, index) => (
          <div
            key={s.id}
            data-control-id={`signature-${s.id}`}
            data-active-control={
              activeControlId === `signature-${s.id}` ? "true" : undefined
            }
            className="border-border/50 bg-background/40 space-y-3 border p-3 transition-[background-color,border-color,box-shadow] duration-500 data-[active-control=true]:border-brand/70 data-[active-control=true]:bg-brand/10 data-[active-control=true]:shadow-[inset_3px_0_0_var(--brand)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                Signer {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove signer ${index + 1}`}
                onClick={() => {
                  removeSignature(s.id)
                  setUploadErrById((m) => {
                    const n = { ...m }
                    delete n[s.id]
                    return n
                  })
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sig-name-${s.id}`}>Signer name</Label>
              <Input
                id={`sig-name-${s.id}`}
                value={s.name}
                onChange={(e) => setSig(s.id, { name: e.target.value })}
                placeholder="Name shown under the line"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sig-role-${s.id}`}>Role</Label>
              <Input
                id={`sig-role-${s.id}`}
                value={s.role}
                onChange={(e) => setSig(s.id, { role: e.target.value })}
                placeholder="Organizer, mentor, institution"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor={`sig-size-${s.id}`}>Font size</Label>
                <Input
                  id={`sig-size-${s.id}`}
                  type="number"
                  min={8}
                  max={28}
                  value={s.fontSizePx}
                  onChange={(e) =>
                    setSig(s.id, {
                      fontSizePx: clamp(Number(e.target.value) || s.fontSizePx, 8, 28),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sig-iw-${s.id}`}>Image width %</Label>
                <Input
                  id={`sig-iw-${s.id}`}
                  type="number"
                  min={6}
                  max={45}
                  value={s.imageWidthPercent}
                  onChange={(e) =>
                    setSig(s.id, {
                      imageWidthPercent: clamp(
                        Number(e.target.value) || s.imageWidthPercent,
                        6,
                        45
                      ),
                    })
                  }
                />
              </div>
            </div>
            <PositionButtons
              onCenterX={() => setSig(s.id, { centerXPercent: CENTER_PERCENT })}
              onCenterY={() => setSig(s.id, { centerYPercent: CENTER_PERCENT })}
              onCenterBoth={() =>
                setSig(s.id, {
                  centerXPercent: CENTER_PERCENT,
                  centerYPercent: CENTER_PERCENT,
                })
              }
            />
            <div className="space-y-1.5">
              <Label htmlFor={`sig-img-${s.id}`}>Signature image</Label>
              <Input
                id={`sig-img-${s.id}`}
                type="file"
                accept="image/png,image/svg+xml,.png,.svg"
                className="text-xs text-muted-foreground file:mr-2"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (!f) {
                    return
                  }
                  const err = getSignatureImageRejectionMessage(f)
                  if (err) {
                    setUploadErrById((m) => ({ ...m, [s.id]: err }))
                    return
                  }
                  setUploadErrById((m) => ({ ...m, [s.id]: null }))
                  const r = new FileReader()
                  r.onload = () =>
                    setSig(s.id, { signatureDataUrl: String(r.result) })
                  r.readAsDataURL(f)
                }}
              />
              {uploadErrById[s.id] ? (
                <p className="text-destructive text-xs" role="alert">
                  {uploadErrById[s.id]}
                </p>
              ) : null}
              {s.signatureDataUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setSig(s.id, { signatureDataUrl: null })}
                >
                  Remove image
                </Button>
              ) : null}
            </div>
            <SignatureDrawPad
              signatureId={s.id}
              onUseDrawing={(dataUrl) => setSig(s.id, { signatureDataUrl: dataUrl })}
            />
          </div>
        ))}
        {template.signatures.length < MAX_SIGNATURE_LINES ? (
          <Button type="button" variant="outline" size="sm" onClick={addSignature}>
            <Plus className="size-3.5" />
            Add signer
          </Button>
        ) : null}
      </SidebarSection>

      <SidebarSection title="Logos" description="Uploaded logos become draggable items on the preview.">
        {template.logos.map((logo, index) => (
          <div
            key={logo.id}
            data-control-id={`logo-${logo.id}`}
            data-active-control={
              activeControlId === `logo-${logo.id}` ? "true" : undefined
            }
            className="border-border/50 bg-background/40 space-y-3 border p-3 transition-[background-color,border-color,box-shadow] duration-500 data-[active-control=true]:border-brand/70 data-[active-control=true]:bg-brand/10 data-[active-control=true]:shadow-[inset_3px_0_0_var(--brand)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                Logo slot {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove logo slot ${index + 1}`}
                onClick={() => removeLogo(logo.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`logo-file-${logo.id}`}>Logo file</Label>
              <Input
                id={`logo-file-${logo.id}`}
                type="file"
                accept="image/*"
                className="text-xs text-muted-foreground file:mr-2"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (!f) {
                    return
                  }
                  const r = new FileReader()
                  r.onload = () => setLogo(logo.id, String(r.result))
                  r.readAsDataURL(f)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`logo-width-${logo.id}`}>Width %</Label>
              <Input
                id={`logo-width-${logo.id}`}
                type="number"
                min={6}
                max={45}
                value={logo.widthPercent}
                onChange={(e) =>
                  setLogoLayout(logo.id, {
                    widthPercent: clamp(Number(e.target.value) || logo.widthPercent, 6, 45),
                  })
                }
              />
            </div>
            <PositionButtons
              onCenterX={() =>
                setLogoLayout(logo.id, { centerXPercent: CENTER_PERCENT })
              }
              onCenterY={() =>
                setLogoLayout(logo.id, { centerYPercent: CENTER_PERCENT })
              }
              onCenterBoth={() =>
                setLogoLayout(logo.id, {
                  centerXPercent: CENTER_PERCENT,
                  centerYPercent: CENTER_PERCENT,
                })
              }
            />
            {logo.dataUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setLogo(logo.id, null)}
              >
                Clear logo
              </Button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLogo}>
          <Plus className="size-3.5" />
          Add logo slot
        </Button>
      </SidebarSection>
    </div>
  )
}
