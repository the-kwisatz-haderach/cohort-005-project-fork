import { serverClient, signTokenFor, fetchFeed, WORKFLOWS } from "../../app/lib/knock.prototype.server.ts";
const k = serverClient(); const uid = "2";
const tok = await signTokenFor(2);
async function step(label: string) {
  const tag = `DIAG ${label} ${Date.now()}`;
  await k.workflows.trigger(WORKFLOWS.newEnrollment, { recipients: [{ id: uid, name: "Sarah Chen" }], actor: { id: "8", name: "Liam Thompson" }, data: { course_title: tag } });
  await new Promise(r => setTimeout(r, 7000));
  const entries = ((await fetchFeed(uid, tok)).body as any).entries ?? [];
  const hit = entries.find((e: any) => e.data?.course_title === tag);
  console.log(`${label}: ${hit ? "DELIVERED" : "not delivered"}`, hit ? JSON.stringify(hit.source.categories) : "");
}
await k.users.unsetPreferences(uid, "default").catch(e => console.log("unset err", e.status));
console.log("prefs after reset:", JSON.stringify(await k.users.getPreferences(uid, "default").catch(e => ({ err: e.status }))));
await step("reset (expect not delivered)");
await k.users.setPreferences(uid, "default", { __persistence_strategy__: "merge", categories: { "new-enrollment": { channel_types: { in_app_feed: true } } } });
await step("opt-in (expect delivered)");
await k.users.setPreferences(uid, "default", { __persistence_strategy__: "merge", categories: { "new-enrollment": { channel_types: { in_app_feed: false } } } });
await step("opt-out (expect not delivered)");
