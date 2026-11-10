// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?" (issue #22).
// Not production code. Lives on a prototype branch only; never merge.

import Knock, { signUserToken } from "@knocklabs/node";

try {
  process.loadEnvFile(".env");
} catch {
  // .env missing — the env check on the page will say so.
}

const API = "https://api.knock.app/v1";

export const WORKFLOWS = {
  discussionReply: "discussion-reply",
  newEnrollment: "new-enrollment",
} as const;

export const CATEGORY_NEW_ENROLLMENT = "new-enrollment";

export function env() {
  return {
    secret: process.env.KNOCK_SECRET_API_KEY ?? "",
    publicKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
    signingKey: process.env.KNOCK_SIGNING_KEY ?? "",
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
  };
}

export function serverClient() {
  return new Knock({ apiKey: env().secret });
}

export type Recipient = { id: number; name: string; email: string };

export function toKnockRecipient(u: Recipient) {
  return { id: String(u.id), name: u.name, email: u.email };
}

// Check 1: our server signs an RS256 user token for the DevUI user.
export async function signTokenFor(userId: number) {
  return signUserToken(String(userId), {
    signingKey: env().signingKey,
    expiresInSeconds: 60 * 60,
  });
}

export function decodeJwt(token: string) {
  const [h, p] = token.split(".");
  const dec = (s: string) =>
    JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  return { header: dec(h), payload: dec(p) };
}

// Client-side style calls: public key + user token, exactly what a browser
// would hold. Deliberately NOT the secret-key SDK, which bypasses enhanced
// security and would prove nothing about per-user auth.
type ClientCall = { status: number; body: unknown };

async function clientFetch(
  path: string,
  init: { method?: string; userToken?: string; body?: unknown } = {}
): Promise<ClientCall> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env().publicKey}`,
    "Content-Type": "application/json",
  };
  if (init.userToken) headers["X-Knock-User-Token"] = init.userToken;
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return { status: res.status, body };
}

export function fetchFeed(userId: string, userToken: string | undefined) {
  return clientFetch(
    `/users/${encodeURIComponent(userId)}/feeds/${env().feedChannelId}?page_size=20`,
    { userToken }
  );
}

export function batchStatus(
  status: "read" | "seen" | "unread" | "unseen",
  messageIds: string[],
  userToken: string
) {
  return clientFetch(`/messages/batch/${status}`, {
    method: "POST",
    userToken,
    body: { message_ids: messageIds },
  });
}
