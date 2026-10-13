# DMA Connect — live activation

The implementation is locally testable and the new Firestore indexes have been deployed. New production rules, Functions, photo storage and birthday sender are still pending activation. Existing production member records are preserved.

## Values required from the owner

1. The first Super Admin's Indian mobile number and the district display name. Do not derive the owner from whoever last tested the preview.
2. A Resend account, a verified sender domain and the chosen From address. Store the API key directly in Firebase Secret Manager. Do not put it in chat, Git, an Expo public environment variable or a mobile bundle.
3. Approval to enable Blaze billing for this project. Firebase production phone OTP is charged per SMS; Functions/Storage/Scheduler also require billing. Set an appropriate billing budget/alert. Alerts are notifications, not a hard spending cap.

Project: `dma-connect-foundation`, project number `536704319606`. Firestore database: **`dma-connect`**, Enterprise Native, **`asia-south1`**. Never silently use the `(default)` database. App bundle/package: `org.dmafoundation.connect`.

## Configure services

- Enable Firebase Phone Authentication alongside the existing Email/Password provider. Restrict SMS regions to **India**, since the app accepts Indian mobiles. Keep localhost authorised for development and the production web origin authorised if web is distributed.
- Provision the default Firebase Storage bucket `dma-connect-foundation.firebasestorage.app` in **Mumbai** with public access prevented and Firebase Storage rules. No public photo download tokens are used. Deploy `storage.rules`, which denies direct client reads and writes; the authenticated server proxy is the access path.
- Enable the required Functions, Cloud Run, Artifact Registry, Cloud Build, Eventarc, Pub/Sub, Scheduler and Secret Manager APIs. Firebase deployment checks most of these after billing is enabled.
- Check the function runtime service account has datastore access, Firebase Authentication user management, private object read/write access to the bucket and token-signing access. Custom token creation requires `iam.serviceAccounts.signBlob`; grant `roles/iam.serviceAccountTokenCreator` **on that runtime service account**, not on every account. Do not distribute an Admin service-account key to the app.
- Add a verified sending domain to Resend and the requested DNS records. Resend's `onboarding@resend.dev` test sender cannot serve arbitrary real members. Use a sending-only API key scoped to the chosen domain when available.

```sh
npx --yes firebase-tools@latest functions:secrets:set RESEND_API_KEY --project dma-connect-foundation
```

Enter the key into that command's secure prompt. Copy `functions/.env.example` to `functions/.env.dma-connect-foundation`, replace the example address, and leave this ignored file out of Git. `BIRTHDAY_FROM_EMAIL` is a server parameter; `RESEND_API_KEY` is a secret bound only to the scheduled function.

## Bootstrap the confirmed owner

The setup scripts use Application Default Credentials on production. Authenticate with your own Google account (or the deployment environment's scoped identity); never place that credential in the repository.

```sh
gcloud auth application-default login
npm run bootstrap --prefix functions -- --project dma-connect-foundation --phone +91OWNER_NUMBER --district "CONFIRMED DISTRICT"
```

The first command prints a plan and writes nothing. After checking the phone, district and project:

```sh
npm run bootstrap --prefix functions -- --project dma-connect-foundation --phone +91OWNER_NUMBER --district "CONFIRMED DISTRICT" --apply
```

This creates/reuses the phone identity, seeds eight areas and three cells, and records the central appointment. The user must still sign in using OTP and complete their profile. Existing committees are preserved. A different existing Super Admin is never replaced automatically. Use `--legacy-uid EXISTING_UID` only when the owner explicitly confirms that legacy identity should be retained; the phone is then attached to that same UID.

## Deploy and verify

Run lint, typecheck, unit tests, rule tests and the four-emulator integration suite first. Deploy all new services together during an agreed rollout: the new rules intentionally deny all client writes and the old app cannot continue registering through its old paths after that change.

```sh
npx --yes firebase-tools@latest deploy --only firestore,storage,functions --project dma-connect-foundation
```

- Wait until every declared index is **READY**. Indexes have been deployed, but the local emulator does not prove production index coverage.
- Confirm `dmaApi`, birthday schedule and five Firestore triggers all use **`asia-south1`**; Firestore triggers must point at the named `dma-connect` database.
- Test real phone signup, invitation activation, role boundaries, area+cell approval, private photo upload/retrieval, directory pagination and statistics with agreed test accounts.
- Verify a real recipient email through the app. Run the scheduled job against a consented test member whose birthday is today; check one branded email arrives with their supplied photograph, and a second run does not create another send. Emulator captures prove content/logic only, not real deliverability.
- Check Super Admin History for `configurationMissing`, failed deliveries and `review` states. `sent` means the provider accepted the request. For `review`, investigate the original send in Resend before manually requeueing; automatic retries stop when the response is ambiguous beyond the provider's 24-hour idempotency window. Known failures retry up to seven days; older unsent records remain in the ledger for operator investigation.
- Account suspension does not erase a person or other committee memberships. Committee deactivation disables appointments/new requests; historical affiliation records are retained. Review data retention with the foundation before publishing.

## Native verification

Registered Firebase native apps:

- iOS `1:536704319606:ios:b8359d5b5fa2f41e3e5f57`
- Android `1:536704319606:android:aec3ed2447aa26513e5f57`

Both configuration files are already checked into the project. RNFirebase config plugins generate the phone-auth reCAPTCHA URL scheme. A simulator uses reCAPTCHA fallback for real phone verification; physical iOS devices can use APNs silent verification after the APNs key and background capability are configured through Expo/EAS. Fallback must be verified on a real build. Android needs the **SHA-1 and SHA-256 fingerprints for the actual signing key** registered with Firebase; rebuild after downloading an updated `google-services.json` where needed.

```sh
npx eas-cli@latest build --platform ios --profile development-simulator
npx eas-cli@latest build --platform android --profile development
```

A development build is required; Expo Go is unsupported for native phone auth. Do not enable app-verification bypasses in production. Emulators are opt-in, development-only, use `demo-dma-connect`, and do not send SMS or email.

## Legacy records

Choose each legacy account's destination committee explicitly. The script does not infer a committee or grant a role from the previous descriptive profile.

```sh
npm run migrate --prefix functions -- --project dma-connect-foundation --owner LEGACY_UID --committee CONFIRMED_COMMITTEE_ID
npm run migrate --prefix functions -- --project dma-connect-foundation --owner LEGACY_UID --committee CONFIRMED_COMMITTEE_ID --apply
```

Review the dry run, resolve duplicate-phone conflicts, then apply. Original `presidents/{uid}/members/{mobile}` documents remain intact. Copied records retain timestamps and source paths; repeat runs skip existing canonical records. Legacy profiles without photos/DOB require completion before app access. Birthday greetings remain disabled until the member opts in and verifies their email. Legacy email accounts use the existing-email sign-in path to link a verified phone. If that phone is already tied to another canonical record, resolve the identity explicitly rather than automatically merging private records.

## Sources

- [Firebase pricing](https://firebase.google.com/pricing)
- [RNFirebase phone authentication](https://rnfirebase.io/auth/phone-auth)
- [Expo and Firebase](https://docs.expo.dev/guides/using-firebase/)
- [Resend pricing](https://resend.com/pricing)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
