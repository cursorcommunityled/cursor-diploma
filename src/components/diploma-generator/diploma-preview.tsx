import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import type { CSSProperties, PointerEvent } from "react"

import type { DiplomaTemplate, TextBoxLayout } from "@/lib/diploma-types"
import { cn } from "@/lib/utils"

export type DiplomaPreviewHandle = {
  getCertificateElement: () => HTMLElement | null
}

type DiplomaPreviewProps = {
  template: DiplomaTemplate
  backgroundDataUrl: string | null
  displayName: string
  onTemplateChange: (t: DiplomaTemplate) => void
  onItemFocus?: (controlId: string) => void
  layoutEditing?: boolean
  className?: string
  eventTitle?: string | null
}

type DragTarget =
  | { kind: "eventTitle" }
  | { kind: "title" }
  | { kind: "subtitle" }
  | { kind: "name" }
  | { kind: "signature"; id: string }
  | { kind: "logo"; id: string }

type PointerDrag = {
  target: DragTarget
  pointerId: number
  startX: number
  startY: number
  startCx: number
  startCy: number
}

const GRID_STEPS = 12

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function snapPercent(value: number): number {
  const clamped = clampPercent(value)
  return (Math.round((clamped / 100) * GRID_STEPS) / GRID_STEPS) * 100
}

function targetKey(target: DragTarget): string {
  return "id" in target ? `${target.kind}:${target.id}` : target.kind
}

function controlIdForTarget(target: DragTarget): string {
  switch (target.kind) {
    case "eventTitle":
      return "text-event-title"
    case "title":
      return "text-certificate-title"
    case "subtitle":
      return "text-subtitle"
    case "name":
      return "text-attendee-name"
    case "signature":
      return `signature-${target.id}`
    case "logo":
      return `logo-${target.id}`
  }
}

function getTargetPoint(
  template: DiplomaTemplate,
  target: DragTarget
): { x: number; y: number } | null {
  switch (target.kind) {
    case "eventTitle":
      return {
        x: template.eventTitleBox.centerXPercent,
        y: template.eventTitleBox.centerYPercent,
      }
    case "title":
      return {
        x: template.titleBox.centerXPercent,
        y: template.titleBox.centerYPercent,
      }
    case "subtitle":
      return {
        x: template.subtitleBox.centerXPercent,
        y: template.subtitleBox.centerYPercent,
      }
    case "name":
      return {
        x: template.nameBox.centerXPercent,
        y: template.nameBox.centerYPercent,
      }
    case "signature": {
      const signature = template.signatures.find((s) => s.id === target.id)
      return signature
        ? { x: signature.centerXPercent, y: signature.centerYPercent }
        : null
    }
    case "logo": {
      const logo = template.logos.find((l) => l.id === target.id)
      return logo ? { x: logo.centerXPercent, y: logo.centerYPercent } : null
    }
  }
}

function updateTargetPoint(
  template: DiplomaTemplate,
  target: DragTarget,
  x: number,
  y: number
): DiplomaTemplate {
  switch (target.kind) {
    case "eventTitle":
      return {
        ...template,
        eventTitleBox: {
          ...template.eventTitleBox,
          centerXPercent: x,
          centerYPercent: y,
        },
      }
    case "title":
      return {
        ...template,
        titleBox: {
          ...template.titleBox,
          centerXPercent: x,
          centerYPercent: y,
        },
      }
    case "subtitle":
      return {
        ...template,
        subtitleBox: {
          ...template.subtitleBox,
          centerXPercent: x,
          centerYPercent: y,
        },
      }
    case "name":
      return {
        ...template,
        nameBox: {
          ...template.nameBox,
          centerXPercent: x,
          centerYPercent: y,
        },
      }
    case "signature":
      return {
        ...template,
        signatures: template.signatures.map((s) =>
          s.id === target.id
            ? { ...s, centerXPercent: x, centerYPercent: y }
            : s
        ),
      }
    case "logo":
      return {
        ...template,
        logos: template.logos.map((logo) =>
          logo.id === target.id
            ? { ...logo, centerXPercent: x, centerYPercent: y }
            : logo
        ),
      }
  }
}

function draggableStyle(box: TextBoxLayout): CSSProperties {
  return {
    left: `${box.centerXPercent}%`,
    top: `${box.centerYPercent}%`,
    width: `${box.widthPercent}%`,
    transform: "translate(-50%, -50%)",
  }
}

function textStyle(box: TextBoxLayout): CSSProperties {
  return {
    color: box.color,
    fontSize: scaledFontSize(box.fontSizePx),
    fontWeight: box.fontWeight,
    lineHeight: 1.15,
    textAlign: box.textAlign,
    textShadow: "0 2px 10px rgba(0,0,0,0.45)",
  }
}

function scaledFontSize(px: number): string {
  return `clamp(${Math.max(8, px * 0.58)}px, ${px / 10}cqw, ${px * 1.18}px)`
}

function EditorFrame({ active }: { active: boolean }) {
  return (
    <span
      data-export-hidden="true"
      className={cn(
        "pointer-events-none absolute -inset-1 border border-dashed transition-colors",
        active ? "border-brand" : "border-white/20"
      )}
      aria-hidden
    >
      <span className="absolute -top-1 -left-1 size-2 border border-brand bg-background" />
      <span className="absolute -right-1 -bottom-1 size-2 border border-brand bg-background" />
    </span>
  )
}

export const DiplomaPreview = forwardRef<
  DiplomaPreviewHandle,
  DiplomaPreviewProps
>(function DiplomaPreviewView(
  {
    template,
    backgroundDataUrl,
    displayName,
    onTemplateChange,
    onItemFocus,
    layoutEditing = true,
    className,
    eventTitle,
  },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<PointerDrag | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      getCertificateElement: () => rootRef.current,
    }),
    []
  )

  const startDrag = useCallback(
    (target: DragTarget) => (e: PointerEvent<HTMLElement>) => {
      if (!layoutEditing || !rootRef.current) {
        return
      }
      const point = getTargetPoint(template, target)
      if (!point) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      onItemFocus?.(controlIdForTarget(target))
      dragRef.current = {
        target,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startCx: point.x,
        startCy: point.y,
      }
      setDraggingKey(targetKey(target))
    },
    [layoutEditing, onItemFocus, template]
  )

  const moveDrag = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const st = dragRef.current
      if (!st || st.pointerId !== e.pointerId || !rootRef.current) {
        return
      }
      const rect = rootRef.current.getBoundingClientRect()
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      const nextX = snapPercent(st.startCx + (dx / rect.width) * 100)
      const nextY = snapPercent(st.startCy + (dy / rect.height) * 100)
      onTemplateChange(updateTargetPoint(template, st.target, nextX, nextY))
    },
    [onTemplateChange, template]
  )

  const endDrag = useCallback((e: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      setDraggingKey(null)
    }
  }, [])

  const isDragging = useCallback(
    (target: DragTarget) => draggingKey === targetKey(target),
    [draggingKey]
  )

  const dragProps = (target: DragTarget) => ({
    onPointerEnter: () => onItemFocus?.(controlIdForTarget(target)),
    onPointerDown: startDrag(target),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  })

  const renderTextBlock = (
    target: Extract<
      DragTarget,
      { kind: "eventTitle" | "title" | "subtitle" | "name" }
    >,
    box: TextBoxLayout,
    text: string,
    extraClassName?: string
  ) => {
    const active = isDragging(target)
    return (
      <div
        className={cn(
          "absolute z-20 select-none",
          layoutEditing && "cursor-grab touch-none",
          active && "cursor-grabbing"
        )}
        style={{
          ...draggableStyle(box),
          pointerEvents: layoutEditing ? "auto" : "none",
        }}
        {...dragProps(target)}
      >
        <EditorFrame active={active} />
        <p
          className={cn("min-h-[1.1em] w-full whitespace-pre-wrap", extraClassName)}
          style={textStyle(box)}
        >
          {text}
        </p>
      </div>
    )
  }

  const showEventTitle = Boolean(eventTitle?.trim())
  const visibleLogos = template.logos.filter((logo) => Boolean(logo.dataUrl))
  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => i)

  return (
    <div className={cn("w-full", className)}>
      <div className="border-border/70 bg-muted/20 overflow-hidden border">
        <div
          ref={rootRef}
          data-certificate
          className="font-certificate relative w-full overflow-hidden"
          style={{
            aspectRatio: "297 / 210",
            backgroundColor: template.backgroundColor,
            containerType: "inline-size",
          }}
        >
          {backgroundDataUrl ? (
            <img
              src={backgroundDataUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : null}

          {visibleLogos.map((logo) => {
            const target: DragTarget = { kind: "logo", id: logo.id }
            const active = isDragging(target)
            return (
              <div
                key={logo.id}
                className={cn(
                  "absolute z-20 select-none",
                  layoutEditing && "cursor-grab touch-none",
                  active && "cursor-grabbing"
                )}
                style={{
                  left: `${logo.centerXPercent}%`,
                  top: `${logo.centerYPercent}%`,
                  width: `${logo.widthPercent}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: layoutEditing ? "auto" : "none",
                }}
                {...dragProps(target)}
              >
                <EditorFrame active={active} />
                <img
                  src={logo.dataUrl ?? ""}
                  alt=""
                  className="h-auto w-full object-contain"
                  draggable={false}
                />
              </div>
            )
          })}

          {showEventTitle
            ? renderTextBlock(
                { kind: "eventTitle" },
                template.eventTitleBox,
                eventTitle?.trim() ?? "",
                "uppercase"
              )
            : null}
          {renderTextBlock(
            { kind: "title" },
            template.titleBox,
            template.titleText,
            "uppercase"
          )}
          {renderTextBlock(
            { kind: "subtitle" },
            template.subtitleBox,
            template.subtitleText
          )}
          {renderTextBlock(
            { kind: "name" },
            template.nameBox,
            displayName,
            "font-semibold"
          )}

          {template.signatures.map((s) => {
            const target: DragTarget = { kind: "signature", id: s.id }
            const active = isDragging(target)
            const blockW = Math.max(22, s.imageWidthPercent)
            return (
              <div
                key={s.id}
                className={cn(
                  "absolute z-20 select-none text-center text-foreground/90",
                  layoutEditing && "cursor-grab touch-none",
                  active && "cursor-grabbing"
                )}
                style={{
                  left: `${s.centerXPercent}%`,
                  top: `${s.centerYPercent}%`,
                  width: `${blockW}%`,
                  minWidth: "6rem",
                  transform: "translate(-50%, -50%)",
                  fontSize: scaledFontSize(s.fontSizePx),
                  textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  pointerEvents: layoutEditing ? "auto" : "none",
                }}
                {...dragProps(target)}
              >
                <EditorFrame active={active} />
                {s.signatureDataUrl ? (
                  <div className="mb-0.5 flex justify-center">
                    <img
                      src={s.signatureDataUrl}
                      alt=""
                      className="h-auto object-contain"
                      style={{
                        width: `${(s.imageWidthPercent / blockW) * 100}%`,
                        maxWidth: "100%",
                      }}
                      draggable={false}
                    />
                  </div>
                ) : null}
                <p className="mb-0.5 text-[0.7em] text-white/50 uppercase">
                  {s.role}
                </p>
                <p className="border-t border-white/25 pt-1 text-white/95">
                  {s.name || "-"}
                </p>
              </div>
            )
          })}

          <div
            data-export-hidden="true"
            className="pointer-events-none absolute inset-0 z-30"
            aria-hidden
          >
            {gridLines.map((line) => (
              <span
                key={`col-${line}`}
                className={cn(
                  "absolute top-0 bottom-0 border-l",
                  line === 6 ? "border-brand/70" : "border-white/10"
                )}
                style={{ left: `${(line / GRID_STEPS) * 100}%` }}
              />
            ))}
            {gridLines.map((line) => (
              <span
                key={`row-${line}`}
                className={cn(
                  "absolute right-0 left-0 border-t",
                  line === 6 ? "border-brand/70" : "border-white/10"
                )}
                style={{ top: `${(line / GRID_STEPS) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
