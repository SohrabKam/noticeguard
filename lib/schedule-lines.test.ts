import { describe, it, expect } from "vitest"
import { assertEditableScheduleLine, partitionVariationIds } from "./schedule-lines"

describe("assertEditableScheduleLine", () => {
  it("permits edit and delete on ordinary schedule lines", () => {
    const line = { isVariation: false }
    expect(() => assertEditableScheduleLine(line, "edit")).not.toThrow()
    expect(() => assertEditableScheduleLine(line, "delete")).not.toThrow()
  })

  it("blocks editing a variation-derived line", () => {
    expect(() => assertEditableScheduleLine({ isVariation: true }, "edit")).toThrow(
      "Cannot edit variation lines here"
    )
  })

  it("blocks deleting a variation-derived line", () => {
    expect(() => assertEditableScheduleLine({ isVariation: true }, "delete")).toThrow(
      "Cannot delete variation lines here"
    )
  })
})

describe("partitionVariationIds", () => {
  it("separates variation-derived line ids from editable ones", () => {
    const { variationIds, editableIds } = partitionVariationIds([
      { id: "a", isVariation: false },
      { id: "b", isVariation: true },
      { id: "c", isVariation: true },
      { id: "d", isVariation: false },
    ])
    expect([...variationIds].sort()).toEqual(["b", "c"])
    expect([...editableIds].sort()).toEqual(["a", "d"])
  })

  it("returns two empty sets for an empty schedule", () => {
    const { variationIds, editableIds } = partitionVariationIds([])
    expect(variationIds.size).toBe(0)
    expect(editableIds.size).toBe(0)
  })
})
