import { Link, useRouterState } from "@tanstack/react-router"
import { CalendarRange, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const eventMatch = pathname.match(/^\/events\/([^/]+)/)
  const eventIdInPath = eventMatch?.[1]
  const isDiplomaEditor = /^\/events\/[^/]+\/diploma$/.test(pathname)
  const isEventChild =
    Boolean(eventIdInPath) &&
    eventIdInPath !== "new" &&
    pathname.startsWith("/events/")

  return (
    <div className={cn("bg-background text-foreground min-h-svh", className)}>
      <header className="border-border/60 bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Cursor Diploma Generator, home"
            className="text-foreground flex items-center gap-3 text-sm font-semibold tracking-tight"
          >
            <img
              src="/cursor.svg"
              alt=""
              width={120}
              height={28}
              className="h-6 w-auto sm:h-7"
            />
            <span className="hidden sm:inline">Cursor Diploma Generator</span>
            <span className="sm:hidden">Diploma</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
            <Link
              to="/"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-muted-foreground",
              })}
            >
              Home
            </Link>
            <Link
              to="/events"
              className={buttonVariants({
                variant: pathname.startsWith("/events") ? "default" : "ghost",
                size: "sm",
                className: pathname.startsWith("/events") ? undefined : "text-muted-foreground",
              })}
            >
              <CalendarRange className="size-3.5" />
              Events
            </Link>
            {isEventChild && eventIdInPath ? (
              <span
                className="text-muted-foreground hidden max-w-[10rem] items-center gap-0.5 text-xs sm:flex"
                aria-hidden
              >
                <ChevronRight className="size-3 shrink-0 opacity-50" />
                <Link
                  to="/events/$eventId"
                  params={{ eventId: eventIdInPath }}
                  className="truncate hover:text-foreground font-medium"
                >
                  Workspace
                </Link>
              </span>
            ) : null}
          </nav>
        </div>
      </header>
      <main
        className={cn(
          "w-full flex-1",
          isDiplomaEditor
            ? "max-w-none px-0 py-0"
            : "mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
        )}
      >
        {children}
      </main>
    </div>
  )
}
