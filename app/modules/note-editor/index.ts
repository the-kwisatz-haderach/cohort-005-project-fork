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

/**
 * The save error to show, if any. A rejection is about the draft that was
 * sent; once the Student edits it, the message no longer describes what is in
 * the box.
 */
export function visibleSaveError(
  draft: string,
  submittedDraft: string | null,
  error: string | undefined
): string | undefined {
  return draft === submittedDraft ? error : undefined;
}
