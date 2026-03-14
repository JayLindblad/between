-- Between Readers — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- ── Tables ──────────────────────────────────────────────────────────────────

-- isbn_metadata is the single source of truth for book metadata.
-- It holds every ISBN ever looked up, whether or not it has been released.
-- books, entries, and book_submissions all hang off this table via FK.

create table isbn_metadata (
  isbn        text primary key,
  title       text,
  author      text,
  cover_url   text,   -- starts as external URL; updated to storage URL after background upload
  description text,   -- fetched from Open Library; updated in the background after initial lookup
  fetched_at  timestamptz not null default now()
);

-- books: ISBNs that have been released into the wild (admin-approved).
-- Metadata (title/author/cover/description) lives in isbn_metadata.
create table books (
  isbn         text primary key references isbn_metadata(isbn) on delete cascade,
  release_note text,
  released_by  text,
  passcode     text   -- 6-digit code written in pen inside the book; required to view journey
);

create table entries (
  id                   uuid primary key default gen_random_uuid(),
  isbn                 text not null references books(isbn) on delete cascade,
  finder_name          text,                 -- optional name or handle of the person who found the book
  found_location       text not null,        -- geocodable place name (city/region) for map pins
  location_description text,                 -- optional free-text spot description ("on a park bench…")
  message              text,
  photo_url            text,                 -- public URL of uploaded photo in Supabase Storage
  found_date           date,
  lat                  double precision,     -- geocoded latitude stored at submission time
  lng                  double precision,     -- geocoded longitude stored at submission time
  created_at           timestamptz not null default now()
);

create index entries_isbn_idx on entries(isbn);

-- ── Book Submissions ─────────────────────────────────────────────────────────
-- Visitors submit books they want to release into the wild.
-- Admin reviews and approves (which inserts into books) or declines.
-- Metadata lives in isbn_metadata — always populated at lookup time before submit.

create table book_submissions (
  id           uuid primary key default gen_random_uuid(),
  isbn         text not null references isbn_metadata(isbn) on delete cascade,
  passcode     text not null,
  release_note text,
  released_by  text,
  created_at   timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table isbn_metadata   enable row level security;
alter table books           enable row level security;
alter table entries         enable row level security;
alter table book_submissions enable row level security;

-- isbn_metadata: public read; all writes go through security definer RPCs
create policy "public can read isbn metadata"
  on isbn_metadata for select
  using (true);

-- Authenticated (admin) can update metadata (e.g. title/author edits from admin panel)
create policy "authenticated can update isbn metadata"
  on isbn_metadata for update
  to authenticated
  using (true);

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

-- Submissions
create policy "public can submit books"
  on book_submissions for insert
  with check (true);

create policy "authenticated can manage submissions"
  on book_submissions for all
  to authenticated
  using (true);

-- ── Functions ────────────────────────────────────────────────────────────────

-- cache_isbn_metadata: upserts a row into isbn_metadata.
-- COALESCE logic: first call sets all fields; later calls only fill in NULLs.
-- Exception: cover_url is always updated if the incoming value is non-null,
-- so the background storage-upload task can upgrade an external URL to a stable URL.
create or replace function cache_isbn_metadata(
  p_isbn        text,
  p_title       text,
  p_author      text,
  p_cover_url   text,
  p_description text
)
returns void
language sql
security definer
as $$
  insert into isbn_metadata (isbn, title, author, cover_url, description)
  values (p_isbn, p_title, p_author, p_cover_url, p_description)
  on conflict (isbn) do update set
    title       = coalesce(excluded.title,       isbn_metadata.title),
    author      = coalesce(excluded.author,      isbn_metadata.author),
    cover_url   = coalesce(excluded.cover_url,   isbn_metadata.cover_url),
    description = coalesce(excluded.description, isbn_metadata.description);
$$;

-- cache_book_description: writes description to isbn_metadata when currently null.
-- Called from the browser's anon key; security definer bypasses RLS.
create or replace function cache_book_description(book_isbn text, book_description text)
returns void
language sql
security definer
as $$
  update isbn_metadata
  set description = book_description
  where isbn = book_isbn
    and description is null;
$$;

-- cache_book_cover: writes cover_url to isbn_metadata (always overwrites so storage
-- URL can replace the original external URL).
create or replace function cache_book_cover(book_isbn text, book_cover_url text)
returns void
language sql
security definer
as $$
  update isbn_metadata
  set cover_url = book_cover_url
  where isbn = book_isbn;
$$;

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Public bucket for entry photos and cached book covers (visitors upload; anyone can view)

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

-- ── Migration (for existing deployments) ─────────────────────────────────────
-- Run these in order in the Supabase SQL Editor if upgrading from the old schema
-- where books stored title/author/cover_url/description directly.
--
-- Step 1 — ensure isbn_metadata exists (new table in this schema version):
--   create table if not exists isbn_metadata ( ... ); -- see above
--
-- Step 2 — copy existing books metadata into isbn_metadata:
--   insert into isbn_metadata (isbn, title, author, cover_url, description)
--   select isbn, title, author, cover_url, description from books
--   on conflict (isbn) do nothing;
--
-- Step 3 — copy existing book_submissions isbn values into isbn_metadata
--   (only needed if book_submissions has rows with ISBNs not already in isbn_metadata):
--   insert into isbn_metadata (isbn) select distinct isbn from book_submissions
--   on conflict (isbn) do nothing;
--
-- Step 4 — add FK from books.isbn to isbn_metadata.isbn:
--   alter table books
--     add constraint books_isbn_fkey foreign key (isbn) references isbn_metadata(isbn) on delete cascade;
--
-- Step 5 — add FK from book_submissions.isbn to isbn_metadata.isbn:
--   alter table book_submissions
--     add constraint book_submissions_isbn_fkey foreign key (isbn) references isbn_metadata(isbn) on delete cascade;
--
-- Step 6 — drop now-redundant columns from books:
--   alter table books
--     drop column if exists title,
--     drop column if exists author,
--     drop column if exists cover_url,
--     drop column if exists description;
--
-- Step 7 — update the RPCs (replace cache_book_description and cache_book_cover
--   with the versions above that target isbn_metadata instead of books).
--
-- Step 8 — add finder_name column to entries (if upgrading from a schema without it):
--   alter table entries add column if not exists finder_name text;
