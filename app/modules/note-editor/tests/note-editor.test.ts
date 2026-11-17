import { describe, it, expect } from "vitest";
import { hasUnsavedChanges, noteLength, visibleSaveError } from "../index";

describe("noteLength", () => {
  it("counts the draft against the allowance", () => {
    expect(noteLength("hello")).toEqual({ label: "5 / 2,000", tone: "quiet" });
  });

  it("counts what will be saved, not surrounding whitespace", () => {
    expect(noteLength("  hi \n").label).toBe("2 / 2,000");
  });

  it("stays quiet just under nine tenths of the allowance", () => {
    expect(noteLength("a".repeat(1799)).tone).toBe("quiet");
  });

  it("warns from nine tenths of the allowance", () => {
    expect(noteLength("a".repeat(1800))).toEqual({
      label: "1,800 / 2,000",
      tone: "warning",
    });
  });

  it("still warns, not errors, at exactly the allowance", () => {
    expect(noteLength("a".repeat(2000)).tone).toBe("warning");
  });

  it("flags a draft over the allowance", () => {
    expect(noteLength("a".repeat(2001))).toEqual({
      label: "2,001 / 2,000",
      tone: "over",
    });
  });
});

describe("hasUnsavedChanges", () => {
  it("is false when the draft matches the saved note", () => {
    expect(hasUnsavedChanges("my note", "my note")).toBe(false);
  });

  it("is true when the draft differs from the saved note", () => {
    expect(hasUnsavedChanges("my note!", "my note")).toBe(true);
  });

  it("treats an empty draft with no saved note as unchanged", () => {
    expect(hasUnsavedChanges("", undefined)).toBe(false);
  });

  it("ignores whitespace that saving would trim", () => {
    expect(hasUnsavedChanges("my note \n", "my note")).toBe(false);
  });

  it("treats a draft with no saved note as a change", () => {
    expect(hasUnsavedChanges("x", undefined)).toBe(true);
  });
});

describe("visibleSaveError", () => {
  it("shows the error while the draft is the one that was sent", () => {
    expect(visibleSaveError("too long", "too long", "Too long")).toBe(
      "Too long"
    );
  });

  it("hides the error once the draft has been edited", () => {
    expect(visibleSaveError("shorter", "too long", "Too long")).toBeUndefined();
  });

  it("shows nothing before anything was sent", () => {
    expect(visibleSaveError("", null, undefined)).toBeUndefined();
  });
});
