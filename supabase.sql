-- secretmewah database setup for Supabase
-- Run this entire file once in Supabase SQL Editor.
-- It creates profiles, posts, likes, comments, follows, notifications,
-- direct messages and storage policies with Row Level Security.

create extension if not exists pgcrypto;

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- Posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

-- ---------- Likes ----------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- Comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- Follows ----------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like','comment','follow','message')),
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Direct messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists messages_pair_idx on public.messages(sender_id, receiver_id, created_at);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- ---------- Profile creation trigger ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text,1,8))),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

-- Profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Posts
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select to authenticated using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete to authenticated using (user_id = auth.uid());

-- Likes
drop policy if exists "likes_select" on public.post_likes;
create policy "likes_select" on public.post_likes for select to authenticated using (true);

drop policy if exists "likes_insert_own" on public.post_likes;
create policy "likes_insert_own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "likes_delete_own" on public.post_likes;
create policy "likes_delete_own" on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- Comments
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments for select to authenticated using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments for delete to authenticated using (user_id = auth.uid());

-- Follows
drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows for select to authenticated using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows for insert to authenticated with check (follower_id = auth.uid());

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Notifications: only recipient reads/updates; actors create their own notification
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select to authenticated using (recipient_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists "notifications_insert_actor" on public.notifications;
create policy "notifications_insert_actor" on public.notifications for insert to authenticated with check (actor_id = auth.uid());

-- Messages: sender or receiver only
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender" on public.messages for insert to authenticated with check (sender_id = auth.uid());

-- ---------- Notification helper ----------
create or replace function public.notify_post_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, post_id)
    values (owner_id, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists after_like_notification on public.post_likes;
create trigger after_like_notification
after insert on public.post_likes
for each row execute procedure public.notify_post_owner();

create or replace function public.notify_comment_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, post_id)
    values (owner_id, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists after_comment_notification on public.comments;
create trigger after_comment_notification
after insert on public.comments
for each row execute procedure public.notify_comment_owner();

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists after_follow_notification on public.follows;
create trigger after_follow_notification
after insert on public.follows
for each row execute procedure public.notify_follow();

-- ---------- Storage ----------
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do update set public = true;

drop policy if exists "post_media_public_read" on storage.objects;
create policy "post_media_public_read" on storage.objects
for select to public
using (bucket_id = 'post-media');

drop policy if exists "post_media_upload_own_folder" on storage.objects;
create policy "post_media_upload_own_folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post_media_update_own_folder" on storage.objects;
create policy "post_media_update_own_folder" on storage.objects
for update to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post_media_delete_own_folder" on storage.objects;
create policy "post_media_delete_own_folder" on storage.objects
for delete to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Realtime ----------
-- Add tables to the realtime publication if they are not already there.
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end;
end $$;
