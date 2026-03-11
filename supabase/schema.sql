-- Between Readers — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table books (
  id             uuid primary key default gen_random_uuid(),
  isbn           text not null unique,
  title          text not null,
  author         text not null,
  cover_url      text,
  release_note   text,
  released_by    text,
  created_at     timestamptz not null default now()
);

create table entries (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  location    text not null,
  message     text,
  found_at    date,
  created_at  timestamptz not null default now()
);

create index entries_book_id_idx on entries(book_id);

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
