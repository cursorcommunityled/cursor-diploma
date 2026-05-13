import { FileDown, ImageIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type ExportPanelProps = {
  busy: boolean
  canExport: boolean
  onExportPdf: () => void
  onExportZip: () => void
  error: string | null
}

export function ExportPanel({
  busy,
  canExport,
  onExportPdf,
  onExportZip,
  error,
}: ExportPanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Generate one PDF with all diplomas, or a ZIP of PNG files.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          disabled={!canExport || busy}
          onClick={onExportPdf}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" />
          )}
          PDF
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canExport || busy}
          onClick={onExportZip}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageIcon className="size-4" />
          )}
          PNG ZIP
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
