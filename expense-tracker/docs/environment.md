# Environment and external services

The scope requires Firebase Authentication, Cloud Firestore, Vercel, email reminders through SMTP, and private receipt storage. The user has selected **Cloudinary for images, PDFs and documents**, while Firebase remains the authentication/database service. Firebase Storage is not required for this implementation. Recharts runs locally in the app and needs no API key. Exchange rates are entered by the Super Admin in v1, so no currency API is required. No bank, payment-provider, AI, or Ads Manager integration is needed.

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

## Cloudinary configuration — selected and verified

The supplied credentials and preset are stored only in ignored `.env.local`. `src/lib/cloudinary/config.ts` validates them; `src/lib/cloudinary/server.ts` provides a lazy server-only configuration loader. The local environment check validates all five values without contacting Cloudinary. No client component should receive the API secret or signed upload parameters before application authorization.

On 7 September 2026, `npm run cloudinary:check` made a read-only request to the official Cloudinary Admin API. Credentials were accepted and the exact configured preset exists. It currently reports **unsigned** and does **not** set authenticated delivery. No preset was changed and no files were uploaded. This verifies account access, not private upload/download behavior.

The E4 implementation must use signed server uploads and explicitly set `type=authenticated`. Configure the dedicated preset as signed-only before enabling it for financial evidence. Authorize downloads against the parent record before issuing short-lived private downloads or proxying content. A normal signed CDN URL is not automatically an expiring URL. Cloudinary documents [authenticated media and time-limited private downloads](https://cloudinary.com/documentation/control_access_to_media) and [signed preset parameter precedence](https://cloudinary.com/documentation/upload_presets).

Store images as image assets. Plan to store PDFs and office documents as raw original evidence (including the extension in their public ID) rather than converting or publishing their content. Test representative file types and the account's PDF/document delivery settings during E4; Cloudinary notes [PDF delivery restrictions on free accounts](https://support.cloudinary.com/hc/en-us/articles/20970529312146-How-to-Upload-Manage-and-Deliver-PDF-Files). Never enable public receipt delivery to work around a restriction.

## Variables for attachments and later integrations

| Variable | Required when | Notes |
|---|---|---|
| `ATTACHMENT_PROVIDER` | Set now | `cloudinary`, selected by the user. |
| `FIREBASE_STORAGE_BUCKET` | Unused | Retained if imported from Firebase web config; no Firebase Storage calls or bucket setup needed for attachments. |
| `CLOUDINARY_CLOUD_NAME` | Set now | The supplied Cloudinary product environment; keep evidence under a dedicated app prefix. |
| `CLOUDINARY_UPLOAD_PRESET` | Set now | The supplied preset name; existence verified. Signed-only/private configuration remains an E4 task. |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Set now | Server-only values for signed uploads/API access; never prefix with `NEXT_PUBLIC_`. Upload/download endpoints are not yet implemented. |
| `SMTP_HOST`, `SMTP_PORT` | Reminder email phase | Obtain SMTP settings from Davo's mail hosting administrator/cPanel. |
| `SMTP_SECURE` | Reminder email phase | `true` for implicit TLS, normally port 465; `false` for STARTTLS, normally port 587. Require TLS in the future transporter. |
| `SMTP_USER`, `SMTP_PASS` | Reminder email phase | Server-only sender mailbox credentials. |
| `SMTP_FROM` | Reminder email phase | A verified sender address/name allowed by that mailbox. |
| `CRON_SECRET` | Scheduled reminders phase | Generate a sufficiently random server secret. Require the scheduler's bearer token and persist reminder idempotency keys. Never expose it to the browser. |

Reminder recipients, lead days (7/3/1), company timezone (`Africa/Lagos`), fiscal-year start, categories, manual FX rates, and default currency (`NGN`) are company settings stored in Firestore, not secrets or environment variables. The source tree includes SMTP reminder and cron-route code, but no controlled delivery, scheduler, or production evidence is recorded. Firebase currently sends password-reset links itself; SMTP is used by the reminder workflow.

## Local setup utilities

`npm run env:check` reports **only variable names/status**, syntax/configuration issues, and whether client/server projects agree. It does not authenticate with Firebase or prove the credentials work remotely.

`npm run cloudinary:check` makes one authenticated **read-only** request to the official Cloudinary Admin API for the configured preset. It prints only the success/status and preset access mode, never credentials or raw provider errors. It uploads nothing and changes no account settings. Rerun only when configuration changes or an integration check needs it.

`node scripts/prepare-env.mjs --service-account ./YOUR-DEDICATED-firebase-adminsdk.json` organizes an existing local file, imports a quoted Firebase web config pasted into it, and fills matching Admin values from the explicitly named JSON. It never evaluates JavaScript, never contacts Firebase, and never reads the sibling app. The original `.env.local` is retained once as `.env.local.before-setup` (also ignored). Review local values after importing; do not run this tool against unrelated projects.

Do not commit the JSON or `.env.local.before-setup`. The application uses environment variables, not a hardcoded service-account file path. Deploying rules, provisioning users, sending emails, and changing DNS are separate implementation steps.

Implementation references: [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), and [Firebase rules/server libraries](https://firebase.google.com/docs/firestore/security/rules-conditions#authentication).
