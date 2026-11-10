# Choosing the Notification provider

Research for the ticket "Choose the Notification provider" under the map "Wayfinder: In-app Notifications". Sources are official vendor pricing pages and docs, read on 2026-11-10. Pricing changes often, so check again before signing up.

## Recommendation

**Novu (Cloud, EU region)** is the recommendation. **Knock** is the runner-up.

Novu is the only candidate that meets every criterion, including the EU nice-to-have, on its **free** plan:

- live React Inbox plus headless hooks
- email and push through the same workflows
- a Node trigger SDK
- per-user HMAC feed auth
- 10,000 workflow runs a month free, then $30/month
- US and EU data residency

Knock has the more polished feed SDK and a stronger auth token (an RS256 JWT that expires). However, it has **no EU region yet** ("coming soon", expected end of 2026), and its first paid tier jumps to **$250/month**.

## Comparison

| Criterion | Novu | Knock | Courier | MagicBell | SuprSend |
| --- | --- | --- | --- | --- | --- |
| Live in-app feed, React | `@novu/react` `<Inbox />` plus hooks (`useNotifications`, `useCounts`, `useNovu`); updates over WebSocket [N2][N3] | `@knocklabs/react` feed components plus hooks (`useNotifications`, `useNotificationStore`); socket connection [K3][K4] | `@trycourier/courier-react` `<CourierInbox />`, `useCourier()`; realtime only after `listenForUpdates()` [C3] | `@magicbell/react` Inbox/FloatingInbox; WebSockets [M3] | `@suprsend/react` drop-in Inbox or headless [S2] |
| Email + push later | Yes: email, SMS, push, chat, in-app [N6] | Yes: email (SendGrid, Postmark), push (APNs, FCM), SMS, chat [K6] | Yes [C1] | Yes: email, web push, APNs, FCM, Expo [M2] | Yes (multi-channel product) [S1] |
| Node server trigger | `@novu/api` `novu.trigger({ workflowId, to, payload })` [N4] | `workflows.trigger` with inline recipients, actor, tenant, `cancellation_key` [K5] | Node SDK; `COURIER_BASE_URL` selects region [C2] | Node client [M2] | Server SDKs [S1] |
| Per-user feed auth | `subscriberHash = HMAC-SHA256(secretKey, subscriberId)`; Inbox won't load without it once enabled [N1] | "Enhanced security mode": RS256 JWT with `sub`, signed by `signUserToken` in `@knocklabs/node`, default lifetime 3600 s, `onUserTokenExpiring` refresh hook [K2] | Backend mints a scoped JWT (`user_id:<id> inbox:read:messages ...`); the SDK doesn't refresh it [C4] | HS256 JWT signed with the project secret; claims `user_external_id` and/or `user_email` [M4] | ES256 JWT (`entity_type: subscriber`, `entity_id`, `exp`), refresh callback [S3] |
| Free tier | 10k workflow runs/month, unlimited subscribers; Pro from $30 (30k+ runs, $1.20 per extra 1k) [N5] | 10k messages/month; Starter $250/month (50k) [K1] | 10k sends/month; Business $0.005/send [C1] | **1k** deliveries/month; Startup $249 [M1] | 10k/month **with SuprSend branding in the feed**; Essentials $100 [S1] |
| EU data residency | **Yes, on Free** ("US + EU data residency"); `eu.api.novu.co`, `wss://eu.socket.novu.co` [N5][N1] | **Not yet**: "We expect to support EU data residency by the end of 2026" [K7] | Yes, but **paid plans only** (Business/Enterprise), Ireland [C2] | Not mentioned in docs or pricing [M1] | Enterprise "custom data center region" only [S1] |

### Why the others drop out

- **Courier** fits well technically, but EU residency needs the paid Business plan. Realtime must also be wired explicitly, and JWT refresh is left to the app.
- **MagicBell**: the free tier is 10x smaller (1k deliveries), there is no documented EU region, and its doc examples sign year-long HS256 tokens.
- **SuprSend**: the free tier puts SuprSend branding in the feed, and EU residency is Enterprise-only.

## Is Novu's prebuilt `<Inbox />` customisable enough?

**Yes. Start with the prebuilt component; there's no need to build on hooks for v1.**

- The `appearance` prop takes `baseTheme`, about 14 `variables` (colours, font size, radius), per-`elements` overrides, `icons` and `animations`. Elements accept style objects **or class names, including Tailwind classes**. Many keys accept callbacks that receive runtime context, such as the unread count or notification data [N7]. Cadence uses Tailwind and shadcn (`components.json`), so the Inbox can be styled to match without forking it.
- The Inbox is composable (`Bell`, `Notifications`, `InboxContent`, `Preferences` sub-components) [N2]. The Preferences UI should be left out, because v1 has no preferences.
- If the prototype needs a layout the component can't produce, the same package ships headless hooks: `useNotifications` returns `notifications`, `isLoading`, `hasMore` and `fetchMore`; `useCounts` gives realtime unread/unseen counts; and `useNovu` handles mark-read and archive. Events (`notifications.notification_received`, `notifications.unread_count_changed`) are available for toasts [N3]. Moving from the component to the hooks needs no backend change.

For comparison, Knock's prebuilt feed is themed with `--rnf-` CSS variables and `rnf-` classes, plus `renderItem` [K3]. It's equally workable, but it doesn't take Tailwind classes directly.

## Facts that shape integration and the UI prototype

- **Feed auth (Novu):** compute `subscriberHash` server-side, for example in the root loader, from the current user's ID. Pass `applicationIdentifier`, `subscriberId` and `subscriberHash` to `<Inbox />`. The hash is a static HMAC and **does not expire**, unlike Knock's JWT. If a hash leaks, it stays valid until the secret key is rotated. Turn on the "Security HMAC encryption" toggle on the Novu In-App integration for production [N1].
- **Subscriber mapping:** `subscriberId` is our ID (the Cadence user ID). Triggering with `to: { subscriberId }` creates subscribers on demand [N4]. This fits DevUI user switching: re-render the Inbox with the new user's ID and hash.
- **Realtime:** WebSocket from the browser straight to Novu (`wss://eu.socket.novu.co` in the EU). Nothing runs on our server, so the app needs no SSE or socket code [N1][N3].
- **EU config:** set the frontend `apiUrl`/`socketUrl` props and the backend `serverURL: "https://eu.api.novu.co"` [N1][N4]. The account must be created in the EU region.
- **Environments and tests:** Development and Production environments come with separate secret keys. Workflows are authored in Development and published to Production [N8]. None of the docs read describe a "don't deliver" sandbox for in-app; Knock's sandbox mode explicitly excludes in-app [K8]. **Tests should not hit the provider:** put triggers behind a small module seam that tests replace or record.
- **Billing unit:** Novu counts workflow runs [N5]. Knock counts one message per user per channel [K7].

## Open questions for the "Integration shape" work

- Whether the non-expiring HMAC is acceptable, or the extra effort of Knock's expiring JWT is worth it.
- Novu's self-hosted option is listed as Enterprise on the pricing page [N5]. It isn't needed, but it is an exit path.

## Sources

- [N1] Novu, Prepare for production (HMAC, EU URLs): https://docs.novu.co/platform/inbox/prepare-for-production
- [N2] Novu, Inbox overview: https://docs.novu.co/platform/inbox/overview
- [N3] Novu, Headless mode / hooks: https://docs.novu.co/platform/inbox/headless-mode
- [N4] Novu, TypeScript server SDK: https://docs.novu.co/platform/sdks/server/typescript
- [N5] Novu, Pricing: https://novu.co/pricing
- [N6] Novu, Integrations overview: https://docs.novu.co/platform/integrations/overview
- [N7] Novu, Inbox styling: https://docs.novu.co/platform/inbox/configuration/styling
- [N8] Novu, Environments: https://docs.novu.co/platform/concepts/environments
- [K1] Knock, Pricing: https://knock.app/pricing
- [K2] Knock, Security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [K3] Knock, React feed: https://docs.knock.app/in-app-ui/react/feed
- [K4] Knock, Headless feed: https://docs.knock.app/in-app-ui/react/headless/feed
- [K5] Knock, Triggering workflows via API: https://docs.knock.app/send-notifications/triggering-workflows/api
- [K6] Knock, Integrations overview: https://docs.knock.app/integrations/overview
- [K7] Knock, Plans and usage (EU residency, message counting): https://docs.knock.app/manage-your-account/knock-plans
- [K8] Knock, Testing workflows / sandbox: https://docs.knock.app/send-notifications/testing-workflows
- [C1] Courier, Pricing: https://www.courier.com/pricing
- [C2] Courier, EU datacenter: https://www.courier.com/docs/platform/workspaces/eu-datacenter
- [C3] Courier, React SDK: https://www.courier.com/docs/platform/inbox/web/react-sdk
- [C4] Courier, Inbox JWT authentication: https://courier.com/docs/platform/inbox/authentication
- [M1] MagicBell, Pricing: https://www.magicbell.com/pricing
- [M2] MagicBell, Docs index: https://www.magicbell.com/docs
- [M3] MagicBell, Inbox product page: https://www.magicbell.com/inbox
- [M4] MagicBell, User JWT auth: https://www.magicbell.com/docs/api/authentication/user
- [S1] SuprSend, Pricing: https://www.suprsend.com/pricing
- [S2] SuprSend, React inbox: https://docs.suprsend.com/docs/inbox-react
- [S3] SuprSend, Client authentication: https://docs.suprsend.com/docs/client-authentication
