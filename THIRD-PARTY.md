# Third-party browser libraries

- SheetJS Community Edition 0.20.3: `xlsx.mjs`, official https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs. Apache 2.0, see SHEETJS-LICENSE.txt.
- Supabase JavaScript client: `supabase.js`, vendored from the official package's v2 UMD distribution at https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js on 26 October 2026. MIT, see SUPABASE-LICENSE.txt. The exact checked-in file is pinned with SHA-256 `EE3BE8DE192B97CB1D73D1E95D6B82BB1F6B658C0F97C4EF757FC331996ED3D3`; the app never fetches a floating client version at runtime.
- Google Fonts provides DM Sans and Libre Caslon Display, with system fallbacks if unavailable.
