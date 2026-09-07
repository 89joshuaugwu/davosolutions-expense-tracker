# Working on Davo Expenses

This is a standalone internal financial app. The current scope is `Davo_Solutions_Expenses_Profit_Tracker_Scope.md` v1.2. Read `README.md` and `todo.md` first. Continue the earliest incomplete vertical slice; do not rebuild the foundation or repeatedly re-analyze the whole repository.

## Boundaries

- Work in `expense-tracker/`. Preserve the sibling Ads Manager and unrelated user changes. Reuse branding only unless the user explicitly authorizes another use.
- Never print or commit `.env*` secrets or service-account contents. Environment diagnostics must print variable names/status only. The expense app has its own Firebase project; never merge credentials across projects. See `docs/environment.md`.
- `/preview` is public, fictional, and read-only. Its role selector is only a design control. No preview code may query Firebase or bypass real authentication. Never copy its figures into live dashboards.
- Do not claim CRUD, uploads, emails, live charts, or deployment work until they are implemented and verified. Current real module screens explicitly describe unfinished functionality.

## Architecture rules

- Use Next.js App Router, strict TypeScript, the installed Firebase SDKs, Recharts, and the existing CSS design tokens/components. Keep server components by default and small client components for interaction.
- `getSessionUser()` is the API/service entry point. `requireUser()` / `requireSuperAdmin()` are page guards. Every service independently authenticates and authorizes. A layout or hidden navigation item is not a data security boundary.
- Read the current active `users/{uid}` profile on each protected operation. Roles are `super_admin` and `secretary`, status is `active` or `deactivated`. Secretary submissions are final; type-specific view permission plus own/assigned visibility governs reads. Sensitive data must never enter unauthorized HTML, RSC props, JSON, exports, or attachments.
- Browser Firestore/Storage access is denied. Firebase Admin bypasses rules, so server permissions and filtered queries are mandatory. Never introduce direct browser `getFirestore()` reads to make a screen work.
- Money is safe integer minor units. Parse decimal strings with `src/domain/money.ts`, use a decimal-string FX snapshot, and preserve original/base currency, original/base amount, and rate date. No `parseFloat` financial calculations. The base currency locks after the first monetary record.
- Canonical `ledgerEntries` are the only aggregate input. One source creates one posting; do not sum specialized logs and mirrored expenses together. Opening funds are separate from revenue. Reuse `src/domain/postings.ts` and `calculateFinancialSummary`.
- Persist source + posting + append-only audit + idempotency receipt atomically. Check active authorization, expected revision, and rate/category/settings within transactional operations where needed. Use server-selected amounts/rates and timestamps; do not trust browser-derived values or ownership.
- Corrections/archives/recalculations require a meaningful reason, previous/new values, and an audit event. Use `appendAuditInTransaction()`. Audit schemas live in `src/lib/server/audit-model.ts`; domain DTOs reuse them.
- Date-only business events use validated `YYYY-MM-DD`; reporting funds use unique `YYYY-MM`. Company time is `Africa/Lagos`. No automatic fund carryover. Pending salary posting behavior is provisional and must be confirmed before the salary workflow.
- Cloudinary is the user-selected provider for images, PDFs and documents; Firebase remains for Auth/Firestore. Receipt access must be private and authorized by parent-record visibility. Server-only Cloudinary configuration is in `src/lib/cloudinary/`; `.env.local` contains the supplied credentials. The verified preset is currently unsigned: use signed server uploads with explicit authenticated delivery and complete E4 private-access checks before enabling receipts. Do not implement public unsigned receipt uploads or ask the user to select a provider again.

## Quality and handoff

- Preserve the visual language in `src/app/globals.css`: restrained Davo blue/navy, pale canvas, clean white panels, clear typography, generous spacing. Reuse the copied Davo mark in `public/brand/`.
- Every interactive control must work or clearly explain its unavailable state. Include labelled fields, keyboard focus, loading/error/empty states, and responsive table overflow. Charts need an accessible data alternative.
- Run `npm run check` and `npm run build` for substantive code changes. Run `npm run test:e2e` when changing protected navigation, preview interaction, or responsive shell behavior. Write tests for meaningful financial/security/retry failure modes, not decorative implementation details.
- Browser smoke tests run without real credentials, on port 3100, with a separate `.next-e2e` directory. Preserve any user's running development server. Edge is used by default; set `PLAYWRIGHT_CHANNEL=chromium` after installing Chromium for another environment.
- Emulator tests explicitly skip without emulators. A skip is not a pass. Live identity, deployed rules, Firestore transaction behavior, reminders, and storage all need separate integration evidence.
- Update `todo.md` task IDs, session log, verification ledger, and `docs/acceptance-matrix.md` after completing a slice. Keep the next recommended task explicit so another model can continue cheaply.

The user's instructions authorize ongoing reversible implementation. Do not invent extra approval gates. Provisioning a named account, changing DNS, deploying, and sending email must follow the actual task authorization and remain clearly documented.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
