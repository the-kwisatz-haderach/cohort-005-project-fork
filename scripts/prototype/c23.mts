import { serverClient, signTokenFor, fetchFeed, batchStatus, WORKFLOWS } from "../../app/lib/knock.prototype.server.ts";
const k = serverClient(); const author = "5"; // Emma Wilson asked question #1
const tok = await signTokenFor(5);
const tag = `DIAG reply ${Date.now()}`;
const run = await k.workflows.trigger(WORKFLOWS.discussionReply, { recipients: [{ id: author, name: "Emma Wilson", email: "emma@example.com" }], actor: { id: "8", name: "Liam Thompson" }, data: { question_id: 1, lesson_title: "Lesson", reply_excerpt: tag } });
console.log("run", run.workflow_run_id);
await new Promise(r => setTimeout(r, 7000));
const f1 = (await fetchFeed(author, tok)).body as any;
const hit = f1.entries.find((e: any) => e.data?.reply_excerpt === tag);
console.log("check2 delivered to author:", !!hit, hit && JSON.stringify(hit.source.categories), "| rendered:", hit?.blocks?.[0]?.rendered);
const actorFeed = (await fetchFeed("8", await signTokenFor(8))).body as any;
console.log("not in actor's feed:", !actorFeed.entries.some((e: any) => e.data?.reply_excerpt === tag));
console.log("meta before:", JSON.stringify(f1.meta), "item read/seen:", hit.read_at, hit.seen_at);
for (const s of ["seen", "read"] as const) { const r = await batchStatus(s, [hit.id], tok); console.log(`mark ${s}:`, r.status); }
const f2 = (await fetchFeed(author, tok)).body as any;
const h2 = f2.entries.find((e: any) => e.id === hit.id);
console.log("meta after:", JSON.stringify(f2.meta), "item read/seen:", !!h2.read_at, !!h2.seen_at);
const cross = await batchStatus("unread", [hit.id], await signTokenFor(8));
console.log("other user marking it unread:", cross.status, JSON.stringify(cross.body).slice(0,150));
