> The current role flow is State → District → Taluka with separate maker/checker teams and view-only presidents. See [Maker and checker workflow](MAKER-CHECKER-FLOW.md).

# DMA Connect — live activation

The implementation is locally testable and the earlier Firestore indexes have been deployed; the new maker/checker indexes are declared locally and still require deployment. Development continues with emulators without waiting for billing. Live SMS is deferred to a later Twilio Verify integration; do not activate Firebase Phone Authentication. New production rules, Functions, photo storage and birthday sender are still pending activation. Existing production member records are preserved.

## Values required from the owner

1. The first Super Admin's Indian mobile number and the district display name. Do not derive the owner from whoever last tested the preview.
2. A Resend account, a verified sender domain and the chosen From address. Store the API key directly in Firebase Secret Manager. Do not put it in chat, Git, an Expo public environment variable or a mobile bundle.
3. A deployment decision when the owner is ready to go live. The currently selected Firebase Functions/Storage/Scheduler backend requires Blaze; SMS will use Twilio separately. Do not link billing while it is deferred. Any later billing activation requires explicit approval. Set an appropriate billing budget/alert if activated; alerts are notifications, not a hard spending cap.

Project: `dma-connect-foundation`, project number `536704319606`. Firestore database: **`dma-connect`**, Enterprise Native, **`asia-south1`**. Never silently use the `(default)` database. App bundle/package: `org.dmafoundation.connect`.

## Configure services

- Keep the existing Email/Password provider. Live phone verification will be performed server-side by Twilio Verify, followed by a Firebase custom-token session; see [OTP integration plan](OTP-INTEGRATION.md). Firebase's production Phone Authentication SMS provider is not part of the selected rollout. Keep localhost authorised for development and the production web origin authorised if web is distributed.
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

- Wait until every declared index is **READY**. The new workItems and scope-query indexes must be deployed; the local emulator does not prove production index coverage.
- Confirm `dmaApi`, birthday schedule and six Firestore triggers all use **`asia-south1`**; Firestore triggers must point at the named `dma-connect` database.
- Test real phone signup, maker submission, separate checker approval, invitation activation and president view-only boundaries, area+cell approval, private photo upload/retrieval, directory pagination and statistics with agreed test accounts.
- Verify a real recipient email through the app. Run the scheduled job against a consented test member whose birthday is today; check one branded email arrives with their supplied photograph, and a second run does not create another send. Emulator captures prove content/logic only, not real deliverability.
- Check Super Admin History for `configurationMissing`, failed deliveries and `review` states. `sent` means the provider accepted the request. For `review`, investigate the original send in Resend before manually requeueing; automatic retries stop when the response is ambiguous beyond the provider's 24-hour idempotency window. Known failures retry up to seven days; older unsent records remain in the ledger for operator investigation.
- Account suspension does not erase a person or other committee memberships. Committee deactivation disables appointments/new requests; historical affiliation records are retained. Review data retention with the foundation before publishing.

## Upgrade an existing hierarchy

Back up the named database and Auth/Storage before upgrading. Review the dry run:

```sh
node functions/scripts/upgrade-hierarchy.js --project dma-connect-foundation
```

Apply with `--apply` only during the coordinated rollout. This preserves canonical profiles and identities, adds `dma-state` ancestry, converts legacy area levels to Taluka, separates Super Admin from the district president seat and cancels unchecked legacy pending invitations. Do not use bootstrap to upgrade an existing hierarchy. Configure one maker and one separate checker per State, District and Taluka before submitting operational work.

## Native verification

Registered Firebase native apps:

- iOS `1:536704319606:ios:b8359d5b5fa2f41e3e5f57`
- Android `1:536704319606:android:aec3ed2447aa26513e5f57`

Both configuration files are already checked into the project. The current RNFirebase native module and phone-auth URL scheme support the emulator preview; they do not activate live SMS. The later Twilio SMS flow will call a trusted server and sign in to Firebase using its returned custom token, so Firebase phone-auth APNs/reCAPTCHA setup is not a requirement for that flow. Test the actual Twilio flow on iOS and Android after integration.

```sh
npx eas-cli@latest build --platform ios --profile development-simulator
npx eas-cli@latest build --platform android --profile development
```

Expo Go supports test OTP through the local Auth emulator REST interface and Firebase JS SDK; native Firebase verification still requires a development build. Do not enable app-verification bypasses in production. Emulators are opt-in, development-only, use `demo-dma-connect`, and do not send SMS or email. All phone-auth entry points reject live OTP requests until Twilio is integrated. Use `npm run emulators` and `npm run start:demo` for local previews.

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
- [Twilio Verify](https://www.twilio.com/docs/verify/api)
- [Firebase custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [Expo and Firebase](https://docs.expo.dev/guides/using-firebase/)
- [Resend pricing](https://resend.com/pricing)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
