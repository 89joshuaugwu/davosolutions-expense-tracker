# Davo Solutions Expense Tracker: Operator Manual

Welcome to the Davo Solutions Expense Tracker administration guide. This document outlines the standard operational procedures for maintaining accurate financial records, managing staff access, and interpreting reports.

## 1. Access & Role Management

**Inviting Staff**
- Navigate to the **Users** tab.
- Click **Invite User** and provide their email address.
- Select their role (`Super Admin` or `Secretary`).
- For Secretaries, configure explicitly which data types they are allowed to view (e.g., Salaries, Transport, Bills).
- Users sign in with the configured Firebase Email/Password account. Their active role and permissions are rechecked on the server.

**Account Recovery & Deactivation**
- To revoke access, a Super Admin can change a user's role to **Inactive**.
- Active sessions are automatically rejected on the next request.
- **Limitation**: At least one active Super Admin must always exist. If all Super Admins are removed, manual database intervention using the Google Cloud Console (Firebase) is required.

## 2. Financial Configuration

**Exchange Rates**
- Super Admins must configure the system Base Currency and operational exchange rates from **Settings > Exchange Rates**.
- **Important**: Changing a rate applies only to *future* transactions. Historical entries retain the exact snapshot of the rate applied at the time of creation.

**Monthly Fund Allocation**
- A new month requires a **Monthly Fund** allocation (Monthly Funds).
- Set the Opening Balance for the given month. This ensures that remaining funds and dashboards calculate margin accurately.

## 3. Daily Operations & Corrections

**Entering Expenses & specialized records**
- Staff can record General Expenses, Transport Logs, and Bill Payments.
- A single Canonical Ledger entry is created for every specialized log to prevent duplicate counting.

**Corrections**
- If an expense was entered incorrectly, it cannot be edited or silently deleted.
- Instead, use the **Archive** action.
- Provide a clear **Reason** (mandatory).
- Archiving an expense reverses its impact on the ledger and generates an immutable Audit Log event. You can then submit a new, corrected expense.

**Pending Salary Interpretation**
- Salaries are recorded on a defined schedule. 
- A "Pending" salary represents a planned obligation and does **not** deduct from the remaining funds or profit. 
- Once explicitly marked as **Paid**, the system posts the transaction to the ledger and deducts the amount.

**Bill Payments & Reminders**
- Recurring bills generate upcoming occurrences based on their recurrence schedule.
- The system automatically emails authorized recipients at 7-day, 3-day, and 1-day lead times.
- Paying a bill occurrence records the transaction exactly once, even if multiple staff attempt to pay it simultaneously.

## 4. Reports & Accountability

**Audit Trail**
- The **Audit Trail** captures every significant action: logins, role changes, record creations, and corrections.
- You can filter by Action, User, or target collection.
- The trail provides a detailed `Before` and `After` snapshot.

**Data Exports**
- The implemented operational lists and Profit & Loss page provide CSV exports. The dedicated **Reports** Centre is planned and must not be described as available until it is built.
- CSV data can reconcile with the on-screen totals only when both use the same validated period and filters. This remains an acceptance test, not a release claim.

## 5. Cleaning Up Test Data

Before fully transitioning to production, you may want to remove staging/test records.
- **Do not** truncate production collections or manually delete documents via the Firebase Console without understanding the ledger implications.
- The approved process is to use the UI's **Archive** feature on all test expenses. This leaves an auditable trail that the test data was correctly reversed, and resets the financial totals to zero perfectly.
- Alternatively, you can use a clean, separate Firebase project for true production to ensure total segregation from staging data.
