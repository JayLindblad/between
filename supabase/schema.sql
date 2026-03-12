-- Between Readers — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table books (
  isbn           text primary key,
  title          text not null,
  author         text not null,
  cover_url      text,
  release_note   text,
  released_by    text
);

create table entries (
  id                   uuid primary key default gen_random_uuid(),
  isbn                 text not null references books(isbn) on delete cascade,
  found_location       text not null,        -- geocodable place name (city/region) for map pins
  location_description text,                 -- optional free-text spot description ("on a park bench…")
  message              text,
  found_date           date,
  created_at           timestamptz not null default now()
);

-- Migration: if the table already exists, add the new column with:
-- alter table entries add column if not exists location_description text;

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
