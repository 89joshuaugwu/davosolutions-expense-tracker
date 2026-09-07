# Environment and external services

The scope requires Firebase Authentication, Cloud Firestore, Vercel, email reminders through SMTP, and private receipt storage. Recharts runs locally in the app and needs no API key. Exchange rates are entered by the Super Admin in v1, so no currency API is required. No bank, payment-provider, AI, or Ads Manager integration is needed.

Copy `.env.example` to `.env.local` for a new checkout. This file and service-account JSON files are ignored by Git. Never paste private values into source, screenshots, issue descriptions, or the handoff. The sibling Ads Manager uses a different Firebase project and its credentials must not be mixed with this app.

## Used by the current foundation

| Variable | Where to obtain it | Purpose |
|---|---|---|
| `APP_URL` | `http://localhost:3000` locally; `https://expenses.davosolutions.com` in production | Exact allowed origin for session mutations. Use HTTPS for a production build. No trailing path, credentials, or query parameters. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project settings → General → this web app's config | Firebase browser authentication identifier. Restrict the key appropriately in Google Cloud. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same web configuration | Email/password and reset authentication configuration. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same web configuration | Must exactly match the server project ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same web configuration | Identifies the registered web app. |
| `FIREBASE_PROJECT_ID` | Dedicated Firebase service-account JSON: `project_id` | Server project. |
| `FIREBASE_CLIENT_EMAIL` | JSON: `client_email` | Server service-account identity. |
| `FIREBASE_PRIVATE_KEY` | JSON: `private_key` | Server private key. Use a quoted single line with escaped `\n`; the Admin loader restores newlines. Never prefix this with `NEXT_PUBLIC_`. |

Web Firebase configuration values identify the project; they do not replace authorization. All direct browser Firestore and Storage access is denied in the checked-in rules. The server verifies sessions and current active profiles before accessing data.

Firebase console setup remains necessary: register the web app, enable Email/Password sign-in, configure authorized domains (localhost and the final product domain), configure reset-email templates/action URLs, create Firestore, and deploy the rules. Create the initial administrator identity through a trusted process and run the documented bootstrap CLI. Having keys does not provision an active application user.

Next.js embeds `NEXT_PUBLIC_*` values at build time. Rebuild after changing them on Vercel. Server-only settings are runtime secrets. Keep separate Vercel Development/Preview/Production values and exact `APP_URL` origins. Do not authorize arbitrary request origins to make preview deployments work.

## Reserved for later scope phases — not active integrations

| Variable | Required when | Notes |
|---|---|---|
| `ATTACHMENT_PROVIDER` | Private receipt storage phase | Choose `firebase_storage` or `cloudinary`; blank until provider is confirmed. |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage selected | The dedicated project's bucket ID, taken from its web configuration. Keep private; authorized server delivery only. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary selected | Existing Davo account can be used only after confirming private document delivery and a separate asset folder. |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary selected | Signed server uploads and private/authenticated assets. Do not reuse a public unsigned upload preset for receipts. |
| `SMTP_HOST`, `SMTP_PORT` | Reminder email phase | Obtain SMTP settings from Davo's mail hosting administrator/cPanel. |
| `SMTP_SECURE` | Reminder email phase | `true` for implicit TLS, normally port 465; `false` for STARTTLS, normally port 587. Require TLS in the future transporter. |
| `SMTP_USER`, `SMTP_PASS` | Reminder email phase | Server-only sender mailbox credentials. |
| `SMTP_FROM` | Reminder email phase | A verified sender address/name allowed by that mailbox. |
| `CRON_SECRET` | Scheduled reminders phase | Generate a sufficiently random server secret. Require the scheduler's bearer token and persist reminder idempotency keys. Never expose it to the browser. |

Reminder recipients, lead days (7/3/1), company timezone (`Africa/Lagos`), fiscal-year start, categories, manual FX rates, and default currency (`NGN`) are company settings stored in Firestore, not secrets or environment variables. They still require implementation and validation. No SMTP code or cron schedule is enabled by this foundation. Firebase currently sends password-reset links itself; SMTP is for later bill reminders/invitations if selected.

## Local setup utilities

`npm run env:check` reports **only variable names/status**, syntax/configuration issues, and whether client/server projects agree. It does not authenticate with Firebase or prove the credentials work remotely.

`node scripts/prepare-env.mjs --service-account ./YOUR-DEDICATED-firebase-adminsdk.json` organizes an existing local file, imports a quoted Firebase web config pasted into it, and fills matching Admin values from the explicitly named JSON. It never evaluates JavaScript, never contacts Firebase, and never reads the sibling app. The original `.env.local` is retained once as `.env.local.before-setup` (also ignored). Review local values after importing; do not run this tool against unrelated projects.

Do not commit the JSON or `.env.local.before-setup`. The application uses environment variables, not a hardcoded service-account file path. Deploying rules, provisioning users, sending emails, and changing DNS are separate implementation steps.

Implementation references: [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), and [Firebase rules/server libraries](https://firebase.google.com/docs/firestore/security/rules-conditions#authentication).
