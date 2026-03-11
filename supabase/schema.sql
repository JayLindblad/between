-- Between Readers — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table books (
  isbn        text primary key,
  title       text not null,
  author      text not null,
  cover_url   text
);

create table entries (
  id               uuid primary key default gen_random_uuid(),
  isbn             text not null references books(isbn) on delete cascade,
  found_location   text not null,
  found_date       date not null,
  message          text,
  photo_url        text,
  created_at       timestamptz not null default now()
);

create index entries_isbn_idx on entries(isbn);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The anon key is public (used in the browser). RLS ensures visitors can only
-- read books and add entries — they cannot insert, update, or delete books.

alter table books  enable row level security;
alter table entries enable row level security;

-- Books: anyone can read, only authenticated users (you, via the dashboard or
-- service-role key) can insert/update/delete.
create policy "public can read books"
  on books for select
  using (true);

-- Entries: anyone can read and insert (adding a journey entry is the core UX),
-- but nobody can update or delete via the anon key.
create policy "public can read entries"
  on entries for select
  using (true);

create policy "public can add entries"
  on entries for insert
  with check (true);
