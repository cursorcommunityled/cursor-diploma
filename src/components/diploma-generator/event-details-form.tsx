import type { EventDetails } from "@/lib/diploma-types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type EventDetailsFormProps = {
  event: EventDetails
  onChange: (e: EventDetails) => void
}

export function EventDetailsForm({ event, onChange }: EventDetailsFormProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="event-title">Event title</Label>
        <Input
          id="event-title"
          value={event.title}
          onChange={(e) => onChange({ ...event, title: e.target.value })}
          placeholder="Cursor Buildathon San Salvador"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="event-notes">Notes</Label>
        <Input
          id="event-notes"
          value={event.notes ?? ""}
          onChange={(e) =>
            onChange({ ...event, notes: e.target.value || undefined })
          }
          placeholder="Internal credits, venue, handoff notes"
        />
      </div>
    </div>
  )
}
