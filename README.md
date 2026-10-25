# Wedding Guest Tree

A responsive wedding invitation planner, built with plain HTML, CSS and JavaScript. No build tools, accounts, or database required.

## Use

1. Create a named sheet for a person or celebration.
2. Add branches such as Father's side, Mother's side, and Friends. Add sub-branches as needed.
3. Add each person as their own card. Tick their checkbox to invite them.
4. View live sheet and branch counts, then open **Invited list**.
5. Choose **Print / Save PDF** and select **Save as PDF** in the browser print dialog. Only invited people in the current sheet are printed.

Sheets are saved in this browser's local storage. Different browsers/devices have separate data. There are no private user accounts, cloud sync, or simultaneous shared editing. People sharing a browser can see its sheets. Export a JSON backup before clearing browser data; import adds copies without replacing existing sheets. Guest data is never committed to GitHub or sent to a server. Google Fonts is used for typography with local fallback fonts.

## Develop

Requires Node.js 20 or later. No dependency installation needed.

```sh
npm start
npm test
```

Open http://127.0.0.1:4173. Serve through HTTP (JavaScript modules do not support opening index.html directly as a file).

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/ (root)**, and save. The app uses relative asset URLs to work at a repository subpath.

## Validation

Node tests cover invitation counting, sheet isolation, nested branch paths/deletion, backup round trips, duplicate IDs, malformed records, and excessive nesting. Browser checks cover sheet creation, adding/selecting people, list rendering and reload persistence.
