-- Between Readers — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table books (
  isbn           text primary key,
  title          text not null,
  author         text not null,
  cover_url      text,
  release_note   text,
  released_by    text,
  passcode       text,  -- 6-digit code written in pen inside the book; required to view journey
  description    text   -- cached from Open Library; populated on first view
);

create table entries (
  id                   uuid primary key default gen_random_uuid(),
  isbn                 text not null references books(isbn) on delete cascade,
  found_location       text not null,        -- geocodable place name (city/region) for map pins
  location_description text,                 -- optional free-text spot description ("on a park bench…")
  message              text,
  photo_url            text,                 -- public URL of uploaded photo in Supabase Storage
  found_date           date,
  lat                  double precision,     -- geocoded latitude stored at submission time
  lng                  double precision,     -- geocoded longitude stored at submission time
  created_at           timestamptz not null default now()
);

-- Migration: if the table already exists, add new columns with:
-- alter table entries add column if not exists location_description text;
-- alter table entries add column if not exists photo_url text;
-- alter table books   add column if not exists passcode text;
-- alter table entries add column if not exists lat double precision;
-- alter table entries add column if not exists lng double precision;
-- alter table books   add column if not exists description text;
-- note: cover_url already exists; cache_book_cover rpc writes back fetched covers

create index entries_isbn_idx on entries(isbn);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The anon key is public (used in the browser). Authenticated users (admins)
-- get full write access. Visitors can read everything and add entries only.

alter table books   enable row level security;
alter table entries enable row level security;

-- Books: public read; authenticated (admin) full write
create policy "public can read books"
  on books for select
  using (true);

create policy "authenticated can insert books"
  on books for insert
  to authenticated
  with check (true);

create policy "authenticated can update books"
  on books for update
  to authenticated
  using (true);

create policy "authenticated can delete books"
  on books for delete
  to authenticated
  using (true);

-- Entries: public read and insert; authenticated can delete
create policy "public can read entries"
  on entries for select
  using (true);

create policy "public can add entries"
  on entries for insert
  with check (true);

create policy "authenticated can delete entries"
  on entries for delete
  to authenticated
  using (true);

-- ── Functions ────────────────────────────────────────────────────────────────
-- Allows the anon key to cache a description on a book row without needing
-- a broad UPDATE policy. security definer runs as the table owner, bypassing
-- RLS. Only writes when description is currently null (won't overwrite admin edits).

create or replace function cache_book_description(book_isbn text, book_description text)
returns void
language sql
security definer
as $$
  update books
  set description = book_description
  where isbn = book_isbn
    and description is null;
$$;

create or replace function cache_book_cover(book_isbn text, book_cover_url text)
returns void
language sql
security definer
as $$
  update books
  set cover_url = book_cover_url
  where isbn = book_isbn
    and cover_url is null;
$$;

-- ── Book Submissions ─────────────────────────────────────────────────────────
-- Visitors submit books they want to release into the wild.
-- Admin reviews and approves (which inserts into books) or declines.

create table book_submissions (
  id           uuid primary key default gen_random_uuid(),
  isbn         text not null,
  title        text,
  author       text,
  cover_url    text,   -- cached to Supabase Storage (entry-photos/covers/<isbn>.jpg) at submission time
  description  text,   -- fetched from Open Library at submission time
  passcode     text not null,
  release_note text,
  released_by  text,
  created_at   timestamptz not null default now()
);

alter table book_submissions enable row level security;

create policy "public can submit books"
  on book_submissions for insert
  with check (true);

create policy "authenticated can manage submissions"
  on book_submissions for all
  to authenticated
  using (true);

-- Migration: alter table book_submissions add column if not exists description text;

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Public bucket for entry photos (visitors upload; anyone can view)

insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', true)
on conflict do nothing;

create policy "anyone can upload entry photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'entry-photos');

create policy "entry photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'entry-photos');

create policy "authenticated can delete entry photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'entry-photos');
