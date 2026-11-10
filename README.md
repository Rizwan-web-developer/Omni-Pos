# OmniPos Hub — Multi-Tenant Command Center

A **Next.js 14 App Router** frontend for the OmniPos Hub multi-tenant retail platform, with a default **Orange & White** brand theme plus **Light** and a true **near-black Dark** theme.

Design reference: Stitch project `11303360823724371364` — _"OmniPos Hub Enterprise Interface"_.

## Quick start

```bash
# Node 20+ required
npm install
npm run dev        # http://localhost:3000
```

If PowerShell blocks `npm.ps1` scripts, run `npm` via `npm.cmd` or use:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run dev
```

If you use the portable Node in this environment:

```powershell
$env:Path = "C:\Users\pc\AppData\Local\Temp\opencode\node\node-v20.18.0-win-x64;" + $env:Path
cd "D:\Rizwan Work\SAAS\omnipos-hub"
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (type + lint checked) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:studio` | Open Prisma Studio |

## Themes

- **Brand (default):** Orange & White (`omnipos-theme=brand`).
- **Light:** Neutral white/light surfaces.
- **Dark:** True near-black/neutral dark (no bluish cast).

Theme is applied before first paint via an inline script in `app/layout.tsx` and persisted in `localStorage["omnipos-theme"]` (`brand | light | dark`). The topbar provides a 3-way theme switcher.

Design tokens are RGB CSS variables in `app/globals.css` (Tailwind `<alpha-value>` compatible) and mapped in `tailwind.config.ts` (`background`, `surface`, `surface-2`, `line`, `foreground`, `muted`, `accent`, etc.).

## Routes

| Route | Screen |
| --- | --- |
| `/` | Redirects to dashboard |
| `/dashboard` | Command center / overview |
| `/tenants` | Multi-tenant manager |
| `/pos/mobile-accessories` | Mobile & IMEI POS terminal |
| `/pos/pharmacy` | Pharmacy POS terminal |

## Architecture (high level)

- **Framework:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide icons.
- **Providers:** `ThemeProvider` → `ToastProvider` → `TenantProvider` → `OverlayProvider` → `AppShell`.
- **State:** In-memory tenant/demo state via `TenantProvider`; mutually exclusive overlays via `OverlayProvider`.
- **Key UI:** `AppShell`/`Sidebar`/`Topbar`, `CommandPalette`, `TenantTable`, `TenantOnboardingModal`, `TenantDrawer`, `MobileAccessoriesPOS`, `PharmacyPOS`, `DialogShell`.
- **Database (local):** PostgreSQL + Prisma schema in `prisma/schema.prisma` (multi-tenant models; `Invoice` + `InvoiceItem`), Prisma client singleton in `lib/db.ts`, connection in `.env` (`DATABASE_URL`, gitignored).

## Database setup (PostgreSQL + Prisma)

1. Create a PostgreSQL database named `saas-app` (e.g., via pgAdmin 4).
2. Set `DATABASE_URL` in `.env`, for example:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/saas-app?schema=public"
   ```
   URL-encode special characters in the password (e.g. `$` → `%24`, `#` → `%23`).
3. Generate/push schema:
   ```bash
   npm run db:generate
   npm run db:push
   ```

## Notes

- Demo data is deterministic/in-memory for the UI; Prisma schema is prepared for backend persistence.
- `npm run typecheck` can occasionally report stale `.next/types` path issues; `npm run build` is the authoritative full check.
- `.next/` build artifacts and `.env` are local/generated/secret and should not be committed.

# Omni-Pos-Hub
