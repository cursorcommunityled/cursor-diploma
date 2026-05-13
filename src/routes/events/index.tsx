import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, CalendarPlus, GraduationCap } from "lucide-react"
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
import { migrateLegacyGlobalDiplomaDraft } from "@/lib/diploma-storage"
import { loadEvents } from "@/lib/events-storage"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/events/")({
  component: EventsListPage,
})

function EventsListPage() {
  const [events, setEvents] = useState<Array<HubEventRecord>>([])
  const [legacyMigratedId, setLegacyMigratedId] = useState<string | null>(null)

  useEffect(() => {
    const migrated = migrateLegacyGlobalDiplomaDraft()
    if (migrated) {
      setLegacyMigratedId(migrated)
    }
    setEvents(loadEvents())
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Each event has its own workspace and tools. Open an event to create
            diplomas and more.
          </p>
        </div>
        <Link
          to="/events/new"
          className={buttonVariants({ size: "default" })}
        >
          <CalendarPlus className="size-4" />
          New event
        </Link>
      </div>

      {legacyMigratedId ? (
        <p className="text-brand border-brand/30 bg-brand/5 rounded-none border px-3 py-2 text-sm">
          Your previous diploma draft was moved into{" "}
          <Link
            to="/events/$eventId"
            params={{ eventId: legacyMigratedId }}
            className="font-medium underline-offset-4 hover:underline"
          >
            a new event
          </Link>
          .
        </p>
      ) : null}

      {events.length === 0 ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">No events yet</CardTitle>
            <CardDescription>
              Create an event to unlock tools like the diploma generator. Everything
              stays in this browser (local storage).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/events/new"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              Create your first event
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((ev) => (
              <li key={ev.id}>
                <Link
                  to="/events/$eventId"
                  params={{ eventId: ev.id }}
                  className="block"
                >
                  <Card className="border-border/60 hover:border-brand/40 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{ev.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(ev.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "text-brand pointer-events-none -ml-2 gap-1 px-2"
                        )}
                      >
                        Open workspace
                        <ArrowRight className="size-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
        </ul>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <div className="text-brand mb-1 flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="size-4" />
              Per-event tool
            </div>
            <CardTitle className="text-lg">Diploma generator</CardTitle>
            <CardDescription>
              Lives inside an event so each meetup keeps its own CSV, layout, and
              exports.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  )
}
