# Supabase Setup

## 1. Create a project

Create a new Supabase project and keep these two values:

- Project URL
- Anon / publishable key

Put them into [supabase-config.js](C:/Users/evcla/Documents/Codex/2026-04-26/i-want-to-make-a-website-3/supabase-config.js).

## 2. Run the schema

Open the Supabase SQL editor and run [schema.sql](C:/Users/evcla/Documents/Codex/2026-04-26/i-want-to-make-a-website-3/supabase/schema.sql).

This creates:

- `profiles`
- `ride_posts`
- `conversations`
- `conversation_members`
- `messages`
- the `ensure_conversation` RPC
- row-level security policies

## 3. Turn on Google auth

In Supabase:

1. Go to `Authentication` -> `Providers` -> `Google`
2. Enable Google
3. Add your Google OAuth client ID and secret from Google Cloud

## 4. Add redirect URLs

In Supabase URL configuration, add:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/listings.html`

If you deploy later, add your production URLs too.

## 5. Configure Google Cloud

In Google Cloud Console:

1. Create OAuth credentials
2. Add the callback URL Supabase gives you
3. Add your local and production origins

## 6. Test the flow

1. Start the local server
2. Open the site
3. Click `Sign in with Google`
4. Save your profile
5. Create a ride post
6. Open the listings page and start a message
