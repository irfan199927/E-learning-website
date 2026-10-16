# Google setup

One-time setup that lets E-learner use the school's Google Workspace: sign in with Google, schedule classes on
Google Meet, and pull recordings and attendance afterwards. Do it once per school.

**You need:** a Google Workspace **super admin** account, about 30 minutes, and the app's public URL (`APP_URL`,
e.g. `https://learn.school.edu`). For local development, use `http://localhost:3000`.

Background and design decisions: [SPEC.md](SPEC.md) §3 Google integration.

## 1. Create the Google Cloud project

1. Sign in to [console.cloud.google.com](https://console.cloud.google.com) with an account in the school's
   Workspace.
2. Create a project named, for example, `e-learner`, under the school's organisation.
3. Go to **APIs & Services → Library** and enable:
   - **Google Calendar API**
   - **Google Meet REST API**
   - **Google Drive API**

## 2. Configure the consent screen

Go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform** in newer consoles):

1. **User type: Internal.** Only accounts in the school's Workspace can use the app, and Google's app verification
   isn't needed.
2. Fill in the app name, support email, logo and the privacy policy URL.
3. **Authorised domains:** the domain of `APP_URL`.
4. **Data access (scopes):** add the scopes below.

| Scope                                                     | Who asks for it | Why                                                                         |
| --------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `openid`, `email`, `profile`                              | everyone        | Sign in with Google                                                         |
| `https://www.googleapis.com/auth/calendar.events`         | teachers        | Create, move and cancel class events with a Meet link                       |
| `https://www.googleapis.com/auth/meetings.space.readonly` | teachers        | Read Meet conference records, participants (attendance) and recordings      |
| `https://www.googleapis.com/auth/drive.meet.readonly`     | teachers        | Download the recording files Meet saved. It can't see any other Drive files |

Students and parents are only ever asked for the sign-in scopes. Teachers grant the other three separately, the
first time they schedule a class. They can remove the access at any time in their Google Account
(**Security → Your connections to third-party apps**); E-learner then asks them to reconnect.

> If you later offer the app to other schools, the consent screen must become **External**. The Meet and Drive
> scopes then need Google's app verification, and the Drive scope needs a CASA security assessment. Allow 4–8
> weeks.

## 3. Create the OAuth client

Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:

- **Application type:** Web application.
- **Authorised JavaScript origins:** `APP_URL`.
- **Authorised redirect URIs**, both of them:
  - `APP_URL/api/auth/callback/google` (sign-in)
  - `APP_URL/api/v1/google/callback` (the teacher's Calendar/Meet/Drive grant)

For local development, add the same two URIs with `http://localhost:3000`. Playwright doesn't use Google, so
there's no need to add port 3100.

Copy the client ID and secret into the environment ([environment.md](environment.md)) of **both** the web app
and the worker:

```bash
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
GOOGLE_WORKSPACE_DOMAIN=school.edu   # rejects Google accounts from any other domain
```

Treat the secret like a password. If it leaks, create a new secret in the console and delete the old one.

## 4. Allow Meet recording (Workspace Admin console)

Recordings and attendance come from Google, so Meet must be allowed to record:

1. **Edition:** recording needs Education Plus, the Teaching and Learning add-on, or Business Standard or higher.
2. In [admin.google.com](https://admin.google.com) go to **Apps → Google Workspace → Google Meet → Meet video
   settings → Recording**. Turn it on for the teachers' organisational unit.
3. Recordings save to the **organiser's** Drive. The teacher who schedules a class in E-learner must also host
   it, or the recording can't be found.

If recording is off or fails, teachers can still upload a video by hand from **Library → Upload**.

## 5. Check that it works

1. Sign in to E-learner with Google using a teacher account from the school's domain. A personal Gmail account
   should be refused with "Use your @school.edu school account".
2. Schedule a test class. On the first one, Google asks the teacher to allow Calendar, Meet and Drive access.
   Allow it.
3. The class appears in the teacher's Google Calendar with a Meet link. Students on the class are invited.
4. Hold a short recorded Meet. Within a few minutes of the class ending, the recording appears in the library
   (after transcoding) and attendance is filled in.

Calendar push notifications, which sync edits made directly in Google Calendar, need a public HTTPS `APP_URL`. On
`http://localhost` they are skipped, and everything else works.

## Troubleshooting

| Symptom                                            | Cause and fix                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch` from Google                | The redirect URI isn't listed exactly (scheme, host, port, path) on the OAuth client. Add it as in step 3.                                                                                                   |
| "Use your @… school account"                       | The Google account isn't in `GOOGLE_WORKSPACE_DOMAIN`. Use a school account, or fix the variable.                                                                                                            |
| Sign-in with Google says the account doesn't exist | E-learner has no self sign-up. An admin must create the user (same email) first.                                                                                                                             |
| Teacher is asked to reconnect Google               | The grant was revoked or expired (`invalid_grant`), or a scope was missing. Reconnecting fixes it. If it keeps happening, check the Workspace admin hasn't restricted the app (**Security → API controls**). |
| Class scheduled but no recording appears           | Recording was off, the class wasn't recorded, or someone other than the scheduling teacher hosted it. Upload the video by hand.                                                                              |
| Attendance is empty for some students              | They joined without signing in, by phone, or with a different Google account. Mark them by hand. See architecture.md gap G5.                                                                                 |
| `access_denied` / "app is blocked" for teachers    | The Workspace admin restricts third-party apps. In **Security → API controls → App access control**, mark the E-learner OAuth client as **Trusted**.                                                         |
