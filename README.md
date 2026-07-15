# HOME31 Enterprise Initiative Register V4.2 — Temporary No-Edge Provisioning — Version 3

This GitHub Pages + Supabase prototype provides two different dashboards.

## Dashboard 1 — Normal User

Normal users can:

- Create and edit their own initiatives
- Complete the comprehensive readiness assessment
- Complete the conditional HR collaboration assessment
- View and delete only their own project records
- See personal portfolio KPIs

## Dashboard 2 — Super Admin

Super admins can:

- View all registered user profiles
- View every initiative across all departments
- Filter projects by text, status, pillar and risk
- Update project status and delivery progress
- Delete invalid or test project records
- Export the enterprise portfolio to CSV
- Promote another account to Super Admin
- Retain ordinary accounts as Normal User

## Security model

The two dashboards are not protected only by hidden HTML. Supabase Row Level Security enforces the data boundary:

- A normal user can select, update and delete only projects where `created_by` equals their authenticated user ID.
- A super admin can select, update and delete all project records.
- A normal user can read only their own profile.
- A super admin can read and update the application profile directory and roles.
- Every new registration is assigned `normal_user` by the database trigger.

## Step 1 — Run the database script

In Supabase:

1. Open **SQL Editor**.
2. Select **New query**.
3. Copy all content from `supabase-setup.sql`.
4. Run it.

The script is upgrade-safe and retains existing project records.

## Step 2 — Register your account

Open the application and register using your name, department, email and password.

New accounts start as **Normal User**.

## Step 3 — Create the first Super Admin

After registering your own account, run this in Supabase SQL Editor:

```sql
update public.profiles
set role = 'super_admin'
where email = 'abdzulkifli@gmail.com';
```

Sign out and sign in again. The application will open the Super Admin dashboard.

Change the email in the query when another account should be the first administrator.

## Step 4 — Configure `app.js`

Replace:

```javascript
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";
```

with your Supabase Project URL and publishable key.

Never use a service-role key, secret key or database password in GitHub Pages.

## Step 5 — Authentication URLs

In Supabase **Authentication > URL Configuration**, add:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/**
http://localhost:8000/**
```

## Step 6 — Test locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Step 7 — Publish through GitHub Pages

Upload these files to the root of the GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-setup.sql`
- `README.md`

Then enable **Settings > Pages > Deploy from a branch > main > root**.

## Important limitation

The super-admin dashboard manages application profiles and project records. It does not directly create or delete Supabase Auth accounts because privileged Auth administration requires a trusted server environment and must never use a service-role key in GitHub Pages.


## Authentication redirect and expired-link fix

The application passes its current hosting folder to Supabase as
`emailRedirectTo`. This is important for GitHub Pages project sites because the
repository path must not be lost.

In Supabase, open:

`Authentication > URL Configuration`

Set **Site URL** to the exact address where `index.html` opens.

Examples:

- Root user site:
  `https://abdzulkifli.github.io/`
- Project site:
  `https://abdzulkifli.github.io/YOUR-REPOSITORY/`

Under **Redirect URLs**, add the same exact production URL. For local testing,
also add:

`http://localhost:8000/**`

Confirmation links are single-use. After requesting another email, use only the
newest link. The application now includes a **Resend confirmation email** button.

If you changed the Supabase confirmation email template, the confirmation button
should continue to use:

`{{ .ConfirmationURL }}`

Do not hardcode `https://abdzulkifli.github.io/` inside the template unless the
application is genuinely hosted at that root URL.


## Super admin can add users

Version 3.2 adds an **Add a User** panel to the super-admin dashboard.

Available methods:

- **Send invitation email** — recommended. The user receives a Supabase invite
  and completes account setup.
- **Create active account** — the admin assigns a temporary password and the
  account is created with its email already confirmed.

Every account created through this panel starts as `normal_user`. Use the
existing **User Directory & Roles** panel to promote a trusted administrator.

This feature requires the protected Supabase Edge Function included at:

`supabase/functions/admin-create-user/index.ts`

Deploy it before testing the Add User form. Follow:

`DEPLOY-ADMIN-USER-FUNCTION.md`

Do not place a Supabase service-role or secret key in `app.js`, GitHub Pages, or
the GitHub repository.


## Version 4 enterprise administration

The super admin can now:

- Open the same comprehensive initiative-entry workflow used by normal users.
- Submit an initiative under the super-admin account or on behalf of a selected normal user.
- Create an immediately active normal-user account without sending a confirmation email.
- Generate and copy a temporary password for secure manual distribution.
- View interactive Chart.js analytics for status, strategic pillars, risk and departmental readiness.
- Click chart segments or bars to filter the underlying initiative portfolio.
- Review low-readiness and overdue-project management insights.

### Required database update

Run the latest `supabase-setup.sql` again. It updates the project insert policy so
a super admin may create an initiative on behalf of another user. Existing data
is retained.

### Direct active user creation

Deploy the included `admin-create-user` Edge Function. The frontend never receives
the service-role or secret key. The Edge Function verifies that the caller is a
super admin, creates the Auth account with `email_confirm: true`, and creates the
application profile as `normal_user`.

The temporary password must be distributed through an approved secure channel.


## Temporary user creation without an Edge Function

Version 4.2 removes the Edge Function dependency from the Add User workflow.

The super-admin dashboard uses a second Supabase browser client with session
persistence disabled. This allows it to register a normal user without replacing
the super admin's current login session.

### Required Supabase setting

Open:

`Authentication > Providers > Email`

Turn **Confirm email** OFF temporarily.

With confirmation disabled:

- the admin enters the user's name, department, email and temporary password;
- Supabase creates the Auth user immediately;
- the existing signup trigger creates a `normal_user` profile;
- the new user can log in immediately;
- no confirmation email and no Edge Function are needed.

### Important limitation

This is suitable only for a controlled prototype. The publishable key cannot
prove that the signup request came from the visible admin form. Before production:

- re-enable email confirmation;
- remove public self-registration if it is not required;
- restore protected server-side provisioning through an Edge Function or other
  approved backend;
- add password-change enforcement and audit logging.
