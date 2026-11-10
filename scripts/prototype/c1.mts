import { signTokenFor, fetchFeed, decodeJwt, env } from "../../app/lib/knock.prototype.server.ts";
const t = await signTokenFor(5);
console.log("token", decodeJwt(t));
console.log("chan set", !!env().feedChannelId);
for (const [label, id, tok] of [["own+token","5",t],["own no token","5",undefined],["cross user","6",t]] as const) {
  const r = await fetchFeed(id, tok);
  console.log(label, r.status, JSON.stringify(r.body).slice(0, 200));
}
