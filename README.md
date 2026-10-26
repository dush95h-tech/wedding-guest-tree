# Together — Wedding Planner

A wedding planner for two partners, hosted on GitHub Pages with private shared data in Supabase.

[Open the planner](https://dush95h-tech.github.io/wedding-guest-tree/)

## Features

- Overview with LKR budget totals, upcoming events and in-app reminders.
- Colorful guest mindmap: one person per card, nested family categories, invitation selection, manual event RSVP and meal preferences.
- Budget estimates, agreed costs, deposits, installments and payment due dates.
- Tasks, starter checklist, vendors, multiple events and wedding-day timelines.
- Event seating with capacity and duplicate-assignment checks.
- Categorized guest Excel, budget Excel, print/PDF and complete JSON backups.
- Separate partner accounts, private workspace, seven-day single-use partner invitations and revision checks to prevent silent overwrites.
- Original guest sheets can be imported as categories. The [original planner](https://dush95h-tech.github.io/wedding-guest-tree/legacy.html) and its browser data remain available.

## Start

Create an app account and confirm your email, then choose **Create our wedding**. In Settings, create a partner invitation. Your partner creates their own account and chooses **Join partner’s wedding** using that code. They should not create a separate wedding.

The public Supabase connection values are already configured. The database schema and authentication return URLs are installed. Email confirmation and password reset still need verification with your actual addresses; Supabase's default email sender restricts recipients. See [SETUP.md](SETUP.md) for email configuration and troubleshooting.

**Explore local demo** stores only demonstration data in the current browser, separately from the shared workspace.

## Development and checks

No build or npm installation is required. With Node.js installed:

```sh
node server.js
node --test model.test.js excel-export.test.js planner-model.test.js planner-export.test.js
```

Open http://127.0.0.1:4173. Application files are plain HTML, CSS and ES modules. Supabase and SheetJS browser libraries are vendored; see [THIRD-PARTY.md](THIRD-PARTY.md).

The automated suite covers guest counting, migrations, Excel values, money calculations, reminders and seating. `planner-security-test.sql` checks database permissions and conflicts inside a transaction and rolls back all synthetic records. It passed against the configured project on 26 October 2026. Actual two-device sign-in and email delivery remain user acceptance checks.

See [PLANNER-SCOPE.md](PLANNER-SCOPE.md) for release scope. Keep regular JSON backups. Online sync checks every 20 seconds; it is not live simultaneous document editing.
