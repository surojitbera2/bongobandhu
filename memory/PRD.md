# Bongo Bandhu — Product Requirements

## Problem statement
Mobile-first PWA where users browse online providers and start 1-on-1 WebRTC video calls billed by **fixed-time packages** (e.g. 5min ₹250, 10min ₹400, 15min ₹500). Wallet pre-pay model. Providers toggle online/offline, accept calls, see earnings. Admin manages users/providers/packages/payments/reports.

## Architecture (as built)
- **Frontend:** React 19 PWA — Tailwind, shadcn/ui, lucide-react, sonner. Hosted at `https://vc.bongobandhu.in`.
- **Backend (production):** Node.js + Express + Socket.io + MongoDB Atlas deployed at `https://vc.bongobandhu.in`. Source in `/app/node-backend/server.js`.
- **Signaling (local dev only):** FastAPI WebSocket at `/api/ws/signal?id=<peerId>` in `/app/backend/server.py`. Production uses Socket.io on Node.

## Billing model (July 2025 — fixed-time packages)
- Admin configures **packages globally** in Admin → Payments: array of `{minutes, price}` (default `[{5,250},{10,400},{15,500}]`).
- On call end the server recomputes amount: smallest `pkg.minutes >= durationSec/60` wins. ≤5min → ₹250, ≤10min → ₹400, ≤15min → ₹500. Calls under 10s grace = no charge.
- Caller side **auto-ends at the max package duration** (15 min default).
- Pre-call check: blocks if `user.wallet < cheapest package price`.
- Provider revenue share is a global % (default 60%) applied to billed amount minus bonus used.
- Per-provider per-minute `rate` field is **deprecated** (kept in schema with default 0 for back-compat; no UI exposes it).

## Backend endpoints (post-July 2025)
- `GET /api/billing/public` → `{ providerSharePct, packages: [{minutes, price}, ...] }`
- `GET/PUT /api/admin/billing` → same shape, admin-only
- `POST /api/call/log` (auth user) — body `{ providerId, durationSec, autoCutoff }`. Server computes `amount` server-side from packages; debits wallet, credits provider's earnings.

## Test credentials
- User: `9999999999` / `demo123`
- Provider: `8000000001` / `pro123`
- Admin: `admindash` / `Admin#2026*`

## Architecture decisions
- Server is the **source of truth for amount** — caller no longer sends `amount` in `/api/call/log`. Prevents tampering.
- Stale-closure protection in `CallScreen.jsx` via refs (provider/user/seconds/ended) to prevent stale state.
- `signaling.js` singleton WS client with auto-reconnect + outbox.
- Server `_outbox_push/_outbox_drain` buffers undeliverable frames per peer.

## Prioritized backlog
- **P1** TURN server for production WebRTC across carrier-grade NAT.
- **P1** Real OTP (MSG91 / Twilio).
- **P1** Razorpay live keys (currently test).
- **P2** Push notifications for incoming calls.
- **P2** Provider ratings + reviews.
