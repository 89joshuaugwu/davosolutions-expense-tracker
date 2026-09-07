# Security foundation

This application uses a dedicated Firebase project. Never copy the Ads Manager's service-account file, private keys, SMTP credentials, Firebase environment, production database, or user profiles. Its assets are a visual reference only.

## Request boundary

The browser uses Firebase only for email/password sign-in and password-reset email. `src/lib/firebase/client.ts` uses in-memory authentication persistence, exchanges a fresh ID token at `POST /api/auth/session`, and clears Firebase client state. The resulting `davo_session` cookie is HttpOnly, SameSite=Strict, Secure in production, scoped to `/`, and expires after five days. Login does not accept a redirect destination.

The session endpoint requires the exact `Origin` configured by `APP_URL`, including scheme and port. Missing, opaque, sibling-domain, and lookalike origins are rejected. POST additionally requires JSON and limits the streamed request body to 16 KiB. The ID token must pass Firebase revocation/disabled-account verification and represent a sign-in in the last five minutes. Refreshing an old ID token does not qualify as a fresh sign-in. Never derive the trusted origin from request Host headers. Production `APP_URL` must use HTTPS; development permits loopback HTTP.

`getSessionUser()` verifies the cookie with revocation checks and reads the current `users/{uid}` profile on every call. Roles and account status are never taken from browser state or cached custom claims. Missing, malformed, or deactivated profiles fail closed. `requireUser()` and `requireSuperAdmin()` are page wrappers; services and route handlers should call `getSessionUser()` and return appropriate 401/403 responses. There is no demo authentication bypass. With no configuration, public setup guidance is available and no protected financial data can be read.

`DELETE /api/auth/session` uses the same origin restriction and removes the current browser cookie. It does not revoke other devices' sessions. Invalid/expired/deactivated sessions can still be cleared. A backend audit outage currently causes a valid-session logout to return 503; the cookie is retained so the action can be retried. Add durable audit delivery and an unconditional cookie-clearing strategy before production if this availability tradeoff is unacceptable. Account deactivation is immediately enforced by fresh profile checks; future role management should additionally revoke Firebase refresh tokens.

The pattern follows [Firebase server session guidance](https://firebase.google.com/docs/auth/admin/manage-cookies). Password reset responses in the interface must be neutral: “If an account exists for this email, you will receive reset instructions.” Enable Firebase email-enumeration protection and configure authorized domains and email templates in the dedicated project.

## Authorization contract

`src/lib/auth/model.ts` is the canonical user model. Roles are `super_admin` and `secretary`; statuses are `active` and `deactivated`. UID is taken from verified Firebase identity and the Firestore document ID. New Secretary permissions default to false: `viewSalaries`, `viewTransport`, `viewBills`, and `viewOperationalTotals`. General expense visibility defaults to the user's own submissions or explicit assignments.

Operational records expose `{ id, kind, createdBy, visibleToUserIds }` to the pure permission helpers. A Secretary needs both the relevant view permission and ownership or `visibleToUserIds` membership for salary, transport, and bill details. Salary entry remains allowed without permission to browse salary history. Every active account may create operational entries; only Super Admins may correct/archive submitted records. Operational totals must aggregate only authorized records even when enabled. Company revenue, profit, margin, opening funds, balances, rates, exports, users/settings administration, and audit history always require Super Admin.

`canAccessRoute()` controls navigation convenience; it is not a server security boundary. Each future query, mutation, attachment download, export, scheduled job, and server action must explicitly authorize. Do not fetch a full company collection and rely on UI filtering. For Secretary lists, issue scoped owner and assignment queries (or a validated OR query), de-duplicate IDs, authorize the kind, and paginate without exposing aggregate company counts. Check every returned record again and project a safe DTO. Create `createdBy` and visibility metadata on the server; a client must not assign itself or others to records. Updates must re-read the profile and record inside the Firestore mutation transaction so concurrent role revocation or record changes trigger a transaction retry.

## Database, storage, and audit

`firestore.rules` and `storage.rules` deny every direct client read/write, including signed-in users and administrators. The Next.js server is the only data interface. The [Firebase rules documentation](https://firebase.google.com/docs/firestore/security/rules-conditions) explains that server libraries bypass rules and use IAM; consequently, these rules do not protect against mistakes in an authorized server service. Keep Admin SDK imports in server-only modules and restrict its service account's IAM permissions.

`appendAuditInTransaction(transaction, event)` creates a new `auditLogs` document and never overwrites an existing one. Every financial mutation must write its audit entry in the same Firestore transaction. `appendAudit()` is only for standalone events. Audit corrections/archives/recalculations require a reason and before/after snapshots; credential-shaped fields are rejected from JSON snapshots. These helpers do not authorize their callers. Snapshot fields must be explicitly selected: never pass unfiltered request bodies, auth SDK objects, or environment objects. Arbitrary text can still contain secrets, so the field-name filter is defense in depth rather than a complete redaction system.

Successful login, authenticated logout, and denied logins for verified identities with unusable profiles are audited. Invalid credentials rejected by the Firebase browser SDK, invalid/unverified tokens, password-reset requests, and infrastructure failures are not currently persisted to the app audit collection. Complete the authentication-event strategy and abuse monitoring before production without storing passwords, raw tokens, session-cookie values, or sensitive request bodies.

“Append-only” currently means application-enforced. A principal with privileged Admin SDK/IAM access can modify or delete audit documents. Production immutability needs restricted administrative access, monitored cloud audit events, backups/retention, and an independent retention-protected audit destination if tamper resistance is required. Do not claim this foundation provides physical or cryptographic immutability.

Attachment storage remains unselected. Do not enable public Cloudinary URLs or Firebase download tokens for private salary/financial evidence. Define private uploads, MIME/size validation, malware handling, authorization on download, retention, and orphan cleanup in the attachment phase. `firestore.indexes.json` is deliberately empty; add indexes for concrete authorized queries as features are implemented.

## First administrator

1. Create the separate Firebase project and enable email/password Auth plus Firestore. Create the intended administrator account in that project's Firebase Authentication console.
2. Populate this app's `.env.local` from `.env.example` with its own public config and server credentials. Keep private values out of source control.
3. Run `npm run bootstrap:admin -- --uid FIREBASE_AUTH_UID --project DEDICATED_PROJECT_ID` from `expense-tracker`. This validates the account and performs a dry run; it never creates an Auth account.
4. After reviewing the project and UID, rerun with `--apply`. The script atomically creates the user profile, bootstrap marker, and audit entry. It refuses existing user profiles, existing Super Admins, repeated bootstrap, and emulator targets. It never prints credentials.
5. Use the application login. Additional invitations and role changes are later administration work; never add an automatic “first login becomes admin” path.

The user's supplied dedicated Firebase web configuration and service-account file have been organized into this app's local environment, with matching project IDs and a parseable private key verified locally. No credentials were created remotely, no first user has been granted access, and no Firebase rules or app deployment has been performed by this foundation setup. See `environment.md`.

## Verification and release gaps

`npm test` includes pure role/visibility, deactivation, origin, recent-login, and audit-validation tests. They do not prove route-handler integration or deployed security. `tests/security/rules.emulator.test.ts` explicitly skips without both Firestore and Storage emulator hosts. With Java and Firebase CLI installed, run `firebase emulators:exec --project demo-davo-expenses --only firestore,storage "npm test"`; inspect that this test passes rather than skips. Use only the `demo-` project for those tests.

Before release add integration tests covering forged/expired/revoked cookies; disabled Auth users; role changes between requests; authorization during concurrent mutations; missing profiles; salary ID enumeration; restricted query results and CSV exports; CSRF rejection; cookie flags; failed audit writes; and bootstrap races. Test actual protected pages with both roles. Add deployment-level rate limiting for login/session/reset abuse, operational alerting, a reviewed CSP compatible with Firebase, and authenticated error monitoring without personal financial data. Secrets configuration, IAM review, emulator runs, and deployed smoke tests are release gates rather than work already completed.
