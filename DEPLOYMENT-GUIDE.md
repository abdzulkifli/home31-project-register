# HOME31 V7 Deployment Guide

## 1. Create or open the Supabase project

Keep the Project URL and publishable/anon key.

## 2. Run the SQL

Open:

`Supabase > SQL Editor > New Query`

Run the complete contents of:

`supabase-setup-v7.sql`

## 3. Promote the first super admin

After your account exists in Supabase Auth, run:

```sql
update public.profiles
set role = 'super_admin',
    must_change_password = false
where email = 'abdzulkifli@gmail.com';
```

## 4. Configure app.js

Replace:

```javascript
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";
```

## 5. Authentication URL

Set the Supabase Site URL to:

`https://abdzulkifli.github.io/home31-project-register/`

Add the same production URL under Redirect URLs.

For local testing, add:

`http://localhost:8000/**`

## 6. Deploy Edge Functions

Deploy both function names exactly:

- `admin-create-user`
- `admin-reset-password`

Using the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-create-user
supabase functions deploy admin-reset-password
```

Keep JWT verification enabled.

## 7. Upload GitHub Pages files

Upload these to the repository root:

- `index.html`
- `styles.css`
- `app.js`

Your production URL is:

`https://abdzulkifli.github.io/home31-project-register/`

## 8. Test

### Super admin

- Sign in.
- Open User Administration.
- Create a normal user with a temporary password.

### Normal user

- Sign in using the temporary password.
- Confirm the dashboard is blocked.
- Change the password.
- Confirm the normal dashboard opens.

## Security note

Never place the service-role key in `app.js` or GitHub. The service-role key is
used only inside the protected Edge Functions.
