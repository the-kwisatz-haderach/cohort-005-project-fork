import { useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { Check, Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { hasUnsavedChanges, noteLength } from "./index";

/** The Student's private note on a lesson, posted as the `save-note` intent. */
export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const unsaved = hasUnsavedChanges(draft, note?.body);

  return (
    <Card className="mb-8 gap-0 overflow-hidden py-0">
      <NoteHeader>
        <NoteStatus
          error={error}
          unsaved={unsaved}
          updatedAt={note?.updatedAt}
        />
      </NoteHeader>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-note" />
        <Textarea
          name="body"
          aria-labelledby="lesson-note-heading"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Jot down what you want to remember from this lesson…"
          aria-invalid={error ? true : undefined}
          className="max-h-[32rem] min-h-40 resize-y rounded-none [overflow-wrap:anywhere] border-0 bg-transparent px-5 py-4 leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-end gap-3 border-t px-5 py-2.5">
          <LengthCounter draft={draft} />
          <Button type="submit" size="sm" disabled={isSaving || !unsaved}>
            {isSaving ? "Saving…" : "Save note"}
          </Button>
        </div>
      </fetcher.Form>
    </Card>
  );
}

function NoteHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <NotebookPen className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h2
          id="lesson-note-heading"
          className="text-sm leading-tight font-semibold"
        >
          Your notes
        </h2>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Private to you
        </p>
      </div>
      {children}
    </div>
  );
}

function LengthCounter({ draft }: { draft: string }) {
  const { label, tone } = noteLength(draft);
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        tone === "quiet" && "text-muted-foreground",
        tone === "warning" && "text-amber-600 dark:text-amber-500",
        tone === "over" && "font-medium text-destructive"
      )}
    >
      {label}
    </span>
  );
}

function NoteStatus({
  error,
  unsaved,
  updatedAt,
}: {
  error: string | undefined;
  unsaved: boolean;
  updatedAt: string | undefined;
}) {
  if (error) {
    return (
      <span
        role="alert"
        className="max-w-[60%] text-right text-xs text-destructive"
      >
        {error}
      </span>
    );
  }
  if (unsaved) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!updatedAt) return null;
  return (
    <span
      suppressHydrationWarning
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Check className="size-3" />
      Saved {formatRelativeTime(updatedAt)}
    </span>
  );
}
