# SlugRide

SlugRide is a UCSC-focused rideshare site for students to post ride offers, browse ride requests, and message privately through account-based chat.

## Stack

- Static HTML/CSS/JS
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Google sign-in

## Project files

- `index.html` - landing page and ride posting flow
- `listings.html` - listings board and messaging UI
- `styles.css` - site styling
- `app.js` - frontend logic for auth, rides, chat, and live updates
- `supabase-config.js` - Supabase project URL and anon key
- `supabase/schema.sql` - database schema, functions, policies, and triggers

## Local development

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-site.ps1
```

Then open:

- `http://127.0.0.1:4173/`

## Deploy to Vercel

1. Put this folder in a GitHub repository.
2. Import the repository into Vercel.
3. Deploy as a static site.
4. Set your live site URL in Supabase Auth URL configuration.
5. Add your Vercel domain to Google Cloud OAuth authorized origins.

## Supabase notes

- The `anon` key in `supabase-config.js` is safe for frontend use.
- Never put your `service_role` key in this project.

## Auth URLs to update after deploy

In Supabase:

- Set `Site URL` to your live Vercel domain
- Add redirect URLs for your live domain

In Google Cloud:

- Add your live Vercel domain as an authorized JavaScript origin
- Keep the Supabase callback URL as the OAuth redirect URI
