# Davo Solutions — Expenses & Profit Tracker

## Revised Project Scope Document v1.2

**Prepared for:** Boss Havanda X Limited  
**Prepared by:** Development Team  
**Date:** September 4, 2026  
**Approved product URL:** `https://expenses.davosolutions.com`

---

## 1. Executive Summary

Build a secure, standalone internal web application for tracking Davo Solutions' company spending, revenue, monthly funds, profit, bills, salaries, and transportation costs.

The application will:

- Record daily, monthly, yearly, and one-time expenses.
- Provide dedicated salary, transportation, and bill-payment logs.
- Record revenue together with its source.
- Let the Super Admin set the amount available at the beginning of each month.
- Automatically calculate total expenses, remaining funds, net profit/loss, and closing balance.
- Convert foreign-currency entries into the company's default dashboard currency using exchange rates set by the Super Admin.
- Display real-time financial charts and revenue-source performance.
- Maintain an immutable audit trail of all activity.
- Restrict revenue, profit, monthly funds, exchange rates, and other sensitive financial information to the Super Admin.

This is a separate internal tool and will not be part of the existing Ads Manager.

---

## 2. Roles and Access Control

### 2.1 Roles

| Role | Responsibility |
|---|---|
| **Super Admin** | Full system control. Can view and manage all financial information, including revenue and profit; set monthly opening funds and exchange rates; correct expense records; manage users, categories, reminders, settings, and audit logs. |
| **Sub Admin / Secretary** | Operational data-entry role. Can log general expenses, workers' salaries, transportation, and bills and view only the non-sensitive records/pages assigned to the role. Cannot view company revenue, profit, opening funds, remaining balance, or sensitive management charts. |

The Super Admin can assign or revoke roles. A user can access revenue and profit information only when explicitly assigned the **Super Admin** role.

### 2.2 Permissions Matrix

| Action | Super Admin | Sub Admin / Secretary |
|---|:---:|:---:|
| Log general expense | Yes | Yes |
| Log workers' salary | Yes | Yes |
| Log morning/evening transport | Yes | Yes |
| Log bill payment | Yes | Yes |
| Edit or delete an expense/log | Yes, with mandatory reason | No |
| View submitted expense records | Yes | Assigned operational records only |
| Log revenue and revenue source | Yes | No |
| View revenue, profit/loss, margin, or remaining funds | Yes | No |
| Set monthly opening funds | Yes | No |
| Set default currency and exchange rates | Yes | No |
| View management dashboard and revenue charts | Yes | No |
| View audit logs | Yes | No |
| Manage users, roles, categories, and settings | Yes | No |
| Export financial reports | Yes | No |

### 2.3 Record Immutability Rule

- Once a Sub Admin/Secretary submits any expense, salary, transport, or bill record, the submission is final for that user.
- Sub Admins cannot edit or delete submitted records, including their own records.
- Only the Super Admin can correct or delete a submitted financial record.
- Every Super Admin correction or deletion must include a reason and will be recorded in the append-only audit log with the previous and new values.
- A soft-delete/archive approach will be used so deleted financial records remain recoverable and auditable.

---

## 3. Financial Calculation Rules

To prevent double-counting, the system will treat opening funds, revenue, expenses, profit, and balance as separate values.

```text
Total Expenses = General Expenses + Salaries + Transport + Bills + Other Costs
Net Profit/Loss = Total Revenue - Total Expenses
Profit Margin % = (Net Profit / Total Revenue) × 100
Remaining Opening Fund = Opening Fund - Total Expenses
Closing Balance = Opening Fund + Total Revenue - Total Expenses
```

If revenue is zero, profit margin will display as `N/A` instead of dividing by zero. The dashboard will clearly distinguish **Net Profit/Loss** from **Closing Balance**.

---

## 4. Feature Scope

### 4.1 Authentication and Security

- Secure email/password login.
- Password-reset workflow by email/OTP.
- Server-enforced role-based authorization, not interface hiding alone.
- Secure authenticated sessions and automatic unauthenticated redirects.
- Active/deactivated user status.
- Audit logging for authentication, data entry, administrative changes, exports, and settings changes.

### 4.2 Role-Based Dashboards

#### Super Admin Dashboard

The Super Admin dashboard will include:

- Monthly Opening Fund
- Total Revenue
- Total Expenses
- Remaining Opening Fund
- Net Profit/Loss
- Closing Balance
- Profit Margin
- Revenue vs. expenses vs. profit trend
- Expense breakdown by category
- Top expense categories
- Revenue by source chart, highlighting the highest-earning source
- Current default currency and active exchange rates
- Upcoming and overdue bills
- Month-over-month comparison

#### Sub Admin / Secretary Dashboard

This dashboard will focus on permitted operational work:

- Quick actions for general expense, salary, transport, and bill logging
- The user's recent submissions and their status
- Upcoming bill reminders where relevant
- Non-sensitive operational totals only if enabled by the Super Admin

It will not reveal revenue, profit/loss, opening funds, remaining balance, closing balance, profit margin, or revenue-source performance.

### 4.3 General Expense Management

#### Expense Fields

| Field | Type | Required |
|---|---|:---:|
| Title/Description | Text | Yes |
| Amount | Number | Yes |
| Entry Currency | Currency selector | Yes |
| Applied Exchange Rate | Auto-filled rate snapshot | When foreign currency is used |
| Amount in Default Currency | Auto-calculated | Yes |
| Category | Dropdown | Yes |
| Expense Date | Calendar picker | Yes |
| Frequency | One-time / Daily / Monthly / Yearly | Yes |
| Attachment | Image/PDF/document upload | Optional |
| Notes | Text area | Optional |
| Logged By / Time | System generated | Yes |

All entry forms will include an attachment field and notes field to provide clear audit evidence.

#### Expense List

- Search, sorting, pagination, and calendar/date-range filtering.
- Filters for category, currency, frequency, and person who logged it.
- Original amount, converted amount, exchange-rate snapshot, attachment, notes, and log time available in record details.
- Sub Admin submissions are read-only after saving.
- Super Admin corrections require a reason and create an audit entry.

### 4.4 Workers' Salary Log

A dedicated salary register will allow the Secretary or Super Admin to record salaries.

| Field | Required |
|---|:---:|
| Worker name or employee reference | Yes |
| Salary period/month | Yes |
| Amount and currency | Yes |
| Payment date | Yes |
| Payment status (paid/pending) | Yes |
| Attachment/proof of payment | Optional |
| Notes | Optional |

Salary entries count automatically toward monthly expenses. The role permission covers salary logging, but access to detailed salary records can be limited to the Super Admin and specifically authorized Secretary accounts.

### 4.5 Transportation Log

A dedicated daily transportation register will allow the Secretary or Super Admin to record:

- Date
- Morning transport amount
- Evening transport amount
- Optional extra transport amount and reason
- Currency and applied exchange rate
- Daily total, calculated automatically
- Attachment and notes
- Logged-by user and timestamp

Transportation totals count automatically toward expenses and can be filtered by day, week, month, year, or custom period.

### 4.6 Bills and Subscription Management

The system will include a dedicated category/register for recurring and one-time bills such as subscriptions, utilities, rent, and service payments.

| Field | Required |
|---|:---:|
| Bill name | Yes |
| Category/provider | Yes |
| Amount and currency | Yes |
| Frequency | Yes |
| Next due date | Yes |
| Reminder lead time | Yes |
| Responsible person | Optional |
| Payment status | Yes |
| Attachment/receipt | Optional |
| Notes | Optional |

- Email reminders will be sent to the Super Admin before a due date, using a configurable lead time such as 7, 3, or 1 day before payment.
- The dashboard will show upcoming, due-today, overdue, and paid bills.
- Recording a bill as paid creates an expense entry while retaining its payment history.
- Repeated reminders must not create duplicate expenses.

### 4.7 Monthly Fund Management

At the beginning of each month, the Super Admin can enter the amount allocated or available to start that month.

| Field | Required |
|---|:---:|
| Month | Yes |
| Opening fund amount | Yes |
| Currency | Yes |
| Funding source/reference | Optional |
| Attachment | Optional |
| Notes | Optional |

The month-end summary will calculate and display:

- Opening Fund
- Revenue Earned
- Total Spent
- Remaining Opening Fund
- Net Profit/Loss
- Closing Balance

Only the Super Admin can create, view, or modify monthly fund records. Any modification is audited.

### 4.8 Revenue Management

Only the Super Admin can log, view, edit, delete, or export revenue.

| Field | Required |
|---|:---:|
| Revenue date/period | Yes |
| Revenue source | Yes |
| Description/reference | Yes |
| Original amount | Yes |
| Currency | Yes |
| Applied exchange rate | When foreign currency is used |
| Amount in default currency | Auto-calculated |
| Attachment/evidence | Optional |
| Notes | Optional |

The Super Admin dashboard will include a live revenue-by-source chart and ranking showing which source generates the highest revenue for the selected period.

### 4.9 Currency and Exchange-Rate Management

- The Super Admin selects one default/base currency for dashboard totals, initially expected to be Nigerian Naira (NGN/₦).
- Each expense and revenue record may be entered in another enabled currency, such as USD.
- The system converts it into the default currency using the rate configured by the Super Admin.
- Every transaction stores the original currency, original amount, applied rate, converted amount, and rate date.
- Historical records retain the rate used when they were logged; changing today's rate will not silently change past reports.
- The Super Admin may intentionally recalculate a record, but the action requires a reason and is audited.
- Reports and dashboard totals use the default currency for consistent comparison.

Example: if USD 30 is logged and the Super Admin's USD-to-NGN rate is ₦1,600, the dashboard amount is ₦48,000 while the record retains the original USD 30.

### 4.10 Calendar and Filters

Calendar/date filters will be available on all relevant pages, supporting:

- Specific date
- Date range
- Month and year
- Today, this week, this month, last month, this quarter, and this year
- Category, revenue source, currency, payment status, and logged-by filters

### 4.11 Audit Log

The audit log is append-only and accessible only to the Super Admin. It will capture:

- User, action, affected record, date/time, and IP/session metadata where available
- Financial record creation
- Before/after values for administrative corrections
- Mandatory reason for edits, deletions, and exchange-rate recalculation
- User/role changes
- Monthly fund and exchange-rate changes
- Bill reminders and payment-status changes
- Authentication and report-export activity

Audit records cannot be edited or deleted through the application.

### 4.12 User and Settings Management

The Super Admin can:

- Invite, activate, deactivate, and manage users.
- Assign Super Admin or Sub Admin/Secretary roles.
- Configure categories and revenue sources.
- Configure company details, logo, fiscal-year start, default currency, enabled currencies, and rates.
- Configure bill-reminder recipients and lead times.
- Configure which operational records a Secretary account may view.

### 4.13 Reports and Exports

Super Admin reports will include:

- Monthly profit and loss
- Monthly fund utilization
- Expenses by category
- Salary report
- Morning/evening transportation report
- Bills and due-date report
- Revenue by source
- Currency conversion details
- Audit trail

Reports can be filtered and exported to CSV. PDF export can be included during final polish if required.

---

## 5. Pages and Navigation

| Page | Suggested Route | Access |
|---|---|---|
| Login | `/login` | Public |
| Operational Dashboard | `/dashboard` | All authenticated users; content varies by role |
| Expenses | `/expenses` | All; role-filtered |
| Add Expense | `/expenses/new` | All |
| Salary Log | `/salaries` | Super Admin and authorized Secretary |
| Transport Log | `/transport` | Super Admin and authorized Secretary |
| Bills & Reminders | `/bills` | Super Admin and authorized Secretary |
| Monthly Funds | `/monthly-funds` | Super Admin only |
| Revenue | `/revenue` | Super Admin only |
| Profit & Loss | `/profit-loss` | Super Admin only |
| Reports | `/reports` | Super Admin only |
| Audit Log | `/audit-log` | Super Admin only |
| Users | `/users` | Super Admin only |
| Settings | `/settings` | Super Admin only |

---

## 6. Core Data Model

| Collection | Purpose | Important Fields |
|---|---|---|
| `users` | Accounts and authorization | name, email, role, permissions, status |
| `expenses` | General expense entries | originalAmount, currency, exchangeRateSnapshot, baseAmount, category, date, attachment, notes, createdBy, archivedAt |
| `salaryLogs` | Worker salary records | workerRef, period, amount/currency fields, status, paymentDate, attachment, notes |
| `transportLogs` | Daily transport | date, morningAmount, eveningAmount, extraAmount, total, currency fields, attachment, notes |
| `bills` | Bill definitions and schedules | name, provider, frequency, dueDate, reminderDays, status |
| `billPayments` | Bill payment history | billId, period, amount/currency fields, paidAt, expenseId, attachment, notes |
| `monthlyFunds` | Monthly starting allocations | month, originalAmount, currency fields, baseAmount, source, attachment, notes |
| `revenue` | Restricted income entries | sourceId, date, originalAmount, currency, rate snapshot, baseAmount, attachment, notes |
| `revenueSources` | Revenue categories | name, status, sortOrder |
| `categories` | Expense categories | name, type, status, sortOrder |
| `exchangeRates` | Admin-configured rates | fromCurrency, toCurrency, rate, effectiveFrom, setBy |
| `auditLogs` | Immutable activity history | action, actor, target, before, after, reason, timestamp |
| `settings` | Company configuration | name, logo, defaultCurrency, fiscalYearStart, reminders |

Derived totals will be calculated from transaction records rather than manually duplicated wherever possible.

---

## 7. Technical Approach

| Layer | Plan |
|---|---|
| Framework | Next.js with TypeScript |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Authorization | Server-side role checks plus Firestore Security Rules |
| Hosting | Vercel |
| Styling | Existing Davo design language/custom design system |
| Charts | Recharts |
| Email reminders | Scheduled server job plus Davo SMTP configuration |
| Attachments | Cloudinary or Firebase Storage after storage choice is confirmed |
| Domain | `expenses.davosolutions.com` configured through cPanel DNS and Vercel |

Scheduled reminders must run through a reliable scheduled job; opening the dashboard will not be required for reminder emails to send.

---

## 8. Delivery Phases

| Phase | Deliverables |
|---|---|
| **1. Foundation and Security** | Project setup, authentication, roles, server-side permissions, app shell, database rules, audit foundation |
| **2. Expense Operations** | General expenses, immutable Sub Admin submissions, attachments/notes, categories, filters |
| **3. Specialized Logs** | Salary register, morning/evening transport register, bills and payment history |
| **4. Monthly Funds and Currency** | Opening funds, default currency, exchange-rate snapshots, conversion logic |
| **5. Revenue and Financial Calculations** | Restricted revenue entry, sources, P&L, remaining funds, closing balance |
| **6. Dashboards and Reports** | Role-based dashboards, management KPIs, charts, revenue-source ranking, exports |
| **7. Reminders and Administration** | Email reminders, users, settings, full audit interface |
| **8. Testing and Deployment** | Permission/security tests, calculation tests, responsive QA, Vercel deployment, cPanel DNS setup |

Development begins only after this revised scope is reviewed and approved.

---

## 9. Acceptance Criteria

The first release will be considered ready when:

1. A Sub Admin/Secretary can submit an expense, salary, transport, or bill record but cannot alter it afterward.
2. Only the Super Admin can view or manage revenue, profit, monthly funds, balances, rates, and management reports.
3. Every financial entry supports notes and an optional attachment.
4. Bill reminders are sent before configured due dates and bill payments do not generate duplicate expenses.
5. The Super Admin can set a monthly opening fund and see correct total spent, remaining fund, net profit/loss, and closing balance.
6. Foreign-currency transactions retain their original value and conversion-rate snapshot while dashboards show the default currency.
7. Revenue-source charts correctly identify the highest-earning source for the selected period.
8. All corrections, deletions, rate changes, role changes, and other sensitive events appear in an immutable audit log.
9. Role restrictions are enforced on the server/database layer and verified by tests.
10. The application is deployed successfully at `https://expenses.davosolutions.com`.

---

## 10. Items to Confirm During Implementation

These do not change the approved core scope but should be confirmed before their related phase:

| Item | Suggested Default |
|---|---|
| Firebase project | Separate project for cleaner security and financial-data isolation |
| Default dashboard currency | NGN (₦) |
| Secretary visibility | Own submissions plus explicitly assigned operational records |
| Bill reminder schedule | 7 days, 3 days, and 1 day before due date |
| Attachment storage | Cloudinary, subject to document security requirements |
| Exchange-rate source | Manual rates set by Super Admin for v1 |
| PDF export | Include if required after CSV reports are complete |

---

## 11. Out of Scope for Version 1

- Direct bank or payment-provider integration
- Automatic transaction import or reconciliation
- Live third-party exchange-rate API (v1 uses Super Admin rates)
- Payroll computation, tax, pension, or payslip generation beyond salary logging
- Invoice generation
- Multi-company/tenant support
- Native mobile application
- AI-powered expense categorization
- Multi-step expense approval workflow

---

## 12. Approval

**Status:** Awaiting final scope approval before development begins.

**Approval note:** Approval of this document authorizes implementation of the features and access rules described above. Any additional feature requested afterward will be assessed as a scope change.
