import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
  mode: "items"
  pointerId: number
  startX: number
  startY: number
  startGroupCx: number
  startGroupCy: number
  targets: Array<{
    target: DragTarget
    startCx: number
    startCy: number
  }>
}

type MarqueeDrag = {
  mode: "marquee"
  pointerId: number
  startXPercent: number
  startYPercent: number
  currentXPercent: number
  currentYPercent: number
}

type ActiveInteraction = PointerDrag | MarqueeDrag

type PercentRect = {
  left: number
  top: number
  right: number
  bottom: number
}

const GRID_STEPS = 12

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function snapPercent(value: number): number {
  const clamped = clampPercent(value)
  return (Math.round((clamped / 100) * GRID_STEPS) / GRID_STEPS) * 100
}

function eventPointPercent(
  e: PointerEvent<HTMLElement>,
  rect: DOMRect
): { x: number; y: number } {
  return {
    x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
  }
}

function normalizePercentRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): PercentRect {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    right: Math.max(startX, currentX),
    bottom: Math.max(startY, currentY),
  }
}

function percentRectStyle(rect: PercentRect): CSSProperties {
  return {
    left: `${rect.left}%`,
    top: `${rect.top}%`,
    width: `${rect.right - rect.left}%`,
    height: `${rect.bottom - rect.top}%`,
  }
}

function rectsIntersect(a: PercentRect, b: PercentRect): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  )
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

function selectableBounds(
  root: HTMLElement,
  keys: Array<string>
): PercentRect | null {
  const rootRect = root.getBoundingClientRect()
  if (rootRect.width <= 0 || rootRect.height <= 0) {
    return null
  }

  const keySet = new Set(keys)
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  root.querySelectorAll<HTMLElement>("[data-selectable-key]").forEach((el) => {
    const key = el.dataset.selectableKey
    if (!key || !keySet.has(key)) {
      return
    }

    const rect = el.getBoundingClientRect()
    left = Math.min(left, ((rect.left - rootRect.left) / rootRect.width) * 100)
    top = Math.min(top, ((rect.top - rootRect.top) / rootRect.height) * 100)
    right = Math.max(
      right,
      ((rect.right - rootRect.left) / rootRect.width) * 100
    )
    bottom = Math.max(
      bottom,
      ((rect.bottom - rootRect.top) / rootRect.height) * 100
    )
  })

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null
  }

  return {
    left: clampPercent(left),
    top: clampPercent(top),
    right: clampPercent(right),
    bottom: clampPercent(bottom),
  }
}

function selectableKeysInRect(
  root: HTMLElement,
  rect: PercentRect
): Array<string> {
  const rootRect = root.getBoundingClientRect()
  if (rootRect.width <= 0 || rootRect.height <= 0) {
    return []
  }

  const keys: Array<string> = []
  root.querySelectorAll<HTMLElement>("[data-selectable-key]").forEach((el) => {
    const key = el.dataset.selectableKey
    if (!key) {
      return
    }

    const itemRect = el.getBoundingClientRect()
    const itemPercentRect = {
      left: ((itemRect.left - rootRect.left) / rootRect.width) * 100,
      top: ((itemRect.top - rootRect.top) / rootRect.height) * 100,
      right: ((itemRect.right - rootRect.left) / rootRect.width) * 100,
      bottom: ((itemRect.bottom - rootRect.top) / rootRect.height) * 100,
    }
    if (rectsIntersect(rect, itemPercentRect)) {
      keys.push(key)
    }
  })

  return keys
}

function sameKeys(a: Array<string>, b: Array<string>): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i])
}

function sameRect(a: PercentRect | null, b: PercentRect | null): boolean {
  if (!a || !b) {
    return a === b
  }
  return (
    Math.abs(a.left - b.left) < 0.1 &&
    Math.abs(a.top - b.top) < 0.1 &&
    Math.abs(a.right - b.right) < 0.1 &&
    Math.abs(a.bottom - b.bottom) < 0.1
  )
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
  const dragRef = useRef<ActiveInteraction | null>(null)
  const [activeInteraction, setActiveInteraction] =
    useState<ActiveInteraction | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Array<string>>([])
  const [selectionBounds, setSelectionBounds] = useState<PercentRect | null>(
    null
  )

  useImperativeHandle(
    ref,
    () => ({
      getCertificateElement: () => rootRef.current,
    }),
    []
  )

  const showEventTitle = Boolean(eventTitle?.trim())
  const visibleLogos = template.logos.filter((logo) => Boolean(logo.dataUrl))
  const selectableTargets = useMemo<Array<DragTarget>>(
    () => [
      ...(showEventTitle ? ([{ kind: "eventTitle" }] as const) : []),
      { kind: "title" },
      { kind: "subtitle" },
      { kind: "name" },
      ...template.signatures.map((s) => ({
        kind: "signature" as const,
        id: s.id,
      })),
      ...template.logos
        .filter((logo) => Boolean(logo.dataUrl))
        .map((logo) => ({ kind: "logo" as const, id: logo.id })),
    ],
    [showEventTitle, template.logos, template.signatures]
  )
  const selectableByKey = useMemo(
    () =>
      new Map(selectableTargets.map((target) => [targetKey(target), target])),
    [selectableTargets]
  )
  const selectableKeySignature = selectableTargets.map(targetKey).join("|")
  const selectedKeySignature = selectedKeys.join("|")

  useEffect(() => {
    setSelectedKeys((keys) => keys.filter((key) => selectableByKey.has(key)))
  }, [selectableByKey])

  useEffect(() => {
    if (!rootRef.current || selectedKeys.length <= 1) {
      setSelectionBounds((current) => (current ? null : current))
      return
    }

    const next = selectableBounds(rootRef.current, selectedKeys)
    setSelectionBounds((current) => (sameRect(current, next) ? current : next))
  }, [
    activeInteraction,
    selectedKeySignature,
    selectableKeySignature,
    template,
  ])

  const startDrag = useCallback(
    (target: DragTarget) => (e: PointerEvent<HTMLElement>) => {
      if (!layoutEditing || !rootRef.current) {
        return
      }
      const key = targetKey(target)
      const nextKeys = selectedKeys.includes(key) ? selectedKeys : [key]
      const nextTargets = nextKeys
        .map((selectedKey) => selectableByKey.get(selectedKey))
        .filter((selectedTarget): selectedTarget is DragTarget =>
          Boolean(selectedTarget)
        )
      const targetPoints = nextTargets
        .map((selectedTarget) => {
          const point = getTargetPoint(template, selectedTarget)
          return point
            ? { target: selectedTarget, startCx: point.x, startCy: point.y }
            : null
        })
        .filter((point): point is NonNullable<typeof point> => Boolean(point))
      const bounds = selectableBounds(rootRef.current, nextKeys)
      if (!bounds || targetPoints.length === 0) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      onItemFocus?.(controlIdForTarget(target))
      setSelectedKeys(nextKeys)
      const interaction = {
        mode: "items" as const,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startGroupCx: (bounds.left + bounds.right) / 2,
        startGroupCy: (bounds.top + bounds.bottom) / 2,
        targets: targetPoints,
      }
      dragRef.current = interaction
      setActiveInteraction(interaction)
    },
    [layoutEditing, onItemFocus, selectableByKey, selectedKeys, template]
  )

  const startMarquee = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!layoutEditing || !rootRef.current || e.button !== 0) {
        return
      }
      const rect = rootRef.current.getBoundingClientRect()
      const start = eventPointPercent(e, rect)
      const interaction = {
        mode: "marquee" as const,
        pointerId: e.pointerId,
        startXPercent: start.x,
        startYPercent: start.y,
        currentXPercent: start.x,
        currentYPercent: start.y,
      }

      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = interaction
      setActiveInteraction(interaction)
      setSelectedKeys([])
    },
    [layoutEditing]
  )

  const moveDrag = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const st = dragRef.current
      if (!st || st.pointerId !== e.pointerId || !rootRef.current) {
        return
      }
      const rect = rootRef.current.getBoundingClientRect()

      if (st.mode === "marquee") {
        const current = eventPointPercent(e, rect)
        const interaction = {
          ...st,
          currentXPercent: current.x,
          currentYPercent: current.y,
        }
        const selectionRect = normalizePercentRect(
          interaction.startXPercent,
          interaction.startYPercent,
          interaction.currentXPercent,
          interaction.currentYPercent
        )
        const nextKeys = selectableKeysInRect(rootRef.current, selectionRect)
        dragRef.current = interaction
        setActiveInteraction(interaction)
        setSelectedKeys((currentKeys) =>
          sameKeys(currentKeys, nextKeys) ? currentKeys : nextKeys
        )
        return
      }

      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      const nextGroupX = snapPercent(st.startGroupCx + (dx / rect.width) * 100)
      const nextGroupY = snapPercent(st.startGroupCy + (dy / rect.height) * 100)
      const deltaX = nextGroupX - st.startGroupCx
      const deltaY = nextGroupY - st.startGroupCy
      const nextTemplate = st.targets.reduce(
        (currentTemplate, point) =>
          updateTargetPoint(
            currentTemplate,
            point.target,
            clampPercent(point.startCx + deltaX),
            clampPercent(point.startCy + deltaY)
          ),
        template
      )
      onTemplateChange(nextTemplate)
    },
    [onTemplateChange, template]
  )

  const endDrag = useCallback((e: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      setActiveInteraction(null)
    }
  }, [])

  const isDragging = useCallback(
    (target: DragTarget) =>
      activeInteraction?.mode === "items" &&
      activeInteraction.targets.some(
        (point) => targetKey(point.target) === targetKey(target)
      ),
    [activeInteraction]
  )

  const isSelected = useCallback(
    (target: DragTarget) => selectedKeys.includes(targetKey(target)),
    [selectedKeys]
  )

  const dragProps = (target: DragTarget) => ({
    onPointerEnter: () => onItemFocus?.(controlIdForTarget(target)),
    onPointerDown: startDrag(target),
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation()
      moveDrag(e)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation()
      endDrag(e)
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation()
      endDrag(e)
    },
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
    const active = isDragging(target) || isSelected(target)
    return (
      <div
        data-selectable-key={targetKey(target)}
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
          className={cn(
            "min-h-[1.1em] w-full whitespace-pre-wrap",
            extraClassName
          )}
          style={textStyle(box)}
        >
          {text}
        </p>
      </div>
    )
  }

  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => i)
  const marqueeRect =
    activeInteraction?.mode === "marquee"
      ? normalizePercentRect(
          activeInteraction.startXPercent,
          activeInteraction.startYPercent,
          activeInteraction.currentXPercent,
          activeInteraction.currentYPercent
        )
      : null

  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden border border-border/70 bg-muted/20">
        <div
          ref={rootRef}
          data-certificate
          className="font-certificate relative w-full overflow-hidden"
          style={{
            aspectRatio: "297 / 210",
            backgroundColor: template.backgroundColor,
            containerType: "inline-size",
          }}
          onPointerDown={startMarquee}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {backgroundDataUrl ? (
            <img
              src={backgroundDataUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : null}

          {visibleLogos.map((logo) => {
            const target: DragTarget = { kind: "logo", id: logo.id }
            const active = isDragging(target) || isSelected(target)
            return (
              <div
                key={logo.id}
                data-selectable-key={targetKey(target)}
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
            const active = isDragging(target) || isSelected(target)
            const blockW = Math.max(22, s.imageWidthPercent)
            return (
              <div
                key={s.id}
                data-selectable-key={targetKey(target)}
                className={cn(
                  "absolute z-20 text-center text-foreground/90 select-none",
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

          {selectionBounds && selectedKeys.length > 1 ? (
            <div
              data-export-hidden="true"
              className="pointer-events-none absolute z-[25] border border-brand bg-brand/8"
              style={percentRectStyle(selectionBounds)}
              aria-hidden
            />
          ) : null}

          {marqueeRect ? (
            <div
              data-export-hidden="true"
              className="pointer-events-none absolute z-40 border border-brand bg-brand/15"
              style={percentRectStyle(marqueeRect)}
              aria-hidden
            />
          ) : null}

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
