# Connect your shared wedding planner

The app is hosted on GitHub Pages. Private wedding data and user accounts live in your own Supabase project. The local demo is separate and never claims to be synchronized.

1. Create an account at https://supabase.com/dashboard and choose a Free organization. Create a project called Wedding Planner, ideally in Singapore. Keep your database password private.
2. Open the project SQL Editor. Paste the complete contents of `planner-schema.sql` from this GitHub repository and click Run. The script creates the private tables, member policies and revision-checked save functions. It is safe to run again for this schema.
3. Under Authentication → URL Configuration, set the Site URL to your planner URL, `https://dush95h-tech.github.io/wedding-guest-tree/`. Add that exact URL to allowed Redirect URLs. Add `https://dush95h-tech.github.io/wedding-guest-tree/planner.html` too if using the separate planner page.
4. Get your Project URL and publishable key from the Connect dialog / project API settings. Use the publishable key (or legacy anon key), never `service_role`, `sb_secret_`, or a database password.
5. Open the planner and choose Connect Supabase. Enter those two public connection values. These settings are saved on this browser. For automatic setup on all devices, the same public values can be committed to `planner-config.json`; database RLS policies, not secrecy of this key, protect your data.
6. Create two app accounts, one for each partner. Confirm their email addresses, then sign in. The first partner chooses Create our wedding. In Settings, create a partner invitation. Share the code privately. The second partner signs in and chooses Join partner’s wedding, entering the code. Do not create a second wedding for the second partner.
7. Fill in your editable wedding details. In Guest List, choose Import old sheets in the same browser where you used the original app. If using another browser, export the original JSON backup and import it through Settings → Restore backup. A preview shows what will be imported. Each original sheet becomes a category, and the original saved data stays untouched.

## Email setup

Supabase’s built-in email sender may only send to authorized organization members and has strict rate limits. If confirmation/reset email cannot reach both addresses, configure a custom SMTP provider in Supabase Authentication settings, or use the Supabase dashboard to create/confirm the two intended users yourself. Never turn off database access policies to fix sign-in. SMTP providers can have costs; no paid email service is required by this repository or configured automatically.

## Everyday use

- Both partners can edit. Changes are saved online, and the other device checks for new versions every 20 seconds when it is visible and no form is open.
- If two people save against the same version, the second save is rejected. Download Settings → Recover unsaved changes, then load the latest shared version and reapply the intended change. Whole-workspace conflict detection prioritizes avoiding silent overwrites.
- Guest selection counts one person per card. Record event-specific Pending / Attending / Declined responses inside the guest editor. Seating assignments are event-specific.
- Budget tracks estimated and agreed actual costs. Deposits/installments contribute to Paid only when marked paid. In-app reminders show due or overdue tasks and unpaid installments.
- Export the guest list and budget to Excel. Print/PDF is available for every planning tab. A JSON backup preserves the entire plan; keep regular copies.
- Free Supabase projects can pause after low activity. Resume them from your Supabase dashboard if needed. This is a provider limitation; the app does not bypass it.

## Verification status

The schema is installed in the configured project. Transactional integration checks passed for both members, unrelated-user denial, stale-save conflicts, two-member limits, single-use invites and anonymous access restrictions. All synthetic test data was rolled back. Sign in separately as both partners to confirm shared edits through the app, and test email confirmation and password reset with your actual email configuration.
