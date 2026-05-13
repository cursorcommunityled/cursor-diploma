import { describe, expect, it } from "vitest"

import {
  inferNameColumnKey,
  parseCsvToRows,
  rowsToAttendees,
} from "./csv-attendees"

describe("csv-attendees", () => {
  it("infers a name column from common headers", () => {
    expect(inferNameColumnKey(["email", "Full Name", "rsvp"])).toBe("Full Name")
  })

  it("parses simple CSV and maps attendees", async () => {
    const text = "Name,email\n Ada Lovelace,ada@x.test\n"
    const { fields, rows } = await parseCsvToRows(text)
    expect(fields).toContain("Name")
    const key = inferNameColumnKey(fields) ?? "Name"
    const { attendees } = rowsToAttendees(rows, key)
    expect(attendees[0]?.displayName).toBe("Ada Lovelace")
  })

  it("combines first and last when no name column value", () => {
    const rows = [
      {
        "first name": "Alan",
        "last name": "Turing",
      },
    ]
    const { attendees } = rowsToAttendees(rows, "Name")
    expect(attendees[0]?.displayName).toBe("Alan Turing")
  })
})
