# Deploy the Admin Create User Edge Function

The **Add a User** form cannot safely call Supabase Auth Admin directly from
GitHub Pages. The service-role or secret key must stay inside a server-side
Supabase Edge Function.

## Option A — Supabase Dashboard

1. Open your Supabase project.
2. Open **Edge Functions**.
3. Create a function named exactly:

   `admin-create-user`

4. Replace the starter code with the contents of:

   `supabase/functions/admin-create-user/index.ts`

5. Keep JWT verification enabled.
6. Deploy the function.

The hosted function receives Supabase's project URL and secret/service-role
credentials through its protected function environment. Do not copy those
secrets into `app.js`.

## Option B — Supabase CLI

From the extracted project folder:

```bash
supabase login
supabase projects list
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-create-user --use-api
```

If your project already has `supabase/config.toml`, ensure it contains:

```toml
[functions.admin-create-user]
verify_jwt = true
```

## Test

1. Upload the updated frontend files to GitHub Pages.
2. Sign in as a super admin.
3. Open **Add a User**.
4. Choose one method:
   - **Send invitation email**: the user receives a link to establish access.
   - **Create active account**: the admin assigns a temporary password and the
     email is immediately confirmed.
5. The new account appears in **User Directory & Roles** as `Normal User`.

## Security boundary

The frontend sends the signed-in super admin's user JWT to the function. The
function verifies the session and checks `profiles.role = 'super_admin'` before
using the protected Auth Admin API. Normal users receive a 403 response.
