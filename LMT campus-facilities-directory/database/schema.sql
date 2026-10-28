-- Campus Facilities Directory
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- RLS remains enabled. Public clients may read the directory only.
-- The Express backend uses a server-only service-role key for CRUD; protect
-- all write routes with ADMIN_API_KEY and never expose that key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  category text not null check (category in (
    'Academic', 'Food & Drink', 'Health', 'Sports', 'Student Services',
    'Technology', 'Transport', 'Utilities', 'Other'
  )),
  building text not null check (char_length(trim(building)) between 1 and 160),
  location text not null check (char_length(trim(location)) between 1 and 160),
  description text not null check (char_length(trim(description)) between 1 and 1200),
  opening_hours text not null default 'Not specified',
  contact text not null default 'Not specified',
  accessibility text not null default 'Not specified',
  status text not null default 'Open' check (status in ('Open', 'Closed', 'Limited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facilities_category_idx on public.facilities(category);
create index if not exists facilities_status_idx on public.facilities(status);
create index if not exists facilities_name_idx on public.facilities using gin (to_tsvector('english', name));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists facilities_set_updated_at on public.facilities;
create trigger facilities_set_updated_at
before update on public.facilities
for each row execute function public.set_updated_at();

alter table public.facilities enable row level security;

drop policy if exists "Public can read facilities" on public.facilities;
create policy "Public can read facilities"
on public.facilities for select
to anon, authenticated
using (true);

-- Intentionally no anon/authenticated INSERT, UPDATE or DELETE policies.
-- The backend service-role key bypasses RLS; server-side ADMIN_API_KEY gates writes.
-- Demo records are real database rows inserted by this SQL, not frontend mock data.
insert into public.facilities
  (name, category, building, location, description, opening_hours, contact, accessibility, status)
values
  ('Central Library', 'Academic', 'Learning Centre', 'Ground floor, Block A', 'Quiet study spaces, reference books, borrowing desk and group study areas.', 'Mon–Sat, 8:00 AM–8:00 PM', 'library@campus.edu', 'Ramp access and lift nearby', 'Open'),
  ('Campus Cafeteria', 'Food & Drink', 'Student Commons', 'North courtyard', 'Affordable meals, snacks and drinking water for students.', 'Mon–Sat, 8:00 AM–6:00 PM', 'Cafeteria help desk', 'Step-free entrance', 'Open'),
  ('Health Centre', 'Health', 'Wellness Block', 'Beside the main gate', 'First-aid support and basic student health services.', 'Mon–Fri, 9:00 AM–4:00 PM', 'Campus health desk', 'Accessible entrance', 'Open'),
  ('Sports Ground', 'Sports', 'Outdoor Facilities', 'East campus', 'Outdoor courts and open space for student sports and recreation.', 'Daily, 6:00 AM–7:00 PM', 'Sports office', 'Ask staff about accessible routes', 'Limited'),
  ('Computer Lab', 'Technology', 'Engineering Block', 'Second floor, Room 204', 'Computers and campus network access for coursework and practical sessions.', 'Mon–Fri, 9:00 AM–5:00 PM', 'IT help desk', 'Lift access', 'Open')
on conflict do nothing;
