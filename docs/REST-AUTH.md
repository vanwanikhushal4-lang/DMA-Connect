# REST authentication integration

Set `EXPO_PUBLIC_BACKEND_API_URL` to the server origin, without `/api/v1` or a trailing path. Local development currently uses `http://192.168.0.157:9595` from `.env.development`. Release builds must receive their deployed API origin through the build environment.

```sh
npm start -- --port 8093
# Or open the browser preview
npm run web -- --port 8093
```

The REST email flow does not require Firebase emulators or phone OTP. `npm run start:demo` explicitly selects the previous Firebase demo; `npm run start:live` selects the previous live Firebase email flow. The original membership/staff screens and callable operations remain in that Firebase flow. The new REST login response supplies only a name, user ID, token and expiry, so its signed-in screen shows the account identity and REST committee directory. It does not invent a Firebase identity, profile, role or staff permission.

## Contracts

| Action | Method and path | Authentication |
| --- | --- | --- |
| Create account | `POST /api/v1/user/profile` | Public, no `uid` query parameter |
| Email login | `POST /api/v1/auth/login/email` | Email and password in JSON |
| Committees | `GET /api/v1/committees/getAllCommittees?active=true` | Public for signup; bearer token when signed in |

Registration submits the requested name, email, mobile, residence, DOB, `areaId`, socials, `photoPaths`, birthday preference and password. Passwords are supplied only to registration/login requests and are not saved. DOB is converted from the displayed `DD/MM/YYYY` to `YYYY-MM-DD`.

The signup Home area selector loads the returned `committees`, filters `active === true` and `level === 'area'`, and displays their names. It keeps the actual `committeeId` as its selection value and sends that ID as a **number** in `areaId`. Districts, cells, wards and inactive records are excluded. Loading, empty results, authorization failures and retries are shown explicitly. Submitting an ID absent from the active area list is rejected.

Email login expects `{ token, userId, name, expiresIn }`, where `expiresIn` is in seconds. Tokens and account metadata are stored with Expo SecureStore on Android/iOS, and per-tab session storage on web. Sessions expire locally, are cleared on sign-out, and are restored only for the same API origin. Backend tokens are never passed to Firebase's custom-token API.

## Backend requirements and verification

The server must permit browser development origins such as `http://localhost:8093`, methods `GET`, `POST`, `OPTIONS`, and headers `Content-Type`, `Authorization`. Browser CORS failures can prevent requests that work from Postman or native Expo Go. During integration, public committee GET was confirmed to return 15 committees and eight active areas; the browser login preflight returned HTTP 403 until CORS is allowed by the backend.

Signup currently permits registration without a photograph and sends `photoPaths: []`, as agreed for this integration. Photo controls are hidden in REST signup until an upload endpoint is available. The original Firebase profile flow still requires a photograph. Device-local image URIs and fabricated storage paths are never sent as uploaded photographs.

`npm test` includes contract checks for exact URLs/body shapes, area filtering and numeric IDs, optional REST photos, invalid responses, authorization failures, session expiry and server isolation. An isolated HTTP fixture verifies UI signup, email login, account navigation and session restoration without registering accounts or sending the supplied personal data to the live server.
