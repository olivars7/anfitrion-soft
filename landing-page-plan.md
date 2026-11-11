# Landing Page Plan — `/landing`

## Top-Level Overview

Create a new public-facing landing page at `/landing` that serves as the **default entry point** for guests (the current root `/` redirect will change from `/home` to `/landing`). The page shows the info of whichever event currently has `status = 'active'` in the database — without revealing venue or technical data. It has a party-invite vibe, lets guests look up their own ticket by entering their registration `public_id`, and displays that single ticket (rotated 90° on portrait screens). A small admin login button sits in the corner.

**Non-goals:** No venue display, no capacity/slug/technical fields shown on landing. No modifications to the existing `/home`, `/login`, or ticket generation logic.

---

## Sub-Tasks

---

### Sub-Task 1 — Change the default route from `/home` to `/landing`

**Intent:** Make `/landing` the app's root so guests land there by default, not the admin `/home`.

**Expected Outcomes:**
- Visiting `/` redirects to `/landing`
- The existing `/home` is still fully reachable (no breakage)

**Todo List:**
1. Edit [`src/app/page.tsx`](src/app/page.tsx) — change `redirect('/home')` to `redirect('/landing')`

**Relevant Context:**
- [`src/app/page.tsx`](src/app/page.tsx) — currently just `redirect('/home')`

**Status:** `[ ] pending`

---

### Sub-Task 2 — Create the `/landing` route file

**Intent:** Scaffold the Next.js App Router page at `src/app/landing/page.tsx`. This is the main deliverable.

**Expected Outcomes:**
- Route `/landing` resolves and renders without auth guard
- Page is `'use client'` (needs state for the ticket lookup form)
- No `(home)` layout wrapping (no auth check applied)

**Todo List:**
1. Create `src/app/landing/page.tsx` with the full landing page component (see design spec below)

**Relevant Context:**
- No existing `/landing` route — this is a new file
- The `(home)` layout at [`src/app/(home)/layout.tsx`](src/app/(home)/layout.tsx) applies an auth check; `/landing` must live **outside** that route group
- [`src/lib/supabase.ts`](src/lib/supabase.ts) — import `supabase` for the event query
- [`src/lib/database.types.ts`](src/lib/database.types.ts) — `events` Row type (fields: `id`, `name`, `starts_at`, `cover_price`, `status`)
- [`src/components/TicketVisual.tsx`](src/components/TicketVisual.tsx) — reuse for ticket display; props: `serial`, `guestName`, `kicker`, `subline`, `dateLabel`, `tierName`, `qrValue`, `accentColor`
- Google Fonts already loaded: **Bebas Neue**, Staatliches, Nanum Pen Script — use these for the party headline

**Status:** `[ ] pending`

---

#### Design Spec for the Landing Page Component

**Layout (top → bottom):**

```
┌─────────────────────────────────────────────────────┐
│  [Admin →]                               top-right  │
│                                                      │
│  (party background / animated elements)             │
│                                                      │
│  ✦ EVENT NAME  (huge, Bebas Neue or Staatliches)   │
│  DATE — TIME                                         │
│  PRECIO DE ENTRADA / COVER                           │
│  [other fun details, NOT venue or technical info]   │
│                                                      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  "¿Ya tienes tu boleto? Ingresa tu ID"              │
│  [ input: DA-XXXX ]  [ Ver mi boleto ]              │
│                                                      │
│  (ticket appears here after lookup)                 │
│  (portrait rotation wrapper if screen is vertical)  │
│                                                      │
│  ⚠ WARNING TEXT (no compartir el boleto)            │
└─────────────────────────────────────────────────────┘
```

**Party vibe styling:**
- Dark background (`#000` or near-black) with vivid color accents derived from the event (use event's `cover_price` or a fixed accent; no accent_color field in DB — default to `#ff2d55` hot-pink/party red or `#e52239`)
- Big glowy headline using `font-family: 'Bebas Neue'` (already in globals.css as `--font-bebas`)
- Use existing `home-bg` + `particles-layer` / `.sq-particle-*` classes for the animated grid background (already in `globals.css`) — or a simpler version with colored accents instead of grey
- Confetti/sparkle emojis ✦ 🎉 or CSS decorations to reinforce party feel — keep it CSS-only, no extra libraries
- The admin button: small, subtle, top-right corner — text like "Admin →" or a key icon, links to `/login`

**Event info shown (only these fields from `events` table):**
- `name` — shown large
- `starts_at` — formatted as weekday + date + time (Spanish locale)
- `cover_price` — shown as "Cover: $X" or "Entrada libre" if 0
- Do NOT show: `venue`, `slug`, `capacity`, `organizer_id`

**If no active event:** Show a simple "No hay eventos próximos por ahora. ¡Vuelve pronto! 🎉" message.

**Ticket lookup flow:**
1. User types their `public_id` (format `DA-XXXX`) into an input
2. On submit: query `registrations` table → filter by `public_id` and `event_id` of the active event
3. Then query `tickets` table → filter by `registration_id` from result
4. Build `TicketVisual` props from registration + ticket data:
   - `serial` = `registration.public_id`
   - `guestName` = `registration.guest_name`
   - `kicker` = `event.name`
   - `dateLabel` = formatted `event.starts_at`
   - `tierName` = `ticket.ticket_type`
   - `qrValue` = `ticket.qr_token`
   - `subline` = formatted price (from a `payments` query or skip — pass nothing if unavailable)
5. Show TicketVisual wrapped in a rotation container

**Portrait rotation behavior:**
- Detect orientation via a CSS `@media (orientation: portrait)` rule or a `window` resize listener
- Wrap the `<TicketVisual>` in a `div` that applies `transform: rotate(90deg)` when portrait
- Adjust wrapper dimensions so rotated ticket fits without overflow (use `width: 100vh; transform-origin: center`)
- This should be done with a CSS class + JS state (`isPortrait`) toggled on mount and on resize

**Warning text (below ticket):**
- Casual, direct tone — something like:
  > "Oye, no andes compartiendo tu boleto. Si alguien más lo usa antes que tú, el sistema lo detecta automáticamente en la entrada y nos va a tocar negarte el acceso a ti. Ahórrate el drama y guárdalo solo pa' ti."
- Shown only after a ticket is found

**Error states:**
- ID not found: "No encontramos ningún boleto con ese ID. Verifica que lo escribiste bien (ejemplo: DA-A3K9)."
- No active event: "No hay evento activo en este momento."

---

### Sub-Task 3 — Add CSS for landing-specific styles

**Intent:** Add any new CSS needed (portrait rotation, landing accent colors, etc.) to `globals.css` without touching existing rules.

**Expected Outcomes:**
- `.ticket-rotate-portrait` class exists and rotates the ticket wrapper when applied
- Any landing-specific animations or accent overrides are defined

**Todo List:**
1. Append to [`src/app/globals.css`](src/app/globals.css):
   - `.landing-accent-glow` — a radial glow overlay with hot-pink/party color
   - `.ticket-portrait-wrapper` — fixed-size container for the rotated ticket
   - No changes to existing rules

**Relevant Context:**
- [`src/app/globals.css`](src/app/globals.css) — append only, do not modify existing rules
- Existing animations (`float-up`, `float-side`, `float-diag`, `sq-particle-*`) can be reused on landing

**Status:** `[ ] pending`

---

## Implementation Notes

- **No new dependencies** — everything uses existing: Supabase, Tailwind, Lucide, `TicketVisual`, existing fonts
- **Ticket lookup is read-only** — only SELECT queries, no writes
- **No auth required** on `/landing` — it is fully public
- **`supabase` client** (typed, read-only) should be used for queries, not `db`
- **Ticket join query:** `registrations` → filter `public_id` + `event_id`, then `tickets` → filter `registration_id`. Two separate queries or a Supabase join.
- The `subline` (price paid) can be fetched from `payments` table filtered by `registration_id` with `status = 'approved'` — if none found, omit it gracefully
- The landing page needs **no** `EventContext` or `AuthContext` — it queries Supabase directly

## File Map

| Action | File |
|--------|------|
| Modify | `src/app/page.tsx` |
| Create | `src/app/landing/page.tsx` |
| Modify (append) | `src/app/globals.css` |
