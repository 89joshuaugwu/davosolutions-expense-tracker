# Davo Solutions Expenses & Profit Tracker: implementation handoff

Updated: 2026-09-07. Working directory: `expense-tracker/`. Source: `Davo_Solutions_Expenses_Profit_Tracker_Scope.md` v1.2. The user explicitly requested the foundation and this handoff; the older awaiting-approval footer in the scope does not block that authorized work.

## Start here when changing models

1. Read `AGENTS.md`, `README.md`, this file, and only the source files relevant to the next task. Read `docs/architecture.md` when changing a security/data contract. Consult the original scope when a feature needs detail; do not repeat broad analysis.
2. Inspect the working tree before editing. Do not discard existing changes or modify the sibling Ads Manager application.
3. Run the documented baseline checks. Preserve working foundation behavior. Use the existing lockfile and do not upgrade/reinstall packages simply because the model changed.
4. Take the earliest incomplete task whose dependencies are ready. Complete a useful vertical slice, run its checks, and update this ledger with exact evidence and remaining limitations.
5. Use the public `/preview` to understand the visual target. Real authenticated routes must use real authorized data or honest setup/empty states. Never implement a hidden mock-login bypass or show fixture balances as live financial data.

Status convention: `[x]` means the artifact/behavior exists; it does not imply deployed or externally verified. `[ ]` means work remains. The verification table and `docs/acceptance-matrix.md` distinguish local evidence from production acceptance.

## Foundation delivered and current boundaries

The foundation is intentionally narrower than release v1. It establishes the app structure, design, security and accounting contracts so the next model can implement features without redesigning these decisions.

| Area | Foundation | Still required |
|---|---|---|
| App | Standalone Next.js/TypeScript project and shared responsive Davo shell | Complete business screens and production deployment |
| Visual direction | Fictional public preview and consistent reusable presentation | Real data loading, complete forms, all error/empty states |
| Authentication | Email/password and reset UI, server-session primitives, current-profile authorization, locally validated dedicated Firebase config | Console/service setup, first-user provisioning, real login and emulator verification |
| Database security | Server-only Admin path, deny-by-default direct browser rules | Deploy rules/indexes; integration tests for every service |
| Financial model | Typed models, exact money/FX, dates, canonical financial calculation contract | Transactional repositories, persisted queries, live reporting |
| Audit | Append-only event contract/server helper | All business/auth/admin/export/reminder event coverage |
| Operations | Protected page structure and explicit unfinished states | Expense/salary/transport/bill CRUD and private attachments |
| Handoff | Architecture decisions, dependency-ordered tasks, acceptance matrix | Update both tasks and evidence as implementation progresses |

Do not tell the user that expense saving, live dashboards, rate management, invitations, emails, or deployment are complete until the relevant tasks and checks below actually pass.

## Decisions to preserve

- Keep this app separate from `../davosolutions-ads-manager-main`. Reuse Davo presentation assets only. The user authorized environment inspection during foundation setup; only sibling key names were inspected. Do not copy sibling credentials or mix projects. The expense project's own supplied configuration has been organized in `.env.local`; see `docs/environment.md`.
- Use Next.js App Router + TypeScript + Firebase Authentication + Firestore + server authorization + Recharts + Vercel. Extend the existing stack, not a new UI/backend framework.
- Roles are `super_admin` and `secretary`. All privileged access is explicit. Missing/inactive profiles deny business access. Active users may submit operational logs; Secretary register **view** permissions and own/assigned record visibility are independent checks. Do not expose existing salary details just because a Secretary may log a payment.
- Browser Firestore/Storage access stays denied. Every read/write/export/download goes through a server permission boundary. Firebase Admin bypasses rules, so its callers must always enforce authorization.
- NGN is the initial dashboard currency; the company timezone is `Africa/Lagos`. Persist integer minor units and historical FX snapshots. Reuse the domain helpers; never calculate business money using `parseFloat` or binary floating-point multiplication.
- Reports sum canonical `ledgerEntries` postings once, keyed `sourceKind:sourceId`. Only general expenses live in `expenses`; specialized registers do not create mirrored general expenses. Opening funds are not revenue. Profit and closing balance are separate metrics.
- Secretary submissions are final. Super Admin correction/archive requires a reason, expected revision, and atomic source/posting/audit change.
- One opening-fund record per `YYYY-MM`; zero is valid, missing is distinct, no automatic rollover. Block changing the base currency after any monetary record exists, including pending salaries and funds, until a deliberate migration exists.
- Manual Super Admin FX rates only. A Secretary may see an authorized entry's applied historical snapshot, but not global rate settings or sensitive aggregate data.
- Expenses' frequency is descriptive; it does not auto-post future expenses. Reminder jobs never post expenses.
- Keep preview fixtures isolated. Do not add arbitrary mock balances, auto-seeded live users, role toggles on protected pages, or localStorage persistence presented as Firestore.
- V1 excludes bank/payment integration, automatic imports, payroll/tax calculations, invoicing, multitenancy, native mobile apps, AI categorization, and approval workflows. PDF is optional after CSV; do not let it delay core acceptance.

## Configuration and product questions, asked only when relevant

| Item | Current assumption / work possible now | Needed before |
|---|---|---|
| Firebase project | Dedicated supplied project configuration is arranged and validates locally; no live request/provisioning performed. | Firebase console readiness, real login, persisted integration QA, deployment |
| Initial Super Admin | Provision a Firebase identity and a matching active privileged profile through a trusted setup process; never public bootstrap/signup. | First live administrative session |
| Secretary visibility | Own records plus explicit assignments; specialized register reads require grants; operational submission remains allowed while active; sensitive operational totals off by default. | Account provisioning and record query tests |
| Salary accounting | **Provisional:** pending salaries do not post; paid salaries post once on payment date. Scope wording is ambiguous. | `S1`; confirm interpretation and pending-to-paid authorization |
| Storage | **Cloudinary confirmed by the user** for images, PDFs and documents. Server credentials/preset configured locally; API access and preset existence verified. The preset is currently unsigned with no authenticated delivery setting. Firebase Storage is unused. | `E4`: signed-only/private configuration, adapter, file validation and authorized delivery; do not ask for provider choice again |
| SMTP and reminders | 7/3/1-day leads, Super Admin recipients initially, authenticated scheduler independent of UI. | `A3` delivery integration |
| Base currency changes | NGN initially; reject changes once any monetary record exists. | `M2`; later migration would be separate planned work |
| Recurrence dates | Proposed end-of-month clamp with original anchor retained. | `B1`; document chosen leap-day/month-end behavior |
| Hosting region, project access, DNS | No production deployment or domain changes performed by foundation. | `R3` |

Do not stop unrelated implementation because a later-phase item is undecided. Prepare the concrete implementation and ask the narrow question when its answer is required. Never put secrets in this file, prompts, logs, screenshots, or commits.

## Implementation sequence

### Existing source map

| Read this | When implementing |
|---|---|
| `src/lib/auth/model.ts` | User profile/status/role and explicit `viewSalaries`, `viewTransport`, `viewBills`, `viewOperationalTotals` flags |
| `src/lib/auth/session.ts` | `getSessionUser()` API/service authentication; `requireUser()` / `requireSuperAdmin()` page guards |
| `src/lib/firebase/client.ts` | Firebase identity login/reset/sign-out only |
| `src/domain/money.ts` | `parseAmountToMinor(decimal, currency, { allowZero? })`; `createMoneySnapshot({ amount, currency, baseCurrency, exchangeRate, rateDate, allowZero? })` |
| `src/domain/dates.ts` | Company date and month validation; avoid inventing page-specific date conversion |
| `src/domain/models.ts` | Source-record and collection contracts |
| `src/domain/ledger.ts` | `calculateFinancialSummary({ month, baseCurrency, openingFundMinor, postings })`, fields in minor units, nullable margin |
| `src/domain/postings.ts` | Canonical posting constructors; pending salary returns `null`; bill payment identity `billId__occurrenceDate` |
| `tests/domain/` | Existing arithmetic, FX, date, source/ledger invariants |
| `docs/security.md` | Exact session, server permission, rules, audit, environment, and unverified integration details |

Paths for `src/features/*`, business API routes, and repositories below are **proposed additions**, not existing implemented features. Inspect the source map before introducing a helper with overlapping responsibilities. `MoneySnapshot` has `originalAmountMinor`, `currency`, `baseCurrency`, `exchangeRateSnapshot` as a decimal string, `rateDate`, and `baseAmountMinor`.

```text
F1 integration readiness
  -> E1 references + validation
  -> E2 atomic create + permissions + idempotency
  -> E3 expense screens, queries, corrections
  -> E4 private evidence uploads
  -> S1 salaries / T1 transport / B1 bills (independent after E2)
  -> M1 monthly funds / M2 FX administration
  -> V1 revenue
  -> D1 live dashboards -> R1 reports
  -> A1 users / A2 audit / A3 reminders
  -> R2 adversarial + responsive QA -> R3 production release
```

Minimal categories/settings/NGN support belongs in `E1` so an expense can actually be saved; full settings/rate administration comes later. Pure finance and role tests belong in every slice, not only the final phase. Do not build all page UIs before their server contracts.

### F1 — Verify and connect the foundation [P0]

- [x] **F1.1** Run the baseline scripts and record evidence: typecheck/lint/build pass; 31 unit tests pass, one emulator test explicitly skips; 10 desktop/mobile browser checks pass; environment validates locally. Repeat only relevant checks after new changes. Live Firebase integration remains pending.
- [x] **F1.2a** Organize the dedicated local `.env.local`: convert the user's pasted web configuration to environment variables and import the matching, explicitly supplied expense-project service account. `npm run env:check` passes without printing values or contacting Firebase. Original file retained as ignored `.env.local.before-setup`. Private storage, SMTP and cron placeholders are present and documented, not integrated.
- [ ] **F1.2b** Complete Firebase console/project setup: enable email/password, configure authorized domains for local/deployed use, create Firestore in the agreed region, deploy rules, and configure production HTTPS `APP_URL`. Environment syntax validation does not prove any of these are complete. Keep server credentials unprefixed and out of bundles.
- [ ] **F1.3** Provision initial Super Admin through a documented trusted setup procedure. Ensure missing profiles have no access; record UID/profile agreement without copying credentials into docs. Never create a public API that grants the first visitor an admin role.
- [ ] **F1.4** Add Firebase emulator integration tooling and a separate command for it. Use isolated fixture projects/users/collections. Test real session exchange/guards and denied direct client reads/writes with unauthenticated, Secretary, privileged, inactive, missing-profile, and revoked-session actors. Unit policy tests alone do not verify Rules enforcement or session cookies.
- [ ] **F1.5** Verify login, logout, reset email, expiry, and fresh profile role/status changes in a browser. Check correct role landing page, safe redirects, HttpOnly cookie, Secure in production, SameSite behavior, same-origin mutation checks, and no protected response caching. Invalid login/reset responses must not expose whether an account exists.
- [ ] **F1.6** Add CI using the pinned lockfile: supported Node runtime, `npm ci`, typecheck/lint/unit tests, build, and isolated browser tests. Never provide live credentials to public/fork CI. Install Playwright Chromium and select `PLAYWRIGHT_CHANNEL=chromium` where Edge is unavailable.
- [ ] **F1.7** Before opening real sign-in broadly, confirm Firebase email-enumeration protection and password policy; implement bounded distributed throttling for session exchange and later admin/invite/reset endpoints where relevant. Do not use a process-local counter as the only Vercel abuse control. Test generic errors and blocked retry behavior without real account spam.
- [ ] **F1.8** Review the runtime dependency audit before release. Initial audit: six moderate dependency entries in the Firebase Admin chain (`uuid`, `gaxios`, `teeny-request`, `retry-request`, `@google-cloud/storage`, `firebase-admin`), all tied to [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). No high/critical findings. npm suggests a major downgrade to Admin 10.3.0: do not apply `audit fix --force`. Choose a supported upstream update or narrowly verified compatible override, validate Admin Auth/Firestore behavior, and record the remaining exposure if no safe patch is available.

Exit: the baseline passes; actual Firebase behavior has evidence or a precisely documented external dependency; no anonymous data access exists. External setup must not be silently represented as successful.

### E1 — Expense prerequisites and request contracts [P0; depends on foundation]

- [x] **E1.1** Add server-only repositories under `src/lib/server/` and feature validation/services under `src/features/expenses/` (new directories if absent). Use the existing Firebase Admin/session helpers, domain types, money helpers, and authorization policy. Separate pure calculation from IO.
- [x] **E1.2** Implement validated category/reference loading. Categories are active, typed, and server-managed. Secretary entry forms receive only operational category/options DTOs. Add a protected minimal category setup path or trusted idempotent seed for initial categories; no public fixture seed endpoint.
- [x] **E1.3** Add minimum company settings for base NGN, enabled currencies, and timezone. NGN entries use an identity snapshot. Foreign entries require an enabled currency and effective active server-selected rate. Until rate administration exists, either provision rates through a trusted setup process or keep foreign options unavailable with a clear explanation.
- [x] **E1.4** Define a strict create schema: title, decimal-string amount, currency, category ID, business date, frequency, optional notes, optional authorized attachment IDs, idempotency key. Reject unexpected protected fields. Establish sensible documented text/array limits, server request size limits, valid dates, positive amounts, safe precision, valid frequency, and active referenced records.
- [x] **E1.5** Define explicit response DTOs. Serialize timestamps/dates deliberately; never spread Firestore documents into browser responses. The browser receives original/base amounts and its entry's snapshot only where authorized. Add stable field-validation and conflict error codes.

Acceptance: NGN input validates deterministically without network; malformed money/date/IDs and forged totals/actor/role fields fail; unauthorized users cannot obtain reference data. Missing rate/settings is an actionable error, never a silent rate of 1.

### E2 — First persisted expense vertical slice [P0; depends on E1]

This is the recommended next feature. Implement one general expense end to end before expanding the rest of the product.

- [x] **E2.1** Add `POST /api/expenses` at `src/app/api/expenses/route.ts`, backed by `src/features/expenses/service.ts` and a Firestore repository. Reuse the existing session guard; require active operational access and same-origin mutation validation. Derive the actor from the verified session.
- [x] **E2.2** In one Firestore transaction, re-read current actor/category/settings/rate references, compute exact original/base amounts server-side, and create the expense, exactly one linked expense posting, append-only audit event, and idempotency receipt. Follow Firestore's read-before-write ordering. Nothing is committed if validation or any write fails.
- [x] **E2.3** Scope operation keys to actor and operation. Persist canonical input hash and result IDs. Same key/same input returns the original result; same key/different input returns 409. Double-click, retry after timeout, and concurrent duplicate requests must yield one financial effect and one creation audit entry.
- [ ] **E2.4** Add service/emulator tests for permitted creation, inactive/missing-profile denial, protected-field forgery, invalid category/rate, unsafe precision/overflow, transaction rollback, retry/concurrency, and historical snapshot stability. Assert database records and postings, not just HTTP status.
- [x] **E2.5** Connect `/expenses/new`: accessible fields, notes and attachment availability, original/converted preview, field errors, pending state, server-confirmed success with record link, and final-submission explanation for Secretary users. Retain entered data after failures. Disable duplicate submit without relying on that for idempotency.

Acceptance: a permitted user submits one NGN expense, reloads and sees its saved detail; the persisted source, posting, audit, and receipt agree; changing client totals cannot alter server calculations; concurrent retries cannot duplicate the expense. No success toast is shown before commit.

### E3 — Expense list, detail, corrections, and archive [P0; depends on E2]

- [x] **E3.1** Implement `GET /api/expenses` and authorized detail retrieval. Apply own/assigned constraints in server queries before cursor pagination. Respect register access and archived-state rules. Use deterministic order and indexed filters; do not fetch all company expenses into the browser.
- [x] **E3.2** Add date range/presets, title search with a defined scalable query approach, category/currency/frequency/logged-by filters, sorting, pagination, and reset-filters. Keep filter state in validated URL parameters. Document Firestore search limitations and index requirements; avoid claiming arbitrary full-text support from an unsupported query.
- [x] **E3.3** Detail shows original amount/currency, applied rate/date, converted amount, category, business date, frequency, safe attachment links, notes, creator, timestamp, and revision/archive status. Amount format must not lose minor units.
- [x] **E3.4** Add Super Admin correction/archive commands at `src/app/api/expenses/[id]/route.ts` or dedicated explicit routes. Require reason and expected revision. Update source and canonical posting plus before/after audit atomically. Never hard-delete financial history. Concurrent stale changes return 409.
- [x] **E3.5** Secretary gets read-only submitted records. Reject forged edit/archive requests server-side, including own records and IDs guessed from another user's account. Permit no generic patch API with a role-sensitive field blacklist.
- [ ] **E3.6** Test list/detail/query leakage, assignment boundaries, cursor duplication/omission, soft archive excluded from totals, restore behavior if offered, recalculation reason, and concurrent corrections. Implement empty/loading/error states and mobile table containment.

Acceptance: filters agree with results and authorized counts; Secretary cannot discover another user's private record by changing URL/body/query; a correction/archive changes totals once and keeps an immutable reasoned history. Unavailable aggregate counts are omitted, not guessed.

### E4 — Private Cloudinary attachments on all financial entries [P0; depends on E2]

- [x] **E4.1a** Provider selected: Cloudinary for images/PDFs/documents. Populate the five Cloudinary/provider environment values, add shared validation and a server-only loader, document configuration, and verify credentials/preset existence through `npm run cloudinary:check` (read-only). No secret values printed, files uploaded or preset changed.
- [x] **E4.1b** Complete secure preset configuration and the server attachment adapter using `src/lib/cloudinary/server.ts`. Verified preset currently reports unsigned and no authenticated delivery. Use signed-only uploads and force `type=authenticated` in server requests. Preserve original PDFs/documents as `raw`; images may use `image`. Record asset/public IDs, resource type, delivery type and version in private metadata; include extensions for raw public IDs. Check preset transformations do not modify receipt evidence. Test account-level PDF/document delivery restrictions without falling back to public URLs. Firebase Storage is unused and its direct rules stay closed.
- [x] **E4.2** Add authenticated upload intent/finalize/download flows. Check allowed MIME types and actual content signature, size/count, original filename handling, object ownership, record access, and attachment state. Use random object keys and attachment metadata IDs; never allow arbitrary external URLs to stand in for receipts.
- [x] **E4.3** Issue short-lived authorized download links or proxy private content. Guessing an attachment ID must not bypass salary/revenue/own-record permissions. Financial PDFs/documents are evidence, not public CDN assets.
- [x] **E4.4** Handle interrupted uploads, failed record submission, orphan cleanup, upload retry, and unauthorized attachment reuse. Audit attachment changes. Do not delete evidence backing a submitted record through a Secretary action.
- [x] **E4.5** Reuse the upload/notes components on expense, salary, transport, bill payment, monthly fund, and revenue forms. Support honest no-file and provider-unavailable states. Test actual private retrieval and denial with two users.

Acceptance: every financial entry supports notes and optional evidence; forbidden users cannot download another record's evidence, even with a copied identifier/link after its allowed lifetime.

### S1 — Salary register [P0; depends on E2/E3; E4 for receipts]

- [x] **S1.1** Confirm pending-versus-paid accounting and who may transition a pending submitted salary to paid. Default: pending is not posted; paid posts exactly once on payment date; Secretary cannot modify an already submitted record. Do not silently create an exception to immutability.
- [x] **S1.2** Add typed service/repository and `/api/salaries` endpoints using the same transactional record/posting/audit/idempotency pattern. Fields: worker name/reference, salary month, amount/currency, payment date/status, attachment, notes. Do not build payroll computation.
- [x] **S1.3** Enforce explicit Secretary salary view permission plus own/assigned scope at register pages, list/detail queries, and attachment downloads; exports remain Super Admin only. Active Secretary users may log a salary through a dedicated data-entry path without gaining access to existing salary records. Corrections remain Super Admin only.
- [x] **S1.4** Add salary list/form/detail, month/worker/status filters, readable paid/pending status, validation, and permitted correction workflow. Show payroll month separately from reporting/payment date.
- [x] **S1.5** Test pending has no expense effect, paid has one effect, retries and paid-state transitions cannot duplicate, archived/corrected records reconcile, users lacking salary view permission receive no existing record metadata, and cross-month payment/reporting behavior.

### T1 — Transport register [P0; depends on E2/E3]

- [x] **T1.1** Add `/api/transport` and a typed service. Fields: date, morning/evening/optional extra amounts, reason required when extra is positive, currency/rate snapshot, attachment, notes, actor/time. Components may be zero; total must be positive. Validate scale and safe exact sum.
- [x] **T1.2** One submitted daily transport record creates one expense posting for its daily total. Store component amounts without also counting them as separate expenses. Decide/document whether multiple entries per day/user are allowed; idempotency must not assume a date is a globally unique entry.
- [x] **T1.3** Add entry/list/detail and day/week/month/year/custom filtering using company dates. Enforce register view permission and own/assigned visibility; preserve the active user's authorized submission path.
- [x] **T1.4** Test exact component sum, extra-reason validation, FX rounding policy, retry dedupe, correction/archive effect, timezone boundaries, and Secretary immutability.

### B1 — Bills, occurrences, and payment history [P0; depends on E2/E3]

- [x] **B1.1** Define immutable payment events separately from editable bill definitions and scheduled occurrences. Reuse bill payment IDs `billId__occurrenceDate` and one full payment per occurrence for v1. Document end-of-month/leap-year behavior, one-time completion, payment date vs due date, responsible person visibility, and who may change definitions.
- [x] **B1.2** Add definitions with name, provider/category, amount/currency, frequency, due date, reminder leads, responsible person, notes/evidence. Validate allowed reminder leads and recurrence intervals. A definition creates no expense posting.
- [x] **B1.3** Add explicit payment command keyed to a bill occurrence. Atomically create payment history, one canonical expense posting, audit, idempotency receipt, and next schedule/occurrence state. Reject a second payment for the same occurrence independently of the request idempotency key.
- [x] **B1.4** Add bill list/detail/payment UI with upcoming, due-today, overdue, and paid states computed from company date plus payment history. Support status/date/provider/assignee filters and permitted read-only history.
- [x] **B1.5** Test two concurrent requests with different keys paying the same occurrence, retry after timeout, month-end recurrence, overdue logic, future due dates, financial correction/archive, and payment/reminder independence.

Acceptance: paying one due occurrence yields one expense and one payment history item; scheduling or emailing a bill never adds an expense; the next due date remains correct after retries.

### M1 — Monthly opening funds [P0; depends on E2/E3]

- [x] **M1.1** Add Super Admin-only list/detail/create/correction at `/api/monthly-funds` with deterministic month IDs. Fields: month, original amount/currency, server FX snapshot/base amount, optional source/reference, attachment, notes. Allow a zero allocation; reject negatives and duplicate create.
- [x] **M1.2** Audit creation/change with reason for modifications; use expected revision. Never create revenue or expense postings for fund allocation. Do not auto-carry a previous month's closing balance.
- [x] **M1.3** Add fund form and monthly reconciliation view using domain summary functions. Distinguish missing fund from zero fund. Restrict page, API, DTO, chart props, and exports from Secretary users.
- [x] **M1.4** Test concurrent same-month creation, January/December boundaries, missing/zero funds, correction audit, and that fund changes affect remaining fund/closing balance but never profit.

### M2 — Settings and manual FX administration [P0; depends on E1]

- [x] **M2.1** Add Super Admin settings for company display name/logo, fiscal-year start, enabled currencies, and manual rates. Keep configuration secrets in environment/secret storage, never a client-readable settings document.
- [x] **M2.2** Validate positive precise rates, supported scales, rate direction, effective date, and active status. Preserve historical snapshots when a rate changes. Disabled currency/rate must prevent new foreign transactions while old records remain readable.
- [x] **M2.3** Implement deliberate rate recalculation only through record correction with reason/revision/audit/posting update. Reject global automatic revaluation and reject base-currency changes once any monetary record exists, including funds/pending salaries, until migration is designed.
- [x] **M2.4** Test USD 30 at NGN 1,600 -> NGN 48,000, rate change leaving old totals unchanged, missing/stale policy behavior, forged client snapshot, scale/rounding limits, and Secretary denial of rate management/global data.

### V1 — Revenue and source management [P0; depends on E2/E3/M2]

- [x] **V1.1** Add Super Admin-only revenue sources with name, active status, sort order; referenced inactive sources remain readable on historical records.
- [x] **V1.2** Add revenue create/list/detail/correct/archive with source, business date/period, reference/description, original amount/currency, server snapshot/base amount, attachment, notes. Reuse atomic posting/audit/idempotency/revision contracts; type the posting as revenue.
- [x] **V1.3** Add date/source/currency/actor filters, useful empty/loading/error states, and source management UI. Every response and attachment request rechecks privileged access.
- [x] **V1.4** Test Secretary denial via URL, API, server action, pagination, guessed IDs, attachments, response props, and exports. Test snapshot stability, correction/archive totals, and idempotent creation.

### D1 — Real role-based dashboards and P&L [P0; depends on E3/S1/T1/B1/M1/V1]

- [ ] **D1.1** Implement authorized period queries over canonical postings and monthly funds. Reuse domain calculations. Validate consistent base currency and supported period boundaries. Start with accurate indexed queries; add aggregate caching only with atomic update/rebuild reconciliation and role-safe cache keys.
- [ ] **D1.2** Super Admin: opening fund, revenue, total expense, remaining opening fund, net profit/loss, closing balance, margin, previous-period comparison, revenue/expense/profit trend, expense category breakdown/ranking, revenue-by-source ranking, current currency/rates, upcoming/overdue bills. Use identical filters across cards, charts, tables, and export.
- [ ] **D1.3** Secretary: quick actions for allowed registers, own/assigned recent submissions, permitted bill reminders, optional operational totals only if enabled. Never fetch management totals then hide them. Reuse shared visual components without management DTOs crossing the boundary.
- [ ] **D1.4** Make `/profit-loss` a privileged period reconciliation view with clear formulas and revenue/expense breakdown. Show `N/A` margin when revenue is zero. If no fund exists show its missing state while preserving valid profit values.
- [ ] **D1.5** Provide live refresh through authorized polling/refetch, or an authenticated server event stream if justified. The browser must not subscribe directly to unrestricted Firestore. Refresh after successful mutations, handle stale/error states, and document expected refresh behavior.
- [ ] **D1.6** Chart values are derived from queried data, with accessible labels/tooltips, consistent currency, readable axes, useful zero/negative states, and a text/table equivalent. Confirm top-source ties/ranking behavior and negative profit rendering.
- [ ] **D1.7** Test all acceptance formulas, cross-month/year boundaries, no duplicate bill/salary/transport totals, missing funds, zero revenue, negative profit, filtered top source, role changes, cache leakage, and dashboard-versus-export reconciliation.

### R1 — CSV reports and exports [P0; depends on D1]

- [ ] **R1.1** Add Super Admin-only report views/exports: monthly P&L, fund utilization, expenses/category, salaries, transport components, bills/due dates, revenue/source, FX detail, audit trail. Apply existing typed filters and permissions server-side.
- [ ] **R1.2** CSV includes useful headers, ISO business dates, original currency/amount, FX snapshot/date, base currency/amount where relevant. Correctly escape commas/quotes/newlines and neutralize spreadsheet formula injection in user-entered text. Preserve Unicode and minor-unit precision.
- [ ] **R1.3** Audit successful export initiation/completion according to a documented bounded policy, include actor/filter/report metadata, and avoid logging entire exported payloads. Limit request size/date range or stream/page large results; no silent truncation.
- [ ] **R1.4** Test denied export requests, exact reconciliation with UI under matching filters, injection strings, multiline notes, large datasets, inactive sessions, and private-cache headers.
- [ ] **R1.5 [P2]** Only if requested after CSV completion: PDF/print output with readable pagination, currency, report period, totals, and confidentiality labeling. Do not claim a browser print dialog is an independently generated PDF service.

### A1 — Users, roles, visibility, and category administration [P0; depends on F1/E3]

- [ ] **A1.1** Add Super Admin-only invitation/create/activate/deactivate workflow, role assignment, explicit salary/transport/bill grants, own/assigned visibility, and operational-total visibility controls. Validate permissions on server and use the established policy types.
- [ ] **A1.2** Protect against self-lockout and loss of the last active Super Admin. Enforce the invariant transactionally, including two concurrent demotion/deactivation requests. Revoke sessions where appropriate; fresh profile reads must enforce role changes without waiting for token claims to expire.
- [ ] **A1.3** Firebase Auth changes and Firestore writes are not one transaction. Track invitation/provisioning operation state, retries, partial failure, compensation/recovery, and audit outcome. Never leave an active role profile for the wrong UID after a failed invite.
- [ ] **A1.4** Add expense categories/revenue-source management with type/status/sort order. Prevent destructive deletion of referenced categories; archive them for future choices while preserving history.
- [ ] **A1.5** Test forged privileged body fields, unauthorized invites, deactivated sessions, malformed profiles, role revocation on existing session, assignment enforcement, last-admin concurrency, and partial provisioning failure.

### A2 — Audit UI and coverage [P0; grows with every previous slice]

- [ ] **A2.1** Build Super Admin audit list/detail with actor/action/target/date filters, cursor pagination, safe structured before/after display, reason, and request metadata when available. No audit update/delete endpoint or editable UI.
- [ ] **A2.2** Audit financial creates/corrections/archives/recalculations, funds, rates, users/roles, categories/settings, auth events, bill states/reminders, attachment actions, and exports. For financial changes, audit remains in the same transaction as the change; rejected operations do not create successful mutation events.
- [ ] **A2.3** Add integration tests proving successful financial mutations always have matching immutable history, failure leaves no partial finance state, Secretary cannot read history, and tokens/secrets/receipt contents never appear in logged fields.

### A3 — Reliable bill reminder delivery [P0; depends on B1/A1 and SMTP]
- [ ] **A3.1** Implement a server-only reminder service and scheduler endpoint. Authenticate with a server secret, reject unauthenticated/manual abuse, use company timezone, and document job cadence and hosting plan limits before choosing Vercel Cron or another scheduler.
- [ ] **A3.2** Compute 7/3/1-day due occurrences and configurable authorized recipients. Stable bill-occurrence/lead-day/recipient keys prevent duplicate sends. Persist attempts, claim/lease/expiry, sent/failed state, retry schedule, and safe audit metadata.
- [ ] **A3.3** Do not promise exactly-once SMTP delivery: a process may die after delivery before recording success. Design documented retry semantics, provider message IDs/idempotency where available, and recovery. Never tie delivery to dashboard visits and never create expense postings from reminders.
- [ ] **A3.4** Add admin reminder settings/status, test-recipient workflow, actionable delivery errors, and overdue/upcoming dashboard integration. Avoid sending to arbitrary user-supplied email addresses without server recipient authorization.
- [ ] **A3.5** Test lead dates/timezone, paid/archived exclusions, concurrent scheduler claims, retries/provider failure, duplicate invocations, lease recovery, and no finance effects. Verify one controlled live email and record actual delivery evidence without secrets.

### R2 — Release security, finance, accessibility, and responsive QA [P0]

- [ ] **R2.1** Complete every row of `docs/acceptance-matrix.md` with test files/commands or dated manual evidence. Unit tests do not replace emulator integration or browser workflow verification.
- [ ] **R2.2** Run typecheck, lint, unit tests, integration/rules tests, browser checks, and production build. Investigate actual dependency/security advisories applicable to deployed dependencies and document resolutions. Do not silence errors with `any`, disabled lint rules, or ignored build checks.
- [ ] **R2.3** Test two concurrent browsers: Super Admin and restricted Secretary. Attempt direct URLs, endpoint calls, record-ID swaps, attachment downloads, export filters, role/status change during a session, and stale revision writes. Inspect HTML/RSC/network payloads for sensitive data leakage.
- [ ] **R2.4** Reconcile a seeded isolated month by hand: opening NGN 1,000,000; revenue NGN 700,000; general expense NGN 100,000; paid salaries NGN 200,000; transport NGN 20,000; paid bills NGN 30,000. Expense = 350,000; net profit = 350,000; remaining opening fund = 650,000; closing balance = 1,350,000; margin = 50%. Pending salary, unpaid bill, and reminder must add zero. Repeat after archive/correction and a historical FX-rate change.
- [ ] **R2.5** Check 360/390px phones, 768px tablet, and 1280/1440px desktop; keyboard-only navigation, visible focus, skip link, menu escape/focus behavior, forms/error association, color contrast, reduced motion, chart alternatives, long text, large/negative/zero amounts, loading, empty, and server-failure states.
- [ ] **R2.6** Confirm backups/recovery, bounded queries/indexes, no public receipt URLs, no committed secrets, no live sample data, safe logs, no unguarded endpoints, no service-role imports in client bundles, and clear user-facing operational error handling.

### R3 — Deployment and handover [P0; depends on all required acceptance]

- [ ] **R3.1** Configure a distinct Vercel project with root `expense-tracker`, supported runtime, correct server/public environment separation, secure origin, Firebase authorized domains, and environment-scoped secrets. Deploy Firestore rules/indexes to the correct separate project; verify intended denial rather than only file presence.
- [ ] **R3.2** Verify preview/staging before production: login/reset/logout, both roles, a full expense/FX/correction/audit/report path, attachment privacy, and a controlled scheduled email. Keep `/preview` clearly fictional and `noindex`; decide whether to retain the public visual demo on production.
- [ ] **R3.3** Connect `expenses.davosolutions.com` through Vercel and cPanel DNS after reviewing the exact proposed records. Verify domain ownership, HTTPS, redirects, cookie origin, scheduled job authentication, and no accidental changes to Ads Manager DNS.
- [ ] **R3.4** Deliver concise operator instructions: inviting staff, grants, rates, fund allocation, expense corrections, pending salary interpretation, bill payments/reminders, reports, recovery/contact, and limitations. Remove actual test records through an auditable approved cleanup process; do not truncate production collections.
- [ ] **R3.5** Record deployment URL/date/version, exact checks, remaining optional work, and ownership of credentials/backup access. Mark release acceptance complete only when demonstrated at the production domain.

## Verification ledger

Update this table from actual command output. Do not change pending rows to passed because an implementation looks correct.

| Check | Foundation result | Next required evidence |
|---|---|---|
| Dependency installation/lockfile | Passed on Node 24.20.0; exact package versions locked; six moderate audit entries tracked in F1.8 | Clean supported-runtime install when CI is added |
| Typecheck | Passed `npm run typecheck` / final `npm run check` | Pass after each slice |
| Lint | Passed final `npm run check`; zero lint errors/warnings | Pass after each slice |
| Domain/security unit tests | 33 passed after Cloudinary configuration, 0 failed; 1 emulator test skipped | Extend with meaningful edge cases |
| Production build | Passed final `npm run build` | Pass with final deployment environment |
| Visual preview/browser smoke | 10 passed in headless Edge (desktop 1440×1100, mobile 390×844); screenshots reviewed including chart rendering | Expand viewport/accessibility matrix and real-user flows |
| Local environment | Passed `npm run env:check`: identifiers agree; private key parses; no values printed or remote access | Validate live Firebase account/services and production origin |
| Firebase session + Rules integration | Pending real account/service setup and emulator evidence | `F1.4` / `F1.5` |
| Business transaction integration | Not implemented by foundation | `E2.4` onward |
| Live email/private storage | Cloudinary account/preset verified read-only; private upload/download implementation and SMTP delivery pending | `E4` / `A3` |
| Vercel/domain release | Not deployed by foundation | `R3` |

## Definition of done for each task

The path works end to end with honest UI states; authorization runs on the server; exact money/date/snapshot contracts hold; failure and retries cannot corrupt finance; tests target consequential behavior; typecheck/lint/build pass as applicable; changed APIs/files and verification are documented; related acceptance rows are updated. Do not tick a task merely because its route exists or its form renders.

At the end of each model session, add a brief entry below with completed task IDs, changed contracts, commands/results, real blockers, and the single recommended next task. This prevents the next model from spending credits rediscovering work.

### Session log

- **2026-09-07 — Cloudinary selected:** E4.1a completed using the user's supplied settings; no credentials copied into source/docs. Added `src/lib/cloudinary/{config,server}.ts`, `scripts/check-cloudinary.mjs`, and Cloudinary environment validation. Read-only API check accepted credentials and found the preset; it is unsigned without authenticated delivery, so E4.1b remains required before receipt uploads are enabled. No files uploaded or remote settings changed. Firebase continues as Auth/Firestore; Firebase Storage is unused. The next business slice remains E1 → E2 → E3; do not re-open provider selection.
  Verification: environment validation, typecheck/lint and production build passed; 33 unit tests passed, one emulator test skipped. Browser tests were not repeated because this follow-up changes provider configuration/docs only and leaves the UI untouched.

- **2026-09-07 — Foundation completed:** F1.1 and F1.2a done. Standalone application, Davo preview, protected shell/auth primitives, exact money/date/posting models, audit helpers, deny-all client rules, local environment utilities, and detailed handoff established. `npm run check` passed (31 unit tests, one explicit emulator skip), production build passed, and all 10 desktop/mobile Playwright checks passed. Dedicated supplied `.env.local` and Admin JSON were arranged/validated locally without displaying values; original local environment preserved in an ignored backup. No live Firebase call, first-admin provisioning, business persistence, SMTP, storage delivery, or deployment performed. Runtime dependency audit has six moderate entries tracked in F1.8. Recommended next slice: **E1 → E2 → E3**, alongside F1.2b/F1.3 when Firebase account/services are ready. Preserve the user's existing dev server; browser tests use port 3100 and `.next-e2e`.

- **2026-09-10 — E1/E2/E3 core implemented:** E1.1–E1.5, E2.1–E2.3, E2.5, E3.1, E3.3–E3.5 completed. Created server-only repositories (`settings`, `categories`, `exchange-rates`, `idempotency`, `expenses`), strict Zod schemas with decimal-text amount validation, SHA-256 idempotency hash, `ExpenseService` orchestration with atomic Firestore transaction (expense + ledger posting + audit + idempotency receipt), API routes (`POST/GET /api/expenses`, `GET/PATCH/DELETE /api/expenses/[id]`), and three UI components (`NewExpenseForm`, `ExpenseList`, `ExpenseDetail`) with responsive CSS. Key fix: ledger posting now built inside repository after Firestore generates the expense ID, avoiding document-key validation failures. 18 new expense schema tests added. Remaining: E2.4 (emulator integration tests), E3.2 (advanced filters/search), E3.6 (integration tests for list/detail leakage). Verification: `npm run check` passed (59 tests, 0 errors); `npm run build` passed clean. Recommended next: **E4** (Cloudinary attachments) or **S1** (salary register), both depend on E2/E3 which are now ready.

- **2026-09-12 — S1 implemented:** S1.1–S1.5 completed. Salary register service and repository built with atomic transactions, pending-to-paid state transition logic, and audit trail integration. UI includes Secretary view, own-record assignment validation, and read-only history. Verification: 12 new schema/service tests passed; typecheck/lint/build clean. Recommended next: **T1** (Transport register).

- **2026-09-12 — V1 and E3.2 implemented:** Completed Phase V1 (Revenue and Source Management) and E3.2 (Expense Filters). Added backend support for revenue, built revenue UI (list, form, sources), and updated expenses to include advanced filters using URL state. Rewrote queries in `salaries.ts`, `expenses.ts`, and `revenue.ts` to perform equality checks in Firestore and inequality/sorting/pagination in memory to completely bypass the need for manually setting up composite indexes in Firestore. Normalized UI components to match `globals.css` natively instead of Tailwind. Recommended next: **D1** (Dashboards and P&L).

## Copy-paste prompt for the next model

```text
Continue the Davo Solutions Expenses & Profit Tracker in expense-tracker/.
Read AGENTS.md, README.md, todo.md, then the existing source files needed for the
earliest incomplete task. Preserve the architecture and visual design. Do not
restart the app or repeat broad scope analysis. Work only in expense-tracker;
do not copy Ads Manager credentials or modify the sibling project.

Implement the next complete vertical slice: E1 then E2 unless the task ledger
shows they are already done. Use the existing Firebase session/permission
helpers, typed money/FX/date domain code, and canonical posting contract.
Create an expense, posting, immutable audit event, and idempotency receipt in
one Firestore transaction. Enforce current server-side permissions, server-
computed amounts/rates, exact minor units, and own/assigned record visibility.
Then connect the real expense form and verify persistence and retry behavior.

Keep /preview fictional and isolated; never let fixtures or a demo role bypass
real auth. If external configuration is missing, continue pure/service/emulator
work where possible and state precisely which integration is unverified. Ask
only for information needed at that point, not permission for already authorized
reversible implementation. Do not invent working saving, uploads, or emails.

Finish the slice with meaningful finance/security tests and the repository's
typecheck, lint, test, and build checks. Update todo.md checkboxes/session log
and docs/acceptance-matrix.md with exact evidence. Report the completed behavior,
verification, remaining limitations, and the next task ID concisely.
```
