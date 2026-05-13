import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronRight, GraduationCap } from "lucide-react"
import { useEffect, useState } from "react"

import type { HubEventRecord } from "@/lib/events-storage"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { deleteEvent, getEventById } from "@/lib/events-storage"
import { clearDiplomaDraft } from "@/lib/diploma-storage"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/events/$eventId/")({
  component: EventWorkspacePage,
})

function EventWorkspacePage() {
  const { eventId } = Route.useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<HubEventRecord | null | undefined>(undefined)

  useEffect(() => {
    setEvent(getEventById(eventId) ?? null)
  }, [eventId])

  useEffect(() => {
    if (event === null) {
      void navigate({ to: "/events", replace: true })
    }
  }, [event, navigate])

  if (event === undefined) {
    return (
      <p className="text-muted-foreground text-sm">Loading event…</p>
    )
  }

  if (event === null) {
    return (
      <p className="text-muted-foreground text-sm">Redirecting…</p>
    )
  }

  const onDelete = () => {
    if (
      !window.confirm(
        `Delete “${event.title}”? This removes the event and its saved diploma draft in this browser.`
      )
    ) {
      return
    }
    deleteEvent(eventId)
    clearDiplomaDraft(eventId)
    void navigate({ to: "/events" })
  }

  return (
    <div className="space-y-8">
      <nav
        className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
        aria-label="Breadcrumb"
      >
        <Link to="/events" className="hover:text-foreground font-medium">
          Events
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="text-foreground font-medium">{event.title}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Created{" "}
            {new Date(event.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {event.notes ? (
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
              {event.notes}
            </p>
          ) : (
            <p className="text-muted-foreground/80 mt-3 text-sm italic">
              No notes yet — add them in the diploma tool under event details.
            </p>
          )}
        </div>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0"
          )}
          onClick={onDelete}
        >
          Delete event
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <div className="text-brand mb-1 flex items-center gap-2 text-sm font-medium">
                <GraduationCap className="size-4" />
                Available
              </div>
              <CardTitle className="text-lg">Diploma generator</CardTitle>
              <CardDescription>
                CSV import, background image, layout, PDF or PNG export — scoped to
                this event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/events/$eventId/diploma"
                params={{ eventId }}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "gap-2"
                )}
              >
                <GraduationCap className="size-3.5" />
                Open diplomas
              </Link>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-muted/10">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-lg">
                More soon
              </CardTitle>
              <CardDescription>
                Additional tools will appear here per event.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  )
}
