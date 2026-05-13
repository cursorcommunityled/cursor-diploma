import type { Attendee } from "@/lib/diploma-types"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type AttendeeReviewProps = {
  fields: Array<string>
  nameColumnKey: string | null
  onNameColumnKey: (key: string) => void
  attendees: Array<Attendee>
  onAttendeeNameChange: (id: string, name: string) => void
}

export function AttendeeReview({
  fields,
  nameColumnKey,
  onNameColumnKey,
  attendees,
  onAttendeeNameChange,
}: AttendeeReviewProps) {
  return (
    <div className="space-y-3">
      {fields.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="name-col">Name column</Label>
          <select
            id="name-col"
            className="border-input bg-background/60 text-foreground h-9 w-full border px-2 text-sm"
            value={nameColumnKey ?? ""}
            onChange={(e) => onNameColumnKey(e.target.value)}
          >
            <option value="" disabled>
              Select column...
            </option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {attendees.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {attendees.length} attendees. Edit display names before export.
          </p>
          <div className="border-border/50 max-h-56 space-y-2 overflow-y-auto border bg-background/40 p-2">
            {attendees.map((a, index) => (
              <div key={a.id} className="space-y-1">
                <Label
                  className="text-muted-foreground text-[0.65rem] uppercase"
                  htmlFor={`nm-${a.id}`}
                >
                  Attendee {index + 1}
                </Label>
                <Input
                  id={`nm-${a.id}`}
                  value={a.displayName}
                  onChange={(e) => onAttendeeNameChange(a.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Upload a CSV to list attendees.
        </p>
      )}
    </div>
  )
}
