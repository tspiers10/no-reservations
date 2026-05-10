# Getting Started — No Reservations

Welcome to the project! Follow these steps to get your local environment running.

## 1. Prerequisites

Make sure you have these installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)

## 2. Clone the repo

```bash
git clone https://github.com/tspiers10/no-reservations
cd no-reservations
```

## 3. Install dependencies

```bash
npm install
```

## 4. Set up environment variables

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in the values. **Ask Tomas for the actual keys** — they're never stored in GitHub for security reasons.

## 5. Run the app locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Day-to-day workflow

Always pull before you start working to get the latest changes:

```bash
git pull
```

When you're done with a session, commit and push:

```bash
git add .
git commit -m "Description of what you changed"
git push
```

Pushing to `main` automatically deploys to [no-reservations-vert.vercel.app](https://no-reservations-vert.vercel.app).

---

## Project structure

| Path | What it is |
|------|------------|
| `src/app/` | Next.js pages and API routes |
| `src/components/` | React components |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Supabase clients and utilities |
| `src/types/` | TypeScript types |
| `supabase/migrations/` | Database schema (never edit the DB directly) |
| `scripts/` | One-off data scripts |

## Key things to know

- **Database changes** always go through `supabase/migrations/` — never edit the Supabase DB directly
- **No secrets in Git** — `.env.local` is gitignored; never commit API keys
- **All writes go through `/api/` routes** — no direct DB writes from the browser
- See `CLAUDE.md` for full project context and coding conventions
