# Wedding Planner — agreed scope

For one couple and one wedding with multiple events. English interface, LKR, Asia/Colombo dates, desktop first with mobile support. Both partners have equal editing access. GitHub source and Pages hosting, Supabase free-tier authentication/database.

Tabs: Overview; Guests (color mind map and searchable list); Budget & Payments (estimates, actual costs, vendors, installments, deposits, due dates and balances); Tasks (owner, priority, due dates, progress); Events & Timeline; Vendors; Seating; Settings.

Guest fields: name, category, side, household, phone, address, adult/child, invitation selected/sent, event-specific RSVP and meal preference, notes. Each person, including a plus-one or child, has their own card. RSVP is manually entered. Guests can attend different events.

Legacy sheets migrate as top-level categories into one tree after a preview. Do not deduplicate by name or overwrite the legacy browser data. Keep backups and the legacy page available.

Exports: categorized guest Excel; budget/payment Excel; PDF print views for guest list, budget, tasks, timeline, vendors, seating and overview; complete JSON backup.

Priorities: shared guest planning, budget/payment tracking, and tasks with in-app due/overdue reminders. No email reminders, guest-facing RSVP website, vendor accounts, or document uploads in the first release.

Cloud activation requires a Supabase project in the user's account, schema execution, and public project URL/key. Do not represent demo/local mode as shared online storage. No paid services without user authorization. Private data is restricted to workspace members by database policies. Concurrent changes must detect version conflicts rather than silently overwrite.
