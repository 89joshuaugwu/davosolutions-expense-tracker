# Acceptance and verification matrix

Updated: 2026-09-11. This is the evidence ledger for scope v1.2, not a claim that the release is complete. Use `../todo.md` and `current-delivery-audit.md` for task order, and `architecture.md` for invariant explanations. Record test names/commands or dated manual checks when changing a status.

Status meanings: **Foundation** = a primitive, policy, type, or preview exists; **Pending** = complete feature/integration is not implemented or has not been verified; **Passed locally** = the named local check actually passed; **Passed live** = a deployed integration was exercised and evidence recorded. Never promote a feature from Foundation to Passed because its navigation item or TypeScript interface exists.

## Source scope acceptance

| ID | Required outcome from scope section 9 | Foundation coverage | Required implementation / evidence | Release status |
|---|---|---|---|---|
| AC-01 | Secretary can submit expense/salary/transport/bill logs and cannot alter them afterward | Active-user and role policy; source models; protected shell | `E2/E3/S1/T1/B1`: actual saves; forged PATCH/archive denied, including own records; reload persistence; all financial effects unique | Pending |
| AC-02 | Only Super Admin accesses revenue, profit, funds, balances, global rates, management reports | Server-session/current-profile authorization; navigation boundary; direct client DB denied | Integration tests for each page/API/DTO/export/download; inspect Secretary HTML/RSC/network; deactivate/demote an existing session | Pending |
| AC-03 | All financial entries support notes and optional attachments | Models/contracts; planned common evidence component | `E4`: expense/salary/transport/bill payment/fund/revenue save notes and private attachments; unauthorized ID/download denied | Pending |
| AC-04 | Scheduled bill reminders and duplicate-free expense creation | Bill/payment types and canonical posting model | `B1/A3`: one bill occurrence paid twice concurrently produces one posting; controlled scheduled email without opening UI; reminders produce no expenses | Pending |
| AC-05 | Monthly fund and totals/profit/balance are correct | Exact arithmetic and pure canonical-ledger summary | `M1/D1`: persisted month fixture reconciles all metrics; unique opening fund; absent vs zero allocation; no fund-as-revenue double count | Pending |
| AC-06 | Original foreign value/rate snapshot retained, dashboard uses base currency | `src/domain/money.ts` snapshot/conversion contract and domain tests | `M2/E2/V1/D1`: save USD 30 at 1,600, change rate, assert old NGN 48,000 remains; deliberate recalculation audited; mixed base rejected | Pending |
| AC-07 | Revenue-source charts identify highest source for selected period | Fictional visual preview; revenue/posting models | `V1/D1`: actual filtered source sums/ranking, ties and empty data defined, period controls agree with charts/export | Pending |
| AC-08 | Corrections/deletions/rate/role changes and sensitive events have immutable audit | Append-only audit contract/server helper | `E2/E3/A1/A2/A3/R1`: event coverage; source/posting/audit rollback consistency; before/after/reason; audit reads restricted; no edit/delete endpoint | Pending |
| AC-09 | Server/database role restrictions verified by tests | Pure policy tests and deny-all client rule configuration | `F1/R2`: emulator session/rules tests and API integration with all actors; Admin service permission tests; production rules deployment verification | Pending |
| AC-10 | App deployed successfully at `https://expenses.davosolutions.com` | Standalone Vercel-compatible project structure | `R3`: deployment, Firebase environment, DNS/HTTPS, auth domains/origin/cookies, scheduler and storage smoke tests | Pending |

## Security test inventory

Each scenario must test the server path. A hidden link, frontend conditional, static rules-file assertion, or pure predicate test is insufficient evidence for an end-to-end permission boundary.

| ID | Scenario and pass condition | Task | Current evidence / state |
|---|---|---|---|
| SEC-01 | Anonymous requests cannot load protected data; page redirects and APIs return a bounded authentication error | F1 | Passed locally in desktop/mobile smoke: six protected paths redirect to login; forged token does not set a cookie. Configured/live identity scenarios pending. |
| SEC-02 | Authenticated identity with no valid active profile is denied; malformed/unknown role cannot become privileged | F1 | Profile/policy foundation; integration pending |
| SEC-03 | Cookie is HttpOnly, SameSite=Strict, Secure in production; recent ID token and correct origin required to create it | F1 | Session endpoint implementation; browser verification pending |
| SEC-04 | Logout clears cookie; expired/revoked/disabled session denied; profile demotion/deactivation affects existing session | F1/A1 | Fresh-profile session contract; integration pending |
| SEC-05 | Browser Firestore and Storage read/write denied for anonymous, Secretary, and Super Admin SDK clients | F1 | Rules files deny direct access; emulator/deployment evidence pending |
| SEC-06 | Secretary own/explicitly assigned query scope applied before pagination; guessing ID cannot reveal another record | E3 | Visibility policy foundation; persisted query tests pending |
| SEC-07 | Salary/transport/bill view flag required for existing records, including own; active operational creation remains distinct | S1/T1/B1 | Default-false profile/policy contract; feature integration pending |
| SEC-08 | Secretary cannot correct/archive own or other records, forge actor/role/FX/base amount, or add forbidden fields | E2/E3 | Correction/role policy foundation; request tests pending |
| SEC-09 | No management data in Secretary server props, JSON, RSC payload, page source, chart series, count metadata, export or cache | D1/R1/R2 | Pending real-data screens/integration |
| SEC-10 | Copied/guessed receipt IDs and expired signed links do not bypass record permissions; storage is private | E4 | Cloudinary selected; credentials/preset verified read-only. Preset unsigned; secure upload/download implementation and tests pending. |
| SEC-11 | Sensitive APIs have private/no-store responses and guards even when invoked outside page navigation | All | Authentication foundation; business endpoint tests pending |
| SEC-12 | Preview fixtures remain isolated; preview role display cannot mint a cookie or grant database access | R2 | Passed locally: source reviewed; preview never queries Firebase; secretary preview omits KPIs/revenue navigation and other people's records. Real-session data leakage tests remain future work. |
| SEC-13 | Two concurrent demotions/deactivations cannot remove the last active Super Admin; partial Auth provisioning recoverable | A1 | Pending |
| SEC-14 | Audit/log/error fields contain no password, token, session cookie, key, reset link, or receipt binary | A2/R2 | Audit payload contract; full coverage pending |
| SEC-15 | Scheduler rejects missing/invalid server authentication; duplicate invokes cannot generate duplicate finance | A3 | Pending |
| SEC-16 | Financial mutations recheck current authorization in transaction; stale expected revision conflicts | E2/E3 | Pending persisted mutation path |

## Finance and data-integrity test inventory

| ID | Scenario and expected result | Task | Current evidence / state |
|---|---|---|---|
| FIN-01 | Decimal strings parse to safe integer minor units; invalid/excess precision/overflow/unsupported currency rejected | E1 | Domain tests in `tests/domain/money.test.ts`; local run status in README |
| FIN-02 | USD 30 at NGN 1,600 yields original 3,000 USD minor units and base 4,800,000 NGN minor units | M2 | Pure money snapshot test; persisted test pending |
| FIN-03 | Defined exact rate precision/rounding handles fractional rates and currency scales without binary float drift | M2 | Pure money tests; server request integration pending |
| FIN-04 | Canonical posting uniqueness rejects repeated source; specialized records do not also appear as general expenses | E2/S1/T1/B1 | Ledger/posting contract and domain tests; transaction tests pending |
| FIN-05 | Same actor/key/payload retried concurrently commits source+posting+audit+receipt once; differing payload conflicts | E2 | Pending |
| FIN-06 | Fault before transaction commit leaves no partial source/posting/audit/receipt; retries recover safely | E2 | Pending |
| FIN-07 | Reasoned correction/archive updates source/posting/audit atomically; stale revisions conflict; totals change once | E3 | Pending |
| FIN-08 | Zero revenue returns N/A margin; negative profit and remaining funds remain valid displayed values | D1 | Pure summary domain tests; real dashboard pending |
| FIN-09 | Opening fund changes remaining/closing balance but not profit; zero and missing fund distinct | M1/D1 | Pure summary contract/tests; persisted unique-month tests pending |
| FIN-10 | Business date/month validation handles leap years, year boundaries, Lagos dates; audit timestamp is separate | All | Date domain tests; browser/DB boundary integration pending |
| FIN-11 | Pending salary posts zero; paid salary posts once on payment date, irrespective of covered salary month | S1 | Posting/domain test; provisional policy requires confirmation before feature |
| FIN-12 | Transport total equals morning+evening+extra; a single posting captures total; extra requires reason | T1 | Posting/domain total foundation; form/service validation pending |
| FIN-13 | Same bill occurrence paid concurrently with different request keys still yields one full payment/posting | B1 | Deterministic bill-payment identity contract; transaction test pending |
| FIN-14 | Bill definition, unpaid occurrence, recurrence, and reminder create no expense; month-end anchor stays correct | B1/A3 | Posting separation contract; recurrence/reminder tests pending |
| FIN-15 | Rate changes preserve old snapshot; explicit recalculation needs reason/audit; base change blocked after any monetary record | M2 | Immutable snapshot contract; persisted mutation tests pending |
| FIN-16 | Mixed base currencies rejected; reports never silently sum incompatible stored base values | D1 | Ledger/domain test; service integration pending |
| FIN-17 | All dashboard metrics and CSV rows/totals reconcile under identical date/source/category filters | D1/R1 | Pending |
| FIN-18 | Source ranking correctly reflects period sums; empty/tie/negative-profit chart cases remain readable | D1 | Fictional preview only; real-data tests pending |

## Manual reconciliation fixture

Create this only in an isolated emulator/staging test dataset. Amounts below are NGN major units, while persistence uses minor units. Do not seed production financial data automatically.

| Component | Amount |
|---|---:|
| Opening fund | 1,000,000 |
| Revenue | 700,000 |
| General expenses | 100,000 |
| Paid salaries | 200,000 |
| Transport | 20,000 |
| Paid bills | 30,000 |
| **Total expenses** | **350,000** |
| **Net profit** | **350,000** |
| **Remaining opening fund** | **650,000** |
| **Closing balance** | **1,350,000** |
| **Profit margin** | **50%** |

Add a pending salary, an unpaid bill, and a sent reminder: all metrics above must remain unchanged. Retry a bill payment and expense submission: unchanged. Archive the NGN 100,000 general expense with an audited Super Admin reason: expenses become 250,000; profit 450,000; remaining fund 750,000; closing balance 1,450,000. Confirm the general-expense audit and source record remain recoverable. A rate change without explicit record recalculation must leave historical totals unchanged.

## UI, operations, and release checks

| ID | Required evidence | Task | State |
|---|---|---|---|
| UX-01 | Keyboard login/reset/form/menu flow, visible focus, associated labels/errors, meaningful loading and failures | F1/R2 | Foundation UI; full browser matrix pending |
| UX-02 | 360/390/768/1280/1440px layouts, no document-wide horizontal overflow, accessible table scrolling, long values/text | R2 | Passed locally at 390px and 1440px, including overflow/navigation checks and inspected screenshots. Remaining widths and real long-data cases pending. |
| UX-03 | Chart text/table alternatives, text+color statuses, reduced motion, currency/minor-unit precision, zero/negative values | D1/R2 | All three preview series render; accessible chart data table exists; zero-month/N/A and month controls pass browser tests. Live screen and full accessibility checks pending. |
| UX-04 | Every control works or clearly states unavailable; no fake saving/upload/email completion or fixture-as-live fallback | All | Foundation rule; verify after every slice |
| OPS-01 | Supported-runtime install, typecheck, lint, unit tests, production build pass | F1/R2 | Exact foundation command output recorded in README |
| OPS-02 | Live/emulator authentication and deployed database/storage rules tested separately from pure policy tests | F1/R3 | Pending |
| OPS-03 | Controlled SMTP test, scheduled invocation, retry/duplicate behavior, persisted delivery status | A3/R3 | Pending |
| OPS-04 | Private storage upload/download/expiration/cleanup verified | E4/R3 | Cloudinary selected and API/preset access verified. No uploads or private delivery verified yet; E4.1b onward pending. |
| OPS-05 | Production root/env/origin/auth domains, DNS, HTTPS, backups, recovery and operator handover documented | R3 | Pending |

## Recording evidence

Cloudinary follow-up, 2026-09-07: local environment validation passed; read-only Admin API request accepted supplied credentials and found the configured preset (unsigned, no authenticated delivery setting). `npm run check` passed with 33 tests, one explicit emulator skip, and clean typecheck/lint; production build passed. No uploads, downloads, or remote configuration changes occurred. Private delivery acceptance remains pending under E4.

Foundation local run, 2026-09-07, Windows/Node 24.20.0: `npm run check` passed (31 unit tests, one explicitly skipped emulator test; clean typecheck/lint); `npm run build` passed; `npm run env:check` validated local configuration without remote requests; `npm run test:e2e` passed 10/10 in headless Edge at desktop/mobile widths. Tests are in `tests/domain/`, `tests/security/`, and `tests/e2e/foundation.spec.ts`. Screenshots under ignored `test-results/` were inspected. These checks do not promote any unfinished release acceptance item to complete.

For automated checks, record command, date, environment, outcome, and test file/scenario. For browser/live checks, record actors and flow, expected/observed result, and safe screenshot/log reference if useful. Do not capture secrets or real financial data unnecessarily. A skipped test remains pending, with its reason.

When feature implementation completes, update the corresponding AC row and detailed SEC/FIN/UX/OPS rows together. Keep the distinction between local verification, emulator verification, and production acceptance visible to the next model and operator.
