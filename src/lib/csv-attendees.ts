import Papa from "papaparse"

import type {Attendee} from "@/lib/diploma-types";
import {  createId } from "@/lib/diploma-types"

const NAME_CANDIDATES = [
  "name",
  "full name",
  "full_name",
  "fullname",
  "attendee",
  "attendee name",
  "participant",
  "display name",
  "display_name",
  "first name",
  "firstname",
  "last name",
  "lastname",
]

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replaceAll(/\s+/g, " ")
}

export type ParsedCsv = {
  fields: Array<string>
  rows: Array<Record<string, string>>
}

/**
 * Parse CSV to header-keyed row objects. Empty lines are skipped.
 */
export function parseCsvToRows(csvText: string): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const raw = result.data
        const data: Array<Record<string, string>> = Array.isArray(raw)
          ? raw
          : []
        const fields =
          result.meta.fields ?? (data[0] ? Object.keys(data[0]) : [])
        if (data.length > 0) {
          for (const row of data) {
            for (const k of Object.keys(row)) {
              if (typeof row[k] === "string") {
                row[k] = row[k].trim()
              }
            }
          }
        }
        resolve({ fields, rows: data })
      },
      error: (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    })
  })
}

/**
 * Infer the best name column from headers. Returns `null` if unclear.
 */
export function inferNameColumnKey(fields: Array<string>): string | null {
  if (fields.length === 0) {
    return null
  }
  const normalized = fields.map((f) => ({ original: f, n: normalizeKey(f) }))

  for (const c of NAME_CANDIDATES) {
    const hit = normalized.find((x) => x.n === c)
    if (hit) {
      return hit.original
    }
  }
  for (const c of NAME_CANDIDATES) {
    const hit = normalized.find((x) => x.n.includes(c) || c.includes(x.n))
    if (hit) {
      return hit.original
    }
  }
  if (fields.length === 1) {
    return fields[0] ?? null
  }
  return null
}

function combineFirstLast(row: Record<string, string>): string | null {
  const fn = (row["first name"] || row["firstname"] || "").trim()
  const ln = (row["last name"] || row["lastname"] || "").trim()
  if (fn || ln) {
    return [fn, ln].filter(Boolean).join(" ")
  }
  return null
}

/**
 * Map parsed rows to attendees using a column key, with first/last fallback.
 */
export function rowsToAttendees(
  rows: Array<Record<string, string>>,
  nameColumnKey: string | null
): { attendees: Array<Attendee>; issues: Array<string> } {
  const issues: Array<string> = []
  const attendees: Array<Attendee> = []
  for (const row of rows) {
    const raw: Record<string, string> = { ...row }
    let name = ""
    if (nameColumnKey) {
      name = String(row[nameColumnKey] ?? "").trim()
    }
    if (!name) {
      const combined = combineFirstLast(row)
      if (combined) {
        name = combined
      }
    }
    if (!name) {
      issues.push("A row was skipped because it had no name value.")
      continue
    }
    attendees.push({ id: createId(), displayName: name, sourceRow: raw })
  }
  if (attendees.length === 0) {
    issues.push("No attendees with a detectable name were found.")
  }
  return { attendees, issues }
}

export function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
