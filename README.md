# MindScreen Pro

This project now uses Vite so it runs like a proper VS Code frontend app.

Main files:

- `index.html`
- `package.json`
- `.env.example`
- `src/main.js`
- `src/app.js`
- `src/data.js`
- `src/db.js`
- `src/session.js`
- `src/supabase.js`
- `src/styles.css`
- `supabase/schema.sql`

Run in VS Code:

1. Open the `mindscreen-new-app` folder in VS Code.
2. Open the terminal in VS Code.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL shown by Vite.

Notes:

- The app uses `IndexedDB` for stored users and activity logs.
- The app uses `localStorage` for admin session state.
- A real Supabase database schema is included in `supabase/schema.sql`.
- Behavioral analytics history is stored in the `behavior_snapshots` table when Supabase is configured.
- If you want fresh demo data, click the `Reset DB` button in the app.
- The old root `app.js` and `style.css` are legacy copies from before the Vite upgrade and are no longer the main entry files.

Supabase setup:

1. Create a Supabase project.
2. Open the SQL editor in Supabase.
3. Paste and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Run `npm install`
7. Run `npm run dev`

Current status:

- The app still works locally with IndexedDB.
- When Supabase is configured, user records and behavior snapshots are synced to the cloud.
- If you already ran the old schema, run `supabase/schema.sql` again to add the new `behavior_snapshots` table.

Demo login:

- Email: `admin@mindscreen.app`
- Password: `123456`
