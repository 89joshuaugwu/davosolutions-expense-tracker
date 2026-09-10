# Bootstrapping the First Administrator

Because this application enforces strict role-based access control and does not support open registration or "first-user-gets-admin" shortcuts, the initial Super Admin account must be provisioned securely from the server side. 

Follow these exact steps to set up your first admin account.

## Prerequisites

1. Your Firebase project must be created and fully configured in `expense-tracker/.env.local`.
2. Firebase Authentication (Email/Password) must be enabled in the Firebase Console.
3. Firestore must be provisioned.

## Setup Steps

### 1. Create the user in Firebase Authentication
Go to the **Authentication** section of your Firebase Console. 
Click **Add user**, and manually create an account with an email and password.

Once created, copy the **User UID** string that Firebase generated for this user.

### 2. Verify with a Dry Run
Open a terminal in the `expense-tracker` directory.
Run the `bootstrap:admin` script using your copied UID and your Firebase Project ID (found in `.env.local` as `FIREBASE_PROJECT_ID`).

```bash
npm run bootstrap:admin -- --uid YOUR_FIREBASE_AUTH_UID --project YOUR_PROJECT_ID
```
*(Example: `npm run bootstrap:admin -- --uid cBr00394rkdGF3klJvIKuyN1q7o2 --project davosolutions-espense-tracker`)*

This performs a safe, read-only validation check to ensure the UID is valid and hasn't already been provisioned.

### 3. Apply the Changes
If the dry run reports success, re-run the exact same command, but append the `--apply` flag.

```bash
npm run bootstrap:admin -- --uid YOUR_FIREBASE_AUTH_UID --project YOUR_PROJECT_ID --apply
```

This will atomically create the required `users/{uid}` profile document granting the `super_admin` role, mark the bootstrap as complete, and log a secure audit entry. 

### 4. Log in
You can now start the application (`npm run dev`), navigate to `http://localhost:3000/login`, and sign in using the email and password you created in Step 1.
