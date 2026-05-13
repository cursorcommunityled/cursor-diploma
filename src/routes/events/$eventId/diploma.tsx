import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { DiplomaWorkspace } from "@/components/diploma-generator/diploma-workspace"
import { getEventById } from "@/lib/events-storage"

export const Route = createFileRoute("/events/$eventId/diploma")({
  component: EventDiplomaPage,
})

function EventDiplomaPage() {
  const { eventId } = Route.useParams()
  const navigate = useNavigate()
  const [missing, setMissing] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    setMissing(!getEventById(eventId))
  }, [eventId])

  useEffect(() => {
    if (missing === true) {
      void navigate({ to: "/events", replace: true })
    }
  }, [missing, navigate])

  if (missing === undefined || missing === true) {
    return (
      <p className="text-muted-foreground text-sm">
        {missing === true ? "Redirecting…" : "Loading…"}
      </p>
    )
  }

  return <DiplomaWorkspace eventId={eventId} />
}
