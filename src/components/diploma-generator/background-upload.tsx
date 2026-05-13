import { useRef } from "react"
import { ImageUp } from "lucide-react"

import { Button } from "@/components/ui/button"

type BackgroundUploadProps = {
  dataUrl: string | null
  onDataUrl: (dataUrl: string | null) => void
}

export function BackgroundUpload({ dataUrl, onDataUrl }: BackgroundUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) {
            return
          }
          const r = new FileReader()
          r.onload = () => onDataUrl(String(r.result))
          r.readAsDataURL(f)
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <ImageUp className="size-3.5" />
        {dataUrl ? "Replace background" : "Upload background"}
      </Button>
      {dataUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full"
          onClick={() => onDataUrl(null)}
        >
          Remove background
        </Button>
      ) : null}
      <p className="text-muted-foreground text-xs leading-relaxed">
        A4 or letter landscape. The image is cropped to fit the wide preview.
      </p>
    </div>
  )
}
