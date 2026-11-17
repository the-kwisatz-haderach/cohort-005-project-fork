import { describeLength, type NoteLength } from "./lib/note-length";

export type { NoteLength, NoteLengthTone } from "./lib/note-length";

/**
 * The character counter under a Student's note: how much of the allowance
 * the draft uses, and whether that is worth drawing their eye to.
 */
export function noteLength(draft: string): NoteLength {
  return describeLength(draft.trim().length);
}

/**
 * Whether saving the draft would change the note. Saving trims the body, so
 * trailing whitespace alone is not a change.
 */
export function hasUnsavedChanges(
  draft: string,
  savedBody: string | undefined
): boolean {
  return draft.trim() !== (savedBody ?? "");
}
