import { useRef, useState } from "react"
import { Upload } from "lucide-react"

import type {ParsedCsv} from "@/lib/csv-attendees";
import { Button } from "@/components/ui/button"
import {  parseCsvToRows } from "@/lib/csv-attendees"

type CsvUploadProps = {
  onParsed: (p: ParsedCsv, rawText: string) => void
  parseError: string | null
  onError: (m: string | null) => void
}

export function CsvUpload({ onParsed, parseError, onError }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          onError(null)
          if (!f) {
            return
          }
          setFileName(f.name)
          try {
            const text = await f.text()
            const parsed = await parseCsvToRows(text)
            onParsed(parsed, text)
          } catch (err) {
            onError(
              err instanceof Error ? err.message : "Could not parse this CSV"
            )
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {fileName ? `Replace: ${fileName}` : "Upload CSV"}
      </Button>
      {parseError ? (
        <p className="text-destructive text-xs" role="alert">
          {parseError}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Expects a header row. The app picks a likely name column, then lets you
        override it below.
      </p>
    </div>
  )
}
