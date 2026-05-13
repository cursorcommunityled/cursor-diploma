import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/diploma-generator")({
  beforeLoad: () => {
    throw redirect({ to: "/events" })
  },
})
