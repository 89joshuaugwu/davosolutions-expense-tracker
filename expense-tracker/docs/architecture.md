# Architecture and implementation decisions

This document explains the foundation and the contracts that later features must preserve. Read `../todo.md` for execution order and `acceptance-matrix.md` for release evidence. The source product scope remains `../Davo_Solutions_Expenses_Profit_Tracker_Scope.md` v1.2. The user's request authorizes the foundation despite that document's older awaiting-approval footer.

## Product boundary

- One internal Davo Solutions company, separate from Ads Manager.
- Next.js App Router, TypeScript, Firebase Authentication, Cloud Firestore, server-side authorization, Recharts, and Vercel.
- Cloudinary is the confirmed image/PDF/document storage provider. Firebase Storage is unused. Keep Cloudinary API credentials server-only, uploads signed, and delivery authenticated with parent-record authorization.
- Target production domain: `expenses.davosolutions.com`.
- No Ads Manager credentials, Firebase project configuration, data, routes, authentication context, or operational services are copied into this application.
- Existing Davo artwork/color references are presentation assets only. The compact Davo mark and blue/navy palette connect the products; their data remains separate.
- The source tree now includes business persistence, live dashboard/P&L queries, reminders, attachments, administration, and CSV export routes. The next product boundary is the Super Admin Reports Centre. The acceptance matrix distinguishes those source artifacts from emulator, live-service, and production proof.

## Request and data flow

```text
Login form -> Firebase Authentication (email/password)
           -> ID token -> same-origin session endpoint
           -> verified HTTP-only server session cookie

Protected page / API -> session verification + fresh users/{uid} profile
                     -> active user + explicit permission check
                     -> server-only service
                     -> Firebase Admin / Firestore
                     -> explicit, role-permitted DTO -> browser

Financial write -> validate input and persisted references
                -> server selects exchange rate and computes money
                -> one Firestore transaction:
                   source record + canonical posting + audit + operation receipt
                -> invalidate/refetch only authorized views
```

Financial writes are implemented for the supported domains. A route or interface remains insufficient evidence of correct persistence, authorization, retry behavior, or production readiness; those require the acceptance checks in `acceptance-matrix.md`.

## Trust boundaries

1. The browser is an untrusted input source. Never accept `role`, `createdBy`, `baseAmountMinor`, the applied exchange rate, or audit metadata as authoritative request fields. Recompute or resolve them server-side.
2. Firebase Authentication proves identity; the current Firestore user profile determines active status and application permissions. Missing, malformed, inactive, or insufficiently privileged profiles fail closed.
3. Permission checks belong in the server data-access operation, not only layouts/navigation. Each route handler, server action, export, attachment request, and scheduled job has its own appropriate guard.
4. Firebase Admin bypasses Firestore Rules. Denying client SDK access prevents a second, weaker path; it does not replace server authorization. Keep Admin imports in server-only modules.
5. Browser Firestore and Storage reads/writes are denied by default. Later features use authenticated server routes. Do not enable permissive collection rules to make a screen work.
6. Role-sensitive results must not be stored in shared caches. Use private/no-store responses and request-scoped authentication. Never place financial data in static generation, public metadata, HTML comments, analytics, error payloads, or a Secretary's hidden component props.
7. Preview fixtures are fictional, public presentation data. `/preview` cannot obtain a real session, write production data, or weaken guards. Actual protected routes do not fall back to fixtures when configuration is absent or reads fail.

## Authorization decisions

The only privileged role is explicit `super_admin`; `secretary` is an operational role. No public signup or client-controlled role assignment is planned. An authenticated Firebase identity without an application user profile has no business access.

| Concern | Super Admin | Secretary |
|---|---|---|
| General expense submission | Allowed | Allowed while active |
| Submitted operational records | All | Own and explicitly assigned; apply register permissions as well |
| Submit salary, transport, bill logs | Allowed | Allowed while active |
| View salary, transport, bill registers | All | Only explicitly granted view permission plus own/assigned record scope |
| Correct/archive financial records | Mandatory reason and audit | Denied, including own submissions |
| Revenue, funds, profit, balances, reports | Allowed | Denied at query and serialization boundaries |
| Rate settings/global rates | Allowed | Denied |
| An allowed transaction's original amount and FX snapshot | Allowed | Allowed as evidence within that transaction |
| Users, categories, settings, audit | Allowed | Denied |

Operational totals are disabled for Secretary users until the Super Admin explicitly enables the relevant option. Creation permission does not imply permission to browse the register; provide an authorized data-entry path without revealing existing salary/transport/bill records. Hiding management navigation is only a usability measure. A permitted list query must constrain its records before pagination and omit forbidden fields before serialization. Do not download every record to filter in the browser.

Critical financial mutations should re-read the actor's current profile inside the Firestore transaction, alongside affected records, before writing. The initial session guard alone cannot fully protect a long-running operation from a concurrent role revocation. Tests should establish the expected concurrency behavior.

## Financial representation

- Persist integer minor units, never floating-point currency amounts. Parse user-entered decimal strings strictly. Reject negative/zero transaction amounts, excessive precision, unsupported currencies, unsafe integers, NaN, exponent notation, and ambiguous separators at validation boundaries.
- Preserve the submitted currency, original minor units, base currency, base minor units, rate identifier/effective date, and exact applied rate snapshot. Use the existing finance primitives for conversion and rounding.
- NGN is the initial base currency. Rates are manual Super Admin configuration. A rate means units of the base currency per one unit of the entered currency. No live third-party FX service is in scope.
- Changing a rate does not change an old transaction. An intentional recalculation is a correction with an explicit reason, updated posting, and before/after audit in one transaction.
- Until a historical currency migration strategy exists, reject a base-currency change after any monetary record exists, including opening funds and pending salaries that have no posting yet. Never sum NGN and USD base amounts or silently reinterpret stored minor units.
- Currency metadata, scales, and rounding are domain contracts. Adding a currency requires implementing and testing its minor-unit scale, not merely adding a select option.

## A single source of financial totals

Specialized registers retain their own business details. The `ledgerEntries` canonical posting collection supplies report totals, with deterministic IDs `sourceKind:sourceId`. A general expense, paid salary, transport entry, or bill payment contributes exactly one expense posting. Revenue contributes one revenue posting. A monthly fund allocation contributes to opening funds separately; it is not earned revenue and is not included in profit.

Only general expenses are stored in `expenses`; specialized records do not create mirror documents there. Do not independently sum `expenses`, `salaryLogs`, `transportLogs`, and bill payments into the same expense total. Do not make bill definitions or reminder events contribute expenses. All source-record create/correct/archive operations update their linked canonical posting and audit in the same Firestore transaction.

```text
expenses = sum(active expense postings in the selected period)
revenue = sum(active revenue postings in the selected period)
net profit = revenue - expenses
remaining opening fund = opening fund - expenses
closing balance = opening fund + revenue - expenses
profit margin = revenue == 0 ? N/A : net profit / revenue * 100
```

Reports use the transaction's business date and historical base-currency value. A salary period identifies payroll coverage; its payment date determines the cash expense reporting month. Do not label closing balance as profit.

## Dates, funds, and recurring records

- Business dates use validated `YYYY-MM-DD`, month keys use `YYYY-MM`, and the company timezone is `Africa/Lagos`.
- Store server-generated creation/audit timestamps as timestamps; distinguish these from user-selected business dates. Do not derive a Nigerian business date with `toISOString().slice(0, 10)` from local midnight.
- One monthly-fund record per company month, keyed deterministically by month in this single-company app. It may be zero and remains distinct from an absent allocation. There is no automatic rollover from the previous closing balance.
- `frequency` on an expense describes the submitted expense; it does not automatically create future expenses. Repeating bill schedules create due occurrences; only explicit payment recording produces a financial posting.
- Pending salaries provisionally do not post expenses until paid. This is a product interpretation that must be confirmed before salary implementation because the scope also says salary entries count toward expenses. Never count a pending entry and its eventual payment twice.
- Bill payment IDs use `billId__occurrenceDate`. V1 supports one full payment per bill occurrence, not installments; an intentional partial-payment feature requires a new contract and tests.
- Define end-of-month handling before implementing bill recurrence. Proposed rule: clamp a day such as the 31st to the last day of the target month, preserving the original recurrence anchor for later months.

## Atomicity, retries, and corrections

Every financial creation accepts a caller-generated idempotency key. Store a server-derived operation identifier scoped to actor and operation, plus a canonical request hash and resulting resource IDs. Same key + same payload returns the existing successful result. Same key + different payload returns a conflict. Resource IDs/linkages are stable across retry; an HTTP retry must never create another posting or audit entry.

The operation receipt, business record, posting, and successful audit event commit together. A failed transaction leaves none of them committed. Financial correction/archive commands require expected revision, a nonblank reason, and Super Admin authorization. Stale revisions conflict instead of overwriting another correction. Soft archive preserves source and audit history and removes/reverses the posting's contribution exactly once.

Append-only means the application offers creation and restricted reads of audit events, with no edit/delete operation. Record actor identity, target, action, request/session context where available, timestamp, reason, and safe before/after values. Never log passwords, raw tokens, session cookies, private keys, reset links, or receipt binary content. Project-owner database access remains outside the application's immutability guarantee.

## Attachments and reminder jobs

Cloudinary is the confirmed provider for images, PDFs and documents, with server-only environment values and verified API/preset access. The preset is currently unsigned; signed-only upload configuration and authenticated delivery remain required in E4. Existing Ads Manager Cloudinary code is not evidence that public receipt links are acceptable. Implement private downloads through parent-record authorization and test actual file retrieval. Until the workflows are implemented, attachment controls must explain their availability and must not silently discard a chosen file.

The storage workflow must authorize upload intent and download by record visibility, validate MIME/signature and size, use unpredictable object keys, and store attachment IDs/metadata rather than permanent public URLs. Short-lived signed delivery links are issued only after server access checks. File upload and Firestore commits are not one transaction: use temporary ownership records and orphan cleanup, and audit attach/detach outcomes.

Reminders run from an authenticated scheduled endpoint, independent of dashboard visits. Default lead times are 7, 3, and 1 day. Stable occurrence/recipient/lead-time keys deduplicate deliveries. Persist attempts/status and retry failures. Reminder delivery never creates expense postings. The SMTP provider's response and scheduler deployment must be verified with a controlled test recipient before claiming delivery works.

## UI and component boundaries

Use the foundation's shared shell, navigation metadata, tokens, form styles, and money/date formatters. Server pages load authorized DTOs; small client components handle interactive filters, forms, chart rendering, and dialogs. Share visual components between real screens and preview where useful, while keeping fixture imports exclusively under preview code.

Visual direction: Davo blue, a strong navy sidebar, pale canvas, white surfaces, restrained status colors, spacious hierarchy, and tabular monetary figures. Keep useful density on desktop and readable single-column cards/scroll-contained tables on mobile. Use text plus color for status, visible keyboard focus, labeled inputs, actionable errors, and explicit loading/empty/error/permission states. Avoid new decorative imagery unless it materially helps the user; receipt upload is functional evidence, not a hero-image requirement.

## Existing code contracts

| File | Contract to reuse |
|---|---|
| `src/lib/auth/model.ts` | `UserProfile`: UID/name/email, `super_admin` or `secretary`, active/deactivated status, explicit view permissions |
| `src/lib/auth/session.ts` | `getSessionUser()` for services/APIs; `requireUser()` and `requireSuperAdmin()` for server page redirects; session revocation and fresh profile checks |
| `src/lib/firebase/client.ts` | Browser identity sign-in/reset/sign-out only; no browser finance database access |
| `src/domain/money.ts` | `parseAmountToMinor()` and `createMoneySnapshot()`; exact minor units and decimal-string rate snapshots |
| `src/domain/dates.ts` | Validated company business dates and month keys |
| `src/domain/ledger.ts` | `calculateFinancialSummary({ month, baseCurrency, openingFundMinor, postings })`; canonical totals and nullable margin |
| `src/domain/models.ts` | Source-record types and collection contracts; extend deliberately with persistence adapters |
| `src/domain/postings.ts` | Source-to-ledger posting constructors; pending salary returns no posting |
| `src/domain/index.ts` | Domain exports |
| `docs/security.md` | Detailed security implementation, environment expectations, and verification gaps |

`MoneySnapshot` persists `originalAmountMinor`, `currency`, `baseCurrency`, `exchangeRateSnapshot` (decimal string), `rateDate`, and `baseAmountMinor`. Do not replace this representation with a different form-specific amount object. Secretary record visibility uses `createdBy` and `visibleToUserIds`, with register view permissions `viewSalaries`, `viewTransport`, and `viewBills`; `viewOperationalTotals` defaults false as well.

`POST /api/auth/session` exchanges a recent verified Firebase ID token for a five-day HttpOnly, SameSite=Strict server cookie. `DELETE /api/auth/session` clears the server session. Mutations validate the origin against `APP_URL`. Exact cookie/error behavior and integration gaps are documented in `docs/security.md`; later APIs should reuse these helpers rather than inventing parallel session handling.

## Delivery boundary

Local build/test success is not proof of live Firebase credentials, deployed security rules, browser login, email delivery, hosted scheduler behavior, domain ownership, or production permission tests. Track those separately in `acceptance-matrix.md`. Follow `todo.md` in vertical slices, keeping the application runnable and the task ledger honest after each slice.
