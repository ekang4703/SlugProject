# SlugRide

SlugRide is a rideshare web app built specifically for UCSC students. It lets students post ride offers, browse ride requests, and message each other privately without ever exposing personal contact information publicly. Whether someone needs a ride to SJC Airport, is heading to LA for a school break, or wants to coordinate a carpool to San Francisco, SlugRide gives them a safe and simple way to connect with other Banana Slugs.

Live site: [slug-project.vercel.app](https://slug-project.vercel.app)

---

## What it does

- Students can post a ride offer (driver with seats available) or a ride request (rider looking for a lift)
- Anyone can browse current listings and filter by route or post type
- Signed-in users can open a private in-app conversation with the person who posted a listing
- Each conversation is one-on-one and tied to a specific ride post — so if two different people message the same driver, the driver gets two separate private threads
- Messages update in real time without needing to refresh the page
- Google sign-in is used for authentication, so no passwords are needed

---

## Tech stack

**Frontend**
- Plain HTML, CSS, and JavaScript — no frontend framework
- Two pages: `index.html` (home + posting forms) and `listings.html` (browse + messaging)
- `Space Grotesk` and `Instrument Serif` fonts from Google Fonts
- Fully responsive layout with mobile breakpoints at 1080px and 720px

**Backend and database**
- [Supabase](https://supabase.com) for everything backend: database, authentication, and realtime
- Postgres database with five tables: `profiles`, `ride_posts`, `conversations`, `conversation_members`, and `messages`
- Row-level security (RLS) policies on every table so users can only read and write their own data
- Custom Postgres functions (RPCs) called directly from the frontend via the Supabase JS client

**Auth**
- Google OAuth via Supabase Auth
- A `handle_new_user` trigger automatically creates a profile row when a new user signs in for the first time

**Realtime**
- Supabase Realtime subscriptions on `ride_posts`, `conversations`, `conversation_members`, and `messages`
- New messages and new conversations appear live without a page refresh
- A debounce timer prevents rapid duplicate refreshes when multiple realtime events fire at once

**Deployment**
- Hosted on [Vercel](https://vercel.com) as a static site
- No build step required — Vercel serves the HTML/CSS/JS files directly

---

## Project structure

```
├── index.html          — Landing page with hero, how-it-works, and ride posting forms
├── listings.html       — Listings board with search, filters, and in-app messaging UI
├── styles.css          — All site styling including responsive breakpoints
├── app.js              — All frontend logic: auth, ride posts, conversations, realtime
├── supabase-config.js  — Supabase project URL and anon key
├── vercel.json         — Vercel deployment config
└── supabase/
    └── schema.sql      — Full database schema, RLS policies, functions, and triggers
```

---

## Database schema

**`profiles`** — one row per user, created automatically on first sign-in via a Postgres trigger. Stores display name, UCSC affiliation, and bio.

**`ride_posts`** — each ride offer or request posted by a signed-in user. Stores type (offer/request), origin, destination, departure time, seats, vehicle info, and notes.

**`conversations`** — one conversation per (ride post, user pair). Created the first time someone clicks Message on a listing.

**`conversation_members`** — join table linking users to conversations. Enforces that only members can read or send messages in a thread.

**`messages`** — individual messages within a conversation, capped at 280 characters each.

**Key Postgres functions:**

`ensure_conversation(ride_post_id, other_user_id)` — finds or creates a conversation between the current user and the post creator. Prevents duplicate threads for the same pair on the same post.

`send_conversation_message(conversation_id, body)` — inserts a message after verifying the sender is a member of the conversation.

`get_user_conversations()` — returns all conversations for the current user, including the other person's name and the last message preview.

`get_conversation_messages(conversation_id)` — returns all messages in a conversation in chronological order, with sender names resolved from profiles.

---

## How the messaging flow works

1. User A posts a ride offer
2. User B clicks Message on that listing — `ensure_conversation` runs and creates a conversation with both A and B as members
3. User C also clicks Message on the same listing — a separate conversation is created for A and C
4. User A sees two separate threads in their inbox, one for each person who messaged them
5. All messages are private — only the two members of a conversation can see its contents, enforced by RLS

---

## Running locally

You need Python installed. From the project folder run:

```
python -m http.server 4173
```

Then open `http://127.0.0.1:4173` in your browser.

---

## Setting up Supabase from scratch

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key into `supabase-config.js`
3. Open the SQL editor and run `supabase/schema.sql`
4. Go to Authentication → Providers → Google and enable Google OAuth
5. Add your Google OAuth client ID and secret
6. Add your local and production URLs to Supabase's allowed redirect URLs
7. Add your domain as an authorized JavaScript origin in Google Cloud Console


