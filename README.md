# Strivo - Mobile-First Badminton Tournament & Elo Engine

Strivo includes a responsive arena layout, branded app icons, dark and light themes, accessible focus states, and short page/card animations that respect reduced-motion preferences. Regression tests cover best-of-three/five scoring, doubles statistics, and knockout advancement links.

A mobile-first web app and PWA for running badminton tournaments with chess-style Elo ratings. **Badminton ONLY** — built exclusively for badminton tournaments, categories, rules, and scoring without any multi-sport abstractions.

---

## 🚀 Features

- **PWA & Mobile-First**: Installable to home screen on iOS and Android with standalone display, zero horizontal scroll, and tap targets $\ge 44\text{px}$.
- **Direct Password Authentication**: Instant sign in and registration with username/email and password without waiting for OTP emails. Default password for seeded accounts is `password123`.
- **Onboarding & Cat Avatars**: 12 custom mascot cat avatars (`cat-01` to `cat-12`), username verification, and starting skill levels:
  - **Beginner**: 800 Elo
  - **Intermediate**: 1000 Elo
  - **Advanced**: 1200 Elo
- **Database-Enforced Phone Privacy**: Phone numbers are stored in a dedicated `player_contacts` table protected by PostgreSQL Row Level Security (RLS) and exposed via `profiles_view`. If `show_phone` is `false`, the number is **never** sent to any other user or guest.
- **Pure TypeScript Engines (Zero UI / DB dependencies)**:
  - **Elo Engine**: Single rating per player, doubles team rating = partner average, **identical partner deltas**, provisional $K=40$ ($<10$ matches) vs standard $K=24$, and single-set match multiplier ($0.75$). Includes full match replay recomputation.
  - **Knockout Bracket Generator**: Standard seeded bracket placement ($1$ vs last, $2$ vs second last, etc.) with automatic byes awarded to top seeds.
  - **Groups + Knockout**: Rating snake distribution ($A, B, C, C, B, A\dots$), round-robin group matches, tie-breaker standings, and top-2 cross-group qualification.
  - **Swiss-Style Pairing**: Matches players with similar win points and closest ratings, avoids rematches, and awards byes to the lowest-rated player who hasn't had a bye yet.
  - **Doubles Solo Auto-Pairing**: Automatically pairs solo players in balanced distribution (strongest with weakest, 2nd strongest with 2nd weakest). Supports gender validation for Boys/Girls doubles and Boy+Girl matching for Mixed Doubles.
- **Tournament Wizard with Match Rules**:
  - Sets: 1, Best of 3 (default), or Best of 5
  - Points per set: 11, 15, 21 (default), or custom
  - Win by 2 (deuce toggle, default ON)
  - Point cap: default 30 (sudden death)
  - Deciding set points override: e.g. 15 points in 3rd set
  - Rules snapshotted on each match at creation time so future tournament edits never alter completed matches.
- **Phone-Optimized Score Entry**: Large $+ / -$ tap targets with automatic match completion and immediate Elo rating calculation.
- **Role-Based Access Control & Audit Log**:
  - **Owner**: Full administrative control, tournament creation, player management, and manager delegation.
  - **Managers**: Delegated to specific tournaments at **Entries** (players/pairs only) or **Full** (Entries + draws & score entry).
  - **Audit Log**: Immutable audit trail of entries, draws, score updates, and access changes.

---

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Vanilla CSS utilities + Safe-area insets
- **Database & Auth**: Supabase (PostgreSQL, RLS, Auth OTP, Realtime)
- **Testing**: Vitest (pure unit tests)
- **Deployment**: Vercel

---

## 📋 Getting Started

### 1. Prerequisites

- Node.js 20+ (Node 24 tested)
- npm 10+
- A Supabase project (project credentials are pre-configured in `.env.local`)

### 2. Database Schema Migration

To apply the database schema and Row Level Security policies:

1. Open your **Supabase Dashboard** at [https://supabase.com/dashboard/project/hccdzyhbyhanbyrbjazn](https://supabase.com/dashboard/project/hccdzyhbyhanbyrbjazn).
2. Go to the **SQL Editor** tab on the left sidebar.
3. Open [`supabase/migrations/20260930_initial_schema.sql`](supabase/migrations/20260930_initial_schema.sql) in this repository.
4. Copy the entire SQL content and paste it into the Supabase SQL Editor.
5. Click **Run** to execute the migration.

This will create:
- `profiles` and `player_contacts` tables with RLS
- `profiles_view` (database-level phone privacy filter)
- `tournaments`, `tournament_managers`, `categories`, `entries`, `matches`, `rating_history`, and `audit_log`
- Realtime publication on `matches`, `tournaments`, and `rating_history`

---

## 📧 Custom SMTP Provider Setup (Resend / Brevo)

The built-in Supabase email sender is heavily rate-limited (max 3–4 emails/hour). For reliable OTP delivery in production and local testing, configure a custom SMTP provider:

### Option A: Resend (Recommended)

1. Sign up at [https://resend.com](https://resend.com) and create an API Key.
2. In the **Supabase Dashboard**, navigate to:
   **Project Settings** $\rightarrow$ **Authentication** $\rightarrow$ **SMTP Settings**.
3. Toggle **Enable Custom SMTP** to `ON`.
4. Enter the configuration:
   - **Sender Email**: `onboarding@resend.dev` (or your verified domain, e.g. `auth@yourdomain.com`)
   - **Sender Name**: `Strivo Badminton`
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **Username**: `resend`
   - **Password**: Your Resend API Key (`re_...`)
5. Click **Save Changes**.

### Option B: Brevo (formerly Sendinblue)

1. Sign up at [https://brevo.com](https://brevo.com) and go to **SMTP & API Keys**.
2. Enter the Supabase SMTP configuration:
   - **Sender Email**: Your verified sender email in Brevo
   - **Sender Name**: `Strivo Badminton`
   - **Host**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Username**: Your Brevo login email
   - **Password**: Your Brevo SMTP Master Key
3. Click **Save Changes**.

### OTP Email Template Setup

In Supabase Dashboard $\rightarrow$ **Authentication** $\rightarrow$ **Email Templates** $\rightarrow$ **Magic Link / Confirmation**:
Make sure the template includes the 6-digit token so players can enter the numeric code directly:
```html
<h2>Your Strivo Login Code</h2>
<p>Enter this 6-digit verification code to sign in:</p>
<h1 style="font-size: 32px; letter-spacing: 6px; font-family: monospace;">{{ .Token }}</h1>
<p>Alternatively, click the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in directly</a></p>
```

---

## 🌱 Database Seeding

The seed script creates the **Owner Account** with `is_admin = true`, **24 sample players** (12 boys, 12 girls across Beginner, Intermediate, and Advanced skill tiers), and an active **tournament with categories and entries**:

Run the seed script with your personal login email:
```bash
npm run seed -- --email=your-email@example.com
```

Or set `OWNER_EMAIL` in `.env.local` and run:
```bash
npm run seed
```

The owner uses passwordless login by default. To set a password during seeding, add `OWNER_PASSWORD` to your local `.env.local`. Keep that file out of Git.

---

## 🧪 Running Unit Tests

All rating calculations, draw generation algorithms, and privacy policies are pure TypeScript modules with unit tests:

```bash
npm run test
```

Test coverage includes:
- `tests/elo.test.ts`: Elo calculations, provisional $K=40$, doubles average ratings, **identical partner deltas**, single-set multiplier ($0.75$), and match replay recomputations.
- `tests/knockout.test.ts`: Standard tournament seed placements, power-of-2 sizing, and automatic bye allocation to top seeds.
- `tests/groups.test.ts`: Snake distribution ($A, B, C, C, B, A\dots$), round-robin matches, and top-2 qualification.
- `tests/swiss.test.ts`: Points-proximity pairing, rating sorting, rematch avoidance, and lowest-rated bye allocation.
- `tests/autopair.test.ts`: Balanced doubles pairing (strongest + weakest), mixed doubles matching, and leftover flagging.
- `tests/privacy.test.ts`: Database RLS logic verification that hidden phone numbers are never exposed to other players or guests.
- `tests/match_rules.test.ts`: 21-point deuce rules, 30-point sudden death cap, deciding set overrides, and match auto-completion.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your desktop or phone (or open Chrome DevTools and switch to Mobile Device View).

---

## 🚢 Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the following Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://hccdzyhbyhanbyrbjazn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `OWNER_EMAIL`: `your-email@example.com`
4. Click **Deploy**.
