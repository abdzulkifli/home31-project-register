# HOME31 Initiative Register — Comprehensive Readiness + HR Collaboration

A GitHub Pages frontend connected to Supabase for authentication and project records.
The user journey remains simple, but Step 2 now provides a comprehensive readiness assessment.

## Three-step workflow

1. **Project Profile & Strategic Alignment**
2. **Comprehensive Readiness Assessment**
3. **Review & Submit**

## Readiness coverage

The core assessment contains 12 checks across:

- Strategy & Governance
- Value & Funding
- Risk & Controls
- Delivery & Change

The score produces one of four practical recommendations:

- 85–100%: Generally ready
- 70–84%: Proceed with conditions
- 55–69%: Rework gaps
- Below 55%: Not ready / defer

Extreme residual risk always produces an escalation recommendation.

## Conditional HR collaboration

When the user selects **Required** or **To be confirmed**, the application displays:

- HR engagement stage
- HR representative or focal person
- People and workforce impact summary
- HR collaboration areas
- Five HR and people-readiness checks

The HR checks cover early engagement, people impact, workforce capacity, skills and training,
and employee communication and adoption.

## Upgrade from the previous sample

Run the new `supabase-setup.sql` in Supabase. It is safe to rerun and uses
`add column if not exists` to preserve existing project records while adding the new readiness and HR fields.

## Setup

1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase-setup.sql`.
3. Copy the Supabase **Project URL** and **Publishable key**.
4. Replace the placeholders at the top of `app.js`.
5. Configure the GitHub Pages URL under Supabase Authentication URL settings.
6. Upload all files to the root of the GitHub repository.
7. Enable GitHub Pages from the `main` branch and `/ (root)` folder.

## Local testing

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Security note

The publishable key is browser-safe only when Row Level Security is correctly configured.
Never place the database password, secret key or service-role key in GitHub Pages.

Use dummy or non-confidential data unless LPPSA has approved the hosting, access controls,
privacy requirements, audit logging, backups and operational support model.
