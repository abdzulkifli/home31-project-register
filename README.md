# HOME31 Role-Based Initiative Register — Version 3

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
