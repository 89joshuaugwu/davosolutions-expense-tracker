# Financial model and implementation contract

The pure domain foundation is implemented in `src/domain/`. It does not connect to Firebase or authorize a request. Treat the following as the contract for subsequent server-side persistence and reporting work.

## Exact amounts and historical currency

- Persist monetary values as **safe integer minor units**. NGN, USD, GBP, and EUR explicitly use two decimal places in v1: ₦30.00 is `3000`.
- Pass decimal **strings** from forms to `parseAmountToMinor`; never call `Number`, `parseFloat`, multiply a JavaScript decimal by 100, or silently round user input. Signed amounts, scientific notation, separators, whitespace, zero financial events, and more than two decimal places are rejected. Opening funds and individual transport components may explicitly allow zero.
- Admin exchange rates are positive decimal strings with at most 12 fractional digits. The direction is **base-currency major units per one original-currency major unit**. Same-currency records must use a rate equal to 1.
- Conversion uses `BigInt` multiplication/division and rounds **once**, half-up, to the base minor unit. Transport components are summed in the original currency before conversion.
- Every monetary record keeps `originalAmountMinor`, `currency`, `baseCurrency`, `exchangeRateSnapshot`, `rateDate`, and `baseAmountMinor`. Dates are business calendar dates (`YYYY-MM-DD`); timestamps are UTC ISO strings in domain DTOs and converted at the Firestore repository boundary.
- The USD 30 × NGN 1,600 scope example becomes original `3000`, rate `"1600"`, base `4800000`, displayed as ₦48,000.00. A later rate change never modifies that snapshot.
- `assertMoneySnapshot` detects inconsistent stored conversion results. A recalculation requires an explicit admin correction, reason, audit before/after values, and an atomic posting update.
- Large valid values format through integer/string arithmetic, so the final minor unit remains intact. Values or aggregate results outside the safe-integer range fail rather than lose precision.

## A single source for reporting

`ledgerEntries` is the only source for aggregate spending and revenue. Source registers retain the record details, attachments, visibility, and history; they must not be added to ledger totals again.

| Business event | Source collection | Posting ID | Report date |
| --- | --- | --- | --- |
| General/other expense | `expenses` | `expense:<recordId>` | expense date |
| Paid salary | `salaryLogs` | `salary:<recordId>` | payment date |
| Daily transport | `transportLogs` | `transport:<recordId>` | transport date |
| Bill payment | `billPayments` | `bill_payment:<paymentId>` | payment date |
| Revenue received | `revenue` | `revenue:<recordId>` | revenue date |

Use `postingForExpense`, `postingForSalary`, `postingForTransport`, `postingForBillPayment`, and `postingForRevenue`. `createLedgerPosting` is the lower-level validated constructor. Never create an extra general-expense document for a salary, transport log, or bill payment. The scope's bill “expense entry” is its canonical ledger expense posting.

`calculateFinancialSummary({ month, baseCurrency, openingFundMinor, postings })` validates each posting, rejects duplicate source IDs, excludes archived rows and other months, and rejects mixed historical base currencies in the selected reporting month. It returns:

```text
totalExpensesMinor          = all active expense postings
totalRevenueMinor           = all active revenue postings
netProfitMinor              = revenue - expenses
remainingOpeningFundMinor   = opening fund - expenses
closingBalanceMinor         = opening fund + revenue - expenses
profitMarginPercent         = (net profit / revenue) × 100, or null if revenue = 0
```

Margin is rounded to two decimal places for presentation and must never be used to derive money. Render `null` as `N/A`. Negative profit and balances are valid; opening funds are not revenue. This aggregator is a server/admin utility and does not make its result safe for secretary clients.

## Pending salaries and recurring bills

**Provisional policy to confirm before salary workflows are released:** use a cash basis. Pending salaries create no posting; the paid transition creates exactly one posting and belongs to the payment month, even when the salary period is an earlier month. Pending records may have a null payment date; paid records require a real date. If accrual accounting is selected, revise the policy, implementation, tests, and reporting language together.

A bill definition describes an expected amount and schedule. It does not snapshot a payable cash amount or post an expense. At payment time, use the effective trusted rate and create a `billPayments` record plus posting and audit entry atomically. `billPaymentId(billId, occurrenceDate)` produces `billId__YYYY-MM-DD`. Retries for the same scheduled occurrence must reuse that ID and return the previously committed result. V1 allows one full payment per occurrence; partial payments require an explicit design change. Payment date and scheduled occurrence date are separate.

Reminder jobs read schedules and write notification-delivery state/audit activity only. They never create payments or ledger expenses. Upcoming/due-today/overdue/paid presentation is derived from the occurrence due date and payment history, not from the bill definition's active/paused/completed lifecycle status.

## Monthly funds and base-currency lock

`monthlyFundId(month)` validates a canonical `YYYY-MM` document ID. There is one allocation per month. Use a transaction to reject duplicate creation; updating it requires a reason and before/after audit values. Do not silently carry a closing balance into the next month. A missing allocation is distinguishable from an explicitly configured zero allocation in the UI, even if the summary receives zero for both.

Keep the base currency locked from the **first monetary record**, including opening funds and pending salary records. Set `settings/company.baseCurrencyLockedAt` in the same transaction that writes the first such record. `assertBaseCurrencyChangeAllowed` is a pure guard; it depends on a trustworthy server-derived history flag. Changing a locked base requires a separately designed audited migration or new ledger, never a normal settings update or a relabel of existing totals.

## Required persistence invariants for the next phase

1. Read the current active user and enforce authorization before reading financial records. Construct secretary response projections explicitly; do not return admin totals, revenue, funds, rate-management data, or unauthorized salary records.
2. Validate form payloads with strict runtime schemas. These TypeScript DTOs are contracts, not request validation. Derive actor, timestamps, revision, visibility, rate, base amount, posting ID, and audit values on the server. A client-supplied converted amount or FX rate is never authoritative.
3. Persist a financial source, its single canonical posting, the immutable audit entry, and any first-record base lock in **one Firestore transaction**. Bill occurrence creation must check the deterministic payment ID. Do not rely on disabling a button for idempotency.
4. Corrections require an admin role, meaningful reason, expected revision, and source/posting/audit update in one transaction. Preserve the old money snapshot unless the admin specifically requests audited FX recalculation. Soft archive/restore must update the source and posting together. Never provide an application endpoint to update or delete an audit entry.
5. Use per-record `visibleToUserIds` for explicit assignment, controlled by the admin. User permissions from `src/lib/auth/model.ts` are the canonical authorization contract.
6. Attachments remain private references (`storageKey`, metadata) until storage is selected. Check the requesting user's access to the parent record before issuing a short-lived read URL. Resolve upload authorization, content/size validation, and abandoned-upload cleanup before implementing uploads.
7. A pending salary with no posting is valid. If an admin reverses paid to pending, archive its existing posting in the same correction transaction; do not leave the paid expense counted. Preserve canonical IDs when paying it again.
8. Apply date-range filters and indexed Firestore queries at the repository boundary. These helpers intentionally do not guess a UTC date from a browser timezone. Use the company's configured timezone for “today” and reminder jobs.

## Verification already present

`tests/domain/money.test.ts`, `dates.test.ts`, and `ledger.test.ts` contain 18 passing tests for the scope FX example, exact parsing and rounding, safe limits and large-value formatting, leap days/month IDs, tampered snapshots, correct fund/profit separation, no-revenue margin, archive/month filtering, duplicate sources, mixed base currencies, pending salaries, transport conversion, deterministic bill payment links, and base-currency locking. They run under the repository `npm test` command with Node's test runner via `tsx`.

These are pure domain tests. They do not prove Firebase transaction atomicity, server authorization, storage access, reminder delivery, or deployment readiness; those have dedicated later acceptance work in `todo.md`.
