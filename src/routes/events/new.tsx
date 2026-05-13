import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { registerNewEvent } from "@/lib/events-storage"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/events/new")({
  component: NewEventPage,
})

function NewEventPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const record = registerNewEvent({
      title: title.trim() || "Untitled event",
      notes: notes.trim() || undefined,
    })
    void navigate({
      to: "/events/$eventId",
      params: { eventId: record.id },
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          You can rename or add notes later from the event workspace or diploma
          tool.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Event details</CardTitle>
          <CardDescription>Stored only in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-event-title">Title</Label>
              <Input
                id="new-event-title"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="e.g. Spring Ambassador Meetup"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-event-notes">Notes (optional)</Label>
              <Input
                id="new-event-notes"
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Venue, credits, internal links…"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit">Create event</Button>
              <Link
                to="/events"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
