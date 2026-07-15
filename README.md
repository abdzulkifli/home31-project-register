# HOME31 Enterprise Management Platform V7

V7 is a Supabase-connected role-based MVP with a complete first-login password-change flow.

## Main flow

1. Super admin creates an active normal user with a temporary password.
2. The new account is created with `must_change_password = true`.
3. The user logs in using the temporary password.
4. The system displays only the forced password-change screen.
5. The user chooses a strong new password.
6. Supabase Auth updates the password.
7. The profile is updated to `must_change_password = false`.
8. The normal-user dashboard opens.

## Included

- Secure login
- Forced first-login password change
- Forgot-password flow
- My Account password change
- Normal-user dashboard
- Personal initiative portfolio
- Readiness and HR collaboration view
- Separate super-admin dashboard
- Enterprise charts and filters
- Super-admin user creation
- User-role management
- Initiative entry on behalf of users
- Risk and exception monitoring
- Supabase database setup
- Protected Edge Functions

## Files

```text
index.html
styles.css
app.js
supabase-setup-v7.sql
supabase/functions/admin-create-user/index.ts
supabase/functions/admin-reset-password/index.ts
DEPLOYMENT-GUIDE.md
README.md
```

## Important

Use dummy or non-confidential data until LPPSA approves the hosting, security,
privacy, access-control, backup and audit arrangements.
