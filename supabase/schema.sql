create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text not null,
  affiliation text default 'UCSC student',
  bio text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('offer', 'request')),
  origin text not null,
  destination text not null,
  departure_time timestamptz not null,
  seats integer not null check (seats > 0),
  vehicle text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  ride_post_id uuid not null references public.ride_posts (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists ride_posts_set_updated_at on public.ride_posts;
create trigger ride_posts_set_updated_at
before update on public.ride_posts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.ride_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

grant execute on function public.can_access_conversation(uuid) to authenticated;

drop policy if exists "profiles are public read" on public.profiles;
create policy "profiles are public read"
on public.profiles
for select
using (true);

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users delete own profile" on public.profiles;
create policy "users delete own profile"
on public.profiles
for delete
using (auth.uid() = id);

drop policy if exists "ride posts are public read" on public.ride_posts;
create policy "ride posts are public read"
on public.ride_posts
for select
using (true);

drop policy if exists "users create own ride posts" on public.ride_posts;
create policy "users create own ride posts"
on public.ride_posts
for insert
with check (auth.uid() = creator_id);

drop policy if exists "users update own ride posts" on public.ride_posts;
create policy "users update own ride posts"
on public.ride_posts
for update
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

drop policy if exists "users delete own ride posts" on public.ride_posts;
create policy "users delete own ride posts"
on public.ride_posts
for delete
using (auth.uid() = creator_id);

drop policy if exists "members can read conversations" on public.conversations;
create policy "members can read conversations"
on public.conversations
for select
using (public.can_access_conversation(id));

drop policy if exists "members can read conversation members" on public.conversation_members;
create policy "members can read conversation members"
on public.conversation_members
for select
using (public.can_access_conversation(conversation_id));

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages"
on public.messages
for select
using (public.can_access_conversation(conversation_id));

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
on public.messages
for insert
with check (
  auth.uid() = sender_id
  and public.can_access_conversation(conversation_id)
);

create or replace function public.ensure_conversation(
  p_ride_post_id uuid,
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user uuid := auth.uid();
  existing_conversation uuid;
begin
  if current_user is null then
    raise exception 'Authentication required';
  end if;

  if current_user = p_other_user_id then
    raise exception 'Cannot create a conversation with yourself';
  end if;

  select c.id
  into existing_conversation
  from public.conversations c
  join public.conversation_members cm1
    on cm1.conversation_id = c.id
   and cm1.user_id = current_user
  join public.conversation_members cm2
    on cm2.conversation_id = c.id
   and cm2.user_id = p_other_user_id
  where c.ride_post_id = p_ride_post_id
  limit 1;

  if existing_conversation is null then
    insert into public.conversations (ride_post_id, created_by)
    values (p_ride_post_id, current_user)
    returning id into existing_conversation;

    insert into public.conversation_members (conversation_id, user_id)
    values
      (existing_conversation, current_user),
      (existing_conversation, p_other_user_id);
  end if;

  return existing_conversation;
end;
$$;

grant execute on function public.ensure_conversation(uuid, uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, affiliation, bio)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'UCSC student'),
    'UCSC student',
    ''
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, display_name, affiliation, bio)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), 'UCSC student'),
  'UCSC student',
  ''
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

create or replace function public.get_user_conversations()
returns table (
  id uuid,
  ride_post_id uuid,
  created_at timestamptz,
  other_user_id uuid,
  other_display_name text,
  other_affiliation text,
  last_message_body text,
  last_message_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.ride_post_id,
    c.created_at,
    other_member.user_id as other_user_id,
    coalesce(p.display_name, 'UCSC student') as other_display_name,
    coalesce(p.affiliation, 'UCSC student') as other_affiliation,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at
  from public.conversations c
  join public.conversation_members my_member
    on my_member.conversation_id = c.id
   and my_member.user_id = auth.uid()
  join public.conversation_members other_member
    on other_member.conversation_id = c.id
   and other_member.user_id <> auth.uid()
  left join public.profiles p
    on p.id = other_member.user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_message on true
  order by coalesce(last_message.created_at, c.created_at) desc;
$$;

grant execute on function public.get_user_conversations() to authenticated;

create or replace function public.get_conversation_messages(p_conversation_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.sender_id,
    coalesce(p.display_name, 'UCSC student') as sender_name,
    m.body,
    m.created_at
  from public.messages m
  left join public.profiles p
    on p.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and public.can_access_conversation(p_conversation_id)
  order by m.created_at asc;
$$;

grant execute on function public.get_conversation_messages(uuid) to authenticated;

alter publication supabase_realtime add table public.ride_posts;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
