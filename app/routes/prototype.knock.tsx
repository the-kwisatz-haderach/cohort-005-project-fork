// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?" (issue #22).
// Visit /prototype/knock, switch users in the DevUI, and work the four checks.
// Not production code. Lives on a prototype branch only; never merge.

import { data, Form, useActionData, useLoaderData } from "react-router";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import { comments, lessons, users, UserRole } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import {
  CATEGORY_NEW_ENROLLMENT,
  WORKFLOWS,
  batchStatus,
  decodeJwt,
  env,
  fetchFeed,
  serverClient,
  signTokenFor,
  toKnockRecipient,
} from "~/lib/knock.prototype.server";

async function requireUser(request: Request) {
  const id = await getCurrentUserId(request);
  if (!id) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw data("Unknown user", { status: 404 });
  return user;
}

async function safe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: unknown };
    return {
      ok: false as const,
      error: { status: err.status, message: err.message, error: err.error },
    };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const e = env();
  const envCheck = {
    KNOCK_SECRET_API_KEY: e.secret.startsWith("sk_"),
    KNOCK_PUBLIC_API_KEY: e.publicKey.startsWith("pk_"),
    KNOCK_SIGNING_KEY: e.signingKey.length > 100,
    KNOCK_FEED_CHANNEL_ID: e.feedChannelId.length > 0,
  };

  // Check 1
  const token = await signTokenFor(user.id);
  const otherUser = db
    .select()
    .from(users)
    .where(ne(users.id, user.id))
    .limit(1)
    .get()!;
  const [ownFeed, noToken, crossUser] = await Promise.all([
    fetchFeed(String(user.id), token),
    fetchFeed(String(user.id), undefined),
    fetchFeed(String(otherUser.id), token),
  ]);

  // Check 2 setup: a real Discussion Question someone else asked.
  const question = db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: users.id,
      authorName: users.name,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .where(
      and(
        isNull(comments.parentId),
        isNull(comments.deletedAt),
        ne(comments.userId, user.id)
      )
    )
    .limit(1)
    .get();

  // Check 4: the user's stored preference set (environment default merges under it).
  const prefs = await safe(() =>
    serverClient().users.getPreferences(String(user.id), "default")
  );

  return {
    user: { id: user.id, name: user.name, role: user.role },
    envCheck,
    token: { raw: token, decoded: decodeJwt(token) },
    ownFeed,
    controls: {
      noToken: { status: noToken.status, body: noToken.body },
      crossUser: {
        askedFor: `${otherUser.id} (${otherUser.name})`,
        status: crossUser.status,
        body: crossUser.body,
      },
    },
    question,
    prefs,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const knock = serverClient();

  if (intent === "trigger-reply") {
    // Check 2: Discussion Reply → question author. Actor = current user.
    const questionId = Number(form.get("questionId"));
    const q = db
      .select({
        id: comments.id,
        body: comments.body,
        lessonId: comments.lessonId,
        lessonTitle: lessons.title,
        author: users,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .innerJoin(lessons, eq(lessons.id, comments.lessonId))
      .where(eq(comments.id, questionId))
      .get()!;
    const result = await safe(() =>
      knock.workflows.trigger(WORKFLOWS.discussionReply, {
        recipients: [toKnockRecipient(q.author)],
        actor: toKnockRecipient(user),
        data: {
          question_id: q.id,
          question_excerpt: q.body.slice(0, 80),
          lesson_id: q.lessonId,
          lesson_title: q.lessonTitle,
          reply_excerpt: "PROTOTYPE reply from the Knock spike",
        },
      })
    );
    return { intent, sentTo: `${q.author.id} (${q.author.name})`, result };
  }

  if (intent === "trigger-enrollment") {
    // Check 4: new Enrollment → Instructor (current user), actor = a student.
    const student = db
      .select()
      .from(users)
      .where(and(eq(users.role, UserRole.Student), ne(users.id, user.id)))
      .limit(1)
      .get()!;
    const result = await safe(() =>
      knock.workflows.trigger(WORKFLOWS.newEnrollment, {
        recipients: [toKnockRecipient(user)],
        actor: toKnockRecipient(student),
        data: { course_title: "PROTOTYPE course" },
      })
    );
    return { intent, result };
  }

  if (intent === "pref-in" || intent === "pref-out") {
    const on = intent === "pref-in";
    const result = await safe(() =>
      knock.users.setPreferences(String(user.id), "default", {
        __persistence_strategy__: "merge",
        categories: {
          [CATEGORY_NEW_ENROLLMENT]: { channel_types: { in_app_feed: on } },
        },
      })
    );
    return { intent, result };
  }

  if (intent === "pref-reset") {
    const result = await safe(() =>
      knock.users.unsetPreferences(String(user.id), "default")
    );
    return { intent, result };
  }

  if (intent.startsWith("mark-")) {
    // Check 3: client-side status updates with the user token.
    const status = intent.slice(5) as "read" | "seen" | "unread" | "unseen";
    const ids = form.getAll("messageId").map(String);
    const token = await signTokenFor(user.id);
    const result = await batchStatus(status, ids, token);
    return { intent, ids, result };
  }

  return { intent, error: "unknown intent" };
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Verdict({ pass, label }: { pass: boolean; label: string }) {
  return (
    <p className={pass ? "text-green-700" : "text-red-700"}>
      {pass ? "PASS" : "FAIL"} · {label}
    </p>
  );
}

type FeedEntry = {
  id: string;
  read_at: string | null;
  seen_at: string | null;
  inserted_at: string;
  source?: { key?: string };
  blocks?: { rendered?: string }[];
};
type FeedBody = {
  entries?: FeedEntry[];
  meta?: { unread_count: number; unseen_count: number; total_count: number };
};

export default function KnockPrototype() {
  const d = useLoaderData<typeof loader>();
  const last = useActionData<typeof action>();
  const feed = d.ownFeed.body as FeedBody;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="rounded border-2 border-dashed border-amber-500 p-3 text-sm">
        PROTOTYPE · Knock spike (issue #22). Throwaway, never merge.
      </div>
      <h1 className="text-2xl font-bold">
        Knock spike as {d.user.name} (#{d.user.id}, {d.user.role})
      </h1>

      <section>
        <h2 className="font-semibold">Env</h2>
        <Json value={d.envCheck} />
      </section>

      {last && (
        <section>
          <h2 className="font-semibold">Last action result</h2>
          <Json value={last} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Signed user tokens</h2>
        <Verdict
          pass={d.ownFeed.status === 200}
          label={`own feed with signed token → ${d.ownFeed.status}`}
        />
        <Verdict
          pass={d.controls.noToken.status >= 400}
          label={`own feed WITHOUT token → ${d.controls.noToken.status} (expect 4xx)`}
        />
        <Verdict
          pass={d.controls.crossUser.status >= 400}
          label={`user ${d.controls.crossUser.askedFor}'s feed with MY token → ${d.controls.crossUser.status} (expect 4xx)`}
        />
        <details>
          <summary>Token (decoded)</summary>
          <Json value={d.token.decoded} />
        </details>
        <details>
          <summary>Control responses</summary>
          <Json value={d.controls} />
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Trigger a Discussion Reply</h2>
        {d.question ? (
          <Form method="post">
            <input type="hidden" name="intent" value="trigger-reply" />
            <input type="hidden" name="questionId" value={d.question.id} />
            <p className="text-sm">
              Reply (as {d.user.name}) to question #{d.question.id} by{" "}
              <b>
                {d.question.authorName} (#{d.question.authorId})
              </b>{" "}
              on “{d.question.lessonTitle}”. Then switch to that user in the
              DevUI and look at section 3.
            </p>
            <button className="rounded bg-primary px-3 py-1 text-primary-foreground">
              Trigger discussion-reply
            </button>
          </Form>
        ) : (
          <p>No question by another user found.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Headless feed</h2>
        <p>
          unread_count: <b>{feed.meta?.unread_count ?? "?"}</b> · unseen_count:{" "}
          <b>{feed.meta?.unseen_count ?? "?"}</b> · total:{" "}
          {feed.meta?.total_count ?? "?"}
        </p>
        <ul className="space-y-2">
          {(feed.entries ?? []).map((e) => (
            <li key={e.id} className="rounded border p-2 text-sm">
              <div>
                <b>{e.source?.key}</b> · {e.inserted_at} · read:{" "}
                {e.read_at ? "yes" : "no"} · seen: {e.seen_at ? "yes" : "no"}
              </div>
              <div
                dangerouslySetInnerHTML={{
                  __html: e.blocks?.[0]?.rendered ?? "",
                }}
              />
              <div className="mt-1 flex gap-2">
                {(["read", "seen", "unread", "unseen"] as const).map((s) => (
                  <Form method="post" key={s}>
                    <input type="hidden" name="intent" value={`mark-${s}`} />
                    <input type="hidden" name="messageId" value={e.id} />
                    <button className="rounded border px-2 text-xs">
                      mark {s}
                    </button>
                  </Form>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <details>
          <summary>Raw feed response</summary>
          <Json value={d.ownFeed.body} />
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          4. Preferences: new Enrollment off by default, opt-in
        </h2>
        <p className="text-sm">
          Steps: reset → trigger (expect nothing new in feed) → opt in →
          trigger (expect a new-enrollment item) → opt out → trigger (nothing).
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            ["pref-reset", "Reset my preferences"],
            ["trigger-enrollment", "Trigger new-enrollment to me"],
            ["pref-in", "Opt in (in-app feed)"],
            ["pref-out", "Opt out"],
          ].map(([intent, label]) => (
            <Form method="post" key={intent}>
              <input type="hidden" name="intent" value={intent} />
              <button className="rounded border px-3 py-1">{label}</button>
            </Form>
          ))}
        </div>
        <Json value={d.prefs} />
      </section>
    </div>
  );
}
