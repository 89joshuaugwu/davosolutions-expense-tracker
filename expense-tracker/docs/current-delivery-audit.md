# Current delivery audit and next roadmap

Updated: 2026-09-11  
Scope: Davo Solutions Expenses & Profit Tracker v1.2

This document is the current handoff for the next product pass. It reconciles the scope, source tree, `todo.md`, acceptance matrix, operator manual, README, and the recorded earlier-session notes. It deliberately separates implemented source code from verified release behaviour.

This is a source and documentation audit. It is not a substitute for a fresh rendered-browser review; U3 includes the required screenshot, viewport, keyboard, and assistive-technology checks.

## Executive state

The application is no longer only a foundation. It has real routes and source modules for expense, salary, transport, bills, monthly funds, settings and manual FX, revenue, dashboard/P&L, users, audit logs, reminder jobs, Cloudinary attachments, and six CSV export endpoints.

The application is not ready to call complete or released. The biggest product gap is the Super Admin **Reports** page promised by the scope and shown in navigation. The second gap is a coherent live-app UI system: screens mix the original Davo component classes, inline styles, and CSS variables that are not defined by the active token set. The acceptance matrix also still needs emulator, accessibility, responsive, and production evidence.

## Confirmed implementation inventory

| Area | Current source evidence | Status to use |
|---|---|---|
| Protected workspace and navigation | `src/app/(workspace)/layout.tsx`, `src/components/app-shell.tsx`, `src/lib/navigation.ts` | Implemented; route-level authorization needs consistency work |
| Financial domains | Routes/components/repositories for expenses, salaries, transport, bills, monthly funds, revenue, settings, and dashboard | Implemented; end-to-end financial acceptance is still pending |
| CSV exports | `/api/export/{expenses,revenue,salaries,transport,bills,profit-loss}` | Implemented; incomplete against the full scope report set |
| Audit and user administration | `/audit-log`, `/users`, API routes, repositories and components | Implemented; integration coverage remains pending |
| Reminders and attachments | `/api/cron/reminders`, attachment intent/finalize/download routes, Cloudinary server adapter | Implemented in source; controlled delivery and private-file acceptance remain pending |
| Release/build health | `npm run check` and `npm run build` on 2026-09-11 | Passed; lint has 121 warnings, not a clean warning-free result |

## P0 finding: the Reports page is missing

The scope requires a Super Admin-only `/reports` page with filtered CSV reporting for:

1. Monthly profit and loss
2. Monthly fund utilization
3. Expenses by category
4. Salary report
5. Morning/evening transportation report
6. Bills and due-date report
7. Revenue by source
8. Currency conversion details
9. Audit trail

`src/lib/navigation.ts` advertises `reports`, and the authorization policy correctly treats `/reports` as management-only. There is no `src/app/(workspace)/reports/page.tsx`, reports component, report query service, audit-trail export, or FX-detail export. At runtime the generic `[section]` route catches `/reports` and displays the old `ModulePlaceholder` instead of a Reports Centre.

The six current export endpoints are useful building blocks, but they are not a report workspace. Some duplicate CSV escaping/audit logic and cap list queries at `pageSize: 10000`; the next pass should centralize filters, output metadata, and bounded result handling.

## UX, navigation, and component findings

### 1. Establish one live-app component system

The preview demonstrates the intended Davo look, but live screens have drifted. Dashboard, P&L, settings, user management, and audit screens use many inline styles. Several use undefined variables such as `--text-secondary`, `--success`, `--error`, `--space-*`, `--bg-surface`, and `--border-subtle`; the root token definition in `globals.css` does not supply them.

Create and use these shared presentation primitives:

- `PageHeader` for title, description, period/filter controls, and primary action.
- `FilterBar` for responsive URL-backed filters and reset.
- `MetricCard`, `StatusBadge`, and `EmptyState` for consistent hierarchy and non-data states.
- `DataTable` with a labelled scroll region, table/card mobile presentation, pagination, and safe long-text wrapping.
- `ActionMenu`/confirmation pattern for correction, archive, and export actions.
- `AsyncState` for loading, retryable failures, and no-data states.

Keep the existing Davo blue/navy visual language. Do not introduce a separate design library or copy code from the Ads Manager.

### 2. Make navigation usable on small screens and correct for roles

The shell already has a desktop sidebar, mobile drawer, skip link, active navigation state, and labels. Improve it by adding Escape-to-close, focus management, `aria-controls`, focus return to the menu trigger, and an active drawer scroll strategy.

The workspace layout proves a user is authenticated but it does not enforce every route's role permission. Several pages only call `requireUser()` or have no page-level guard: bills, transport, monthly funds, and P&L are examples. APIs must remain the decisive security boundary, but direct URLs should redirect denied users before rendering a privileged screen shell or client component.

Replace stale copy such as `Foundation v0.1` in the shell footer and correct mojibake text in source and Markdown before visual polish.

### 3. Use company dates consistently

Multiple client components derive a reporting month through `new Date().toISOString().slice(0, 7)`. That can produce the wrong business month near midnight in `Africa/Lagos`. Add one company-date helper for the default reporting month and use it everywhere.

### 4. Complete responsive and accessible behaviour intentionally

Existing documentation only records browser checks at 390px and 1440px. The scope requires 360/390px phone, 768px tablet, and 1280/1440px desktop verification. Test long currency values, long supplier/employee names, error summaries, empty states, reduced motion, keyboard-only navigation, focus order, chart data alternatives, and contained table overflow.

## Documentation corrections required

| File | Correction |
|---|---|
| `todo.md` | The introduction still calls the app a narrow foundation, includes stale claims, and ends with a malformed legacy block. Keep phase contracts but use this audit and the acceptance matrix for current status. |
| `README.md` | Corrected to describe the implemented source inventory and its verification limits. Keep it current when a Reports or release slice lands. |
| `docs/architecture.md` | Corrected to describe the implemented source contracts and open evidence gaps. Extend it when reporting contracts are added. |
| `docs/operator-manual.md` | Corrected from Google sign-in to Firebase email/password and no longer claims that the missing Reports page is available. |
| `docs/acceptance-matrix.md` | Updated its date and handoff links. Update rows only after running the listed evidence, never from source inspection alone. |

## Recommended execution order

### U0 — clean handoff and truthful status

1. Repair the malformed legacy tail in `todo.md` without removing phase contracts.
2. Update README, architecture, operator manual, and acceptance matrix timestamps/status language.
3. Record the current local verification accurately: 64 passed, 1 skipped domain/security test; `npm run check` exits successfully with 121 lint warnings; production build passes.

Acceptance: a new model can identify the actual next task without treating old foundation prose or chat notes as proof of a release.

### U1 — Reports Centre and report data boundary

1. Add `src/app/(workspace)/reports/page.tsx` with `requireSuperAdmin()`.
2. Add a typed reporting feature/service that owns period validation, common filters, safe report DTOs, report metadata, and reconciliation rules.
3. Build a Super Admin Reports Centre with a period control (`month`, preset range, custom range), report cards, on-screen totals/breakdowns, and a clear CSV action for each report.
4. Reuse the same service/filter contract for report UI and exports. Retire duplicated CSV code where a shared helper can safely own it.
5. Add missing audit-trail and FX-detail reports/exports. Fund utilization must show opening fund, expenses, remaining fund, revenue, and closing balance without calling opening fund revenue.
6. Bound large exports and record an audit event without storing full exported payloads.

Acceptance: every report named by the scope renders honest loading/empty/error states, applies its filters on the server, exports matching CSV data, and is inaccessible to a Secretary by route and API.

PDF is deliberately deferred. A print-friendly P&L/Reports layout can be a later P2 task after CSV parity and responsive QA are proven.

### U2 — shared UI and navigation pass

1. Define the missing design tokens and replace ad-hoc inline presentation with the shared primitives above.
2. Apply the primitives to Dashboard, P&L, reports, the six record lists, audit, settings, users, and forms as they are touched.
3. Fix navigation drawer keyboard behaviour, role-aware page guards, stale footer/copy, and mojibake.
4. Replace local `toISOString()` reporting-month defaults with the company-date helper.

Acceptance: live screens share one readable visual language, all navigation controls work by keyboard, and denied direct URLs redirect safely.

### U3 — responsive, accessibility, and acceptance QA

1. Add Playwright coverage for `/reports`, role denial, report/export filter parity, mobile navigation keys, and representative empty/error/long-data states.
2. Run the full viewport matrix: 360, 390, 768, 1280, and 1440 pixels.
3. Run keyboard, focus, reduced-motion, chart-alternative, and table-overflow checks.
4. Complete D1.7 and R2.1–R2.5 with emulator/staging data, including the reconciliation fixture in `docs/acceptance-matrix.md`.

Acceptance: the acceptance matrix has dated commands/flows and clearly separates local, emulator, and live evidence.

### U4 — production evidence reconciliation

The earlier notes record a Firestore deployment, but the repository documentation does not contain current production smoke-test evidence. Verify the actual domain, Firebase authorized domain, production environment, scheduler authentication, private attachment retrieval, controlled SMTP delivery, and both user roles before marking R3 complete.

## Guardrails for implementation

- Do not expose Cloudinary, Firebase, SMTP, or cron secrets in UI, docs, or logs.
- Keep browser Firestore/Storage access denied; Reports must call server-side services only.
- Use canonical ledger entries once for all financial totals. Do not sum a general expense plus specialized registers.
- Preserve historical FX snapshots and use integer minor units.
- Keep `/preview` fictional and isolated from protected data.
- Do not upgrade dependencies or silence lint rules as part of visual work. Resolve warning classes when they affect reliability or maintainability.

## Next-model task prompt

```text
Continue in expense-tracker/. Read AGENTS.md, todo.md, docs/current-delivery-audit.md,
docs/acceptance-matrix.md, and the scope. Start U0, then implement U1 as a vertical slice.

Build the Super Admin-only /reports route and a typed reporting service shared by the page and
CSV exports. Cover every scope report: P&L, fund utilization, expenses by category, salaries,
transport components, bills/due dates, revenue by source, FX details, and audit trail. Apply
validated server-side period/filter inputs; use canonical ledger entries for totals; do not leak
management data to a Secretary. Add missing audit and FX CSV exports, preserve CSV-injection
protection, audit successful exports, and bound large result sets.

At the same time, introduce only the small shared UI primitives needed by Reports and touched
surfaces. Fix missing CSS-token references, role-aware page guards, Africa/Lagos month defaults,
stale Foundation copy, and text encoding defects. Do not create a separate UI framework.

Use meaningful tests for report filter/export parity and role denial. Run npm run check and
npm run build. Update the acceptance matrix and todo only with exact evidence; do not claim
emulator, SMTP, attachment, or production verification without actually running it.
```
