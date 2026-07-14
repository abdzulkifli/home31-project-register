# GitHub Pages + Supabase Project Register

This sample is a static HTML/CSS/JavaScript application suitable for GitHub Pages.

## Included features

- Email/password account registration
- User login and logout
- Create project
- View the signed-in user's projects
- Edit and delete project
- Progress summary
- Supabase PostgreSQL database
- Row Level Security: each user can access only their own records
- Responsive layout for desktop and mobile

## Step 1 — Create a Supabase project

1. Sign in to Supabase.
2. Create a new project.
3. Save the database password securely.
4. Wait until the project is ready.

## Step 2 — Create the database

1. Open **SQL Editor** in Supabase.
2. Create a new query.
3. Copy all SQL from `supabase-setup.sql`.
4. Click **Run**.

## Step 3 — Copy the browser-safe project credentials

In Supabase, open the project's connection/API settings and copy:

- Project URL
- Publishable key (or legacy anon key)

Never use a service-role or secret key in this GitHub Pages project.

## Step 4 — Configure the sample

Open `app.js` and replace:

```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";
```

Use your actual Project URL and publishable key.

## Step 5 — Configure authentication URLs

In Supabase Authentication URL configuration:

1. Set the Site URL to your GitHub Pages URL, for example:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`
2. Add the same URL as an allowed Redirect URL.

For easy initial testing, you may temporarily disable email confirmation in the Supabase email provider settings. For a real system, keep email confirmation enabled.

## Step 6 — Test locally

A browser may block module loading when opening `index.html` directly from a file.

Use one of these:

```bash
python3 -m http.server 8000
```

Then open:

`http://localhost:8000`

Or use the VS Code Live Server extension.

## Step 7 — Upload to GitHub

Create a repository and upload:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-setup.sql`
- `README.md`

Commands:

```bash
git init
git add .
git commit -m "Add project register sample"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## Step 8 — Enable GitHub Pages

1. Repository > Settings > Pages.
2. Source: **Deploy from a branch**.
3. Branch: `main`.
4. Folder: `/ (root)`.
5. Save.

Your site should be available at:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Important

This is a prototype. Do not use real confidential LPPSA, borrower, NRIC, employee, or financing information without formal organisational approval, security review, approved hosting, access controls, backups, audit logging, and privacy controls.
