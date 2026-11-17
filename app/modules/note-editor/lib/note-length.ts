import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteLengthTone = "quiet" | "warning" | "over";

export type NoteLength = {
  label: string;
  tone: NoteLengthTone;
};

// Warn with a tenth of the allowance left, so the Student can trim before
// the save is rejected rather than after.
const WARNING_THRESHOLD = Math.floor(MAX_NOTE_LENGTH * 0.9);

export function describeLength(length: number): NoteLength {
  const label = `${length.toLocaleString("en")} / ${MAX_NOTE_LENGTH.toLocaleString("en")}`;
  if (length > MAX_NOTE_LENGTH) return { label, tone: "over" };
  if (length >= WARNING_THRESHOLD) return { label, tone: "warning" };
  return { label, tone: "quiet" };
}
