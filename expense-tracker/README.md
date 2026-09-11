# Davo Solutions · Expenses & Profit Tracker

A standalone Next.js finance workspace for Davo. The original scope is preserved in `Davo_Solutions_Expenses_Profit_Tracker_Scope.md`; the target domain is `https://expenses.davosolutions.com`.

The current source tree includes expenses, salaries, transport, bills, monthly funds, settings/FX, revenue, dashboard/P&L, users, audit logs, reminders, attachments, and CSV exports. It still needs the Reports Centre, a shared live-app UI pass, complete acceptance testing, and demonstrated production evidence. Start with [`docs/current-delivery-audit.md`](docs/current-delivery-audit.md), then use [`todo.md`](todo.md) and [`docs/acceptance-matrix.md`](docs/acceptance-matrix.md) for task and evidence status.

## Start locally

Use Node 22 or 24 and npm. The installed versions are pinned in `package-lock.json`.

```powershell
cd expense-tracker
npm ci
# New checkout only: copy .env.example to .env.local and fill the dedicated project's values.
npm run env:check
npm run dev
```

Open [the design preview](http://localhost:3000/preview) to review the interface with fictional data, or [sign in](http://localhost:3000/login). The preview works without credentials. The current local `.env.local` has been organized from the dedicated Firebase configuration supplied by the user; do not overwrite it with the example file.

- `/preview`: Super Admin overview, revenue/expense/profit chart, category breakdown, revenue ranking, example bills and recent expenses.
- `/preview?role=secretary`: operational dashboard and the sample secretary's submissions.
- `/preview?section=expenses`: search, category filtering, sort control, and keyboard-accessible expense details.
- Month switching includes September, August, and a deliberate empty-state example.
- `/login`, `/forgot-password`: Firebase identity/session and reset forms. Missing configuration disables sign-in with a clear setup message.
- Real workspace routes use authorized server data and must never fall back to preview fixtures. `/reports` is currently a protected placeholder rather than a finished report workspace; it is the next product feature.

## Configuration

Read [`docs/environment.md`](docs/environment.md) for every variable, its source, and the scope phase that uses it. Firebase web identifiers and a dedicated Admin service account are configured locally. **Cloudinary is selected for images, PDFs and documents**; its server-only credentials and preset are configured and verified through a read-only API check. Firebase Storage is not used. Attachment, SMTP, and cron source modules exist, but private-file and controlled reminder-delivery acceptance remain pending. V1 uses manual exchange rates and requires no exchange-rate API key.

`npm run env:check` validates configuration without contacting Firebase or printing values. The local `APP_URL` is HTTP localhost for development. Set an HTTPS origin for production; `.env.local` localhost does not enable sign-in under `npm start` because production sessions intentionally require HTTPS.

Enable Firebase Email/Password authentication, configure authorized domains and reset emails, create Firestore, and deploy the checked-in rules in the **dedicated expense project**. Configure separate Vercel environment values before deployment. This repository does not itself prove current production configuration, DNS, or deployment health; verify them against the production domain and record the result in the acceptance matrix before calling the release complete.

Create the first Firebase Auth identity through a trusted process. Then use its UID with the bootstrap CLI, which checks the named project and runs a dry run by default:

```powershell
npm run bootstrap:admin -- --uid FIREBASE_AUTH_UID --project DEDICATED_PROJECT_ID
# Only when ready to provision that specific initial administrator:
npm run bootstrap:admin -- --uid FIREBASE_AUTH_UID --project DEDICATED_PROJECT_ID --apply
```

There is no public signup/bootstrap endpoint or email-based automatic Super Admin grant. The CLI refuses to overwrite a profile or run after the first administrator exists. It creates the initial profile and audit event atomically. No account has been provisioned by this foundation.

## Checks

```powershell
npm run check       # type generation + strict typecheck + lint + domain/security tests
npm run build       # production compilation; no remote Firebase access during build
npm run env:check   # local configuration status; never prints secret values
npm run test:e2e    # desktop/mobile browser smoke checks
```

Playwright uses installed Microsoft Edge by default. To use Playwright's Chromium on another machine:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = "chromium"
npm run test:e2e
```

The browser suite starts its own isolated dev server at port 3100 with blank Firebase credentials, using `.next-e2e/`. It does not stop a development server already running at port 3000. Browser screenshots/traces go to ignored `test-results/`.

Firestore/Storage rule integration requires Firebase CLI and a compatible Java runtime, which are not installed by this project:

```powershell
firebase emulators:exec --project demo-davo-expenses --only firestore,storage "npm test"
```

The rule test explicitly skips when the emulators are unavailable. This is separate from unit tests. Later tasks must add real server service/transaction tests: deny-all rules alone do not test Admin SDK callers.

## Architecture

```text
src/app/                 Next routes; (workspace) is protected, preview is public/sample-only
src/components/          Davo app shell, auth UI, shared states and preview presentation
src/domain/              Exact money, FX snapshots, business dates, source models and postings
src/lib/auth/            Current-profile authorization, session policy and route permissions
src/lib/firebase/        Lazy server Admin/client Auth setup and shared config validation
src/lib/cloudinary/      Selected attachment-provider config validation and server-only loader
src/lib/server/          Bounded JSON requests, CSRF, runtime audit schema and append writer
src/lib/preview/         Server-only fictional fixtures; no Firebase access
tests/domain/            Financial and date invariants
tests/security/          Permissions, session/config policy, audits, optional rules integration
tests/e2e/               Browser interactions, unauthorized redirects, mobile layout
docs/                    Architecture, financial model, security, environment, acceptance matrix
```

Server operations use verified Firebase session cookies and read each account's current role/status. Direct browser Firestore and Storage access is denied. Firebase Admin bypasses those rules, so every future data service must authorize its own callers. The preview role selector never grants real privileges.

Money uses integer minor units with exact decimal-string conversion and permanent rate snapshots. Reports aggregate one canonical `ledgerEntries` posting per financial event. Opening funds are not revenue; profit and closing balance stay separate. Pending salary accounting and some recurrence details are explicitly tracked decisions in the handoff. Cloudinary's provider choice is confirmed; secure attachment implementation is E4.

The audit helper uses create-only writes and belongs inside the same transaction as each future financial mutation. Application users cannot modify audits; privileged service-account/console access is an infrastructure trust boundary, not something Firestore client rules can eliminate. See [`docs/security.md`](docs/security.md).

Branding reuses the Davo compact mark and palette from the sibling Ads Manager. Its source and configuration have not been modified.

## Current local verification · 11 September 2026

- `npm run check` passed: 64 tests passed and 1 emulator-dependent test skipped. Type generation and TypeScript passed. ESLint exited successfully with **121 warnings**, so it is not a warning-free baseline.
- `npm run build` passed and confirms all implemented routes. It also confirms that no concrete `/reports` route has been built.
- Earlier recorded browser coverage was limited to the public preview at 390px and 1440px. The 360px, 768px, 1280px, live-data, accessibility, and Reports workflows remain pending.
- Local environment validation and the earlier read-only Cloudinary preset check do not verify Firebase persistence, private delivery, SMTP delivery, scheduled jobs, or the production domain.

On this Windows host, the sandbox prevented `tsx` from reading user information (`uv_os_get_passwd ENOMEM`) and prevented clean Playwright process shutdown. The final tests were run successfully with the required permission. This is an execution-environment constraint, not an application test failure.

## Continue with another model

Read [`AGENTS.md`](AGENTS.md), [`todo.md`](todo.md), and [`docs/current-delivery-audit.md`](docs/current-delivery-audit.md). The next product slice is **U0 → U1**: make the handoff truthful, then implement the Super Admin Reports Centre and its shared reporting boundary. Complete Firebase, attachment, SMTP, accessibility, emulator, and production checks only with actual evidence.
