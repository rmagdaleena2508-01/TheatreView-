-- Phase 4: shows, seat holds and bookings.
--
-- Seat positions are NOT stored here. The frontend builds every auditorium from
-- src/venues.ts the same way each time, so a seat id like "H12" plus a venue id is
-- enough to know exactly which seat it is.
--
-- Clients never write to these tables directly. They call the functions below,
-- which do each change in one atomic step so two people can't grab the same seat.

create table public.venues (
  id text primary key,
  name text not null
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null
);
create index shows_venue_starts_idx on public.shows (venue_id, starts_at);

-- A hold keeps a seat for one person for a few minutes while they decide.
-- An expired hold simply stops counting; nothing has to delete it on time.
create table public.seat_holds (
  show_id uuid not null references public.shows (id) on delete cascade,
  seat_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  primary key (show_id, seat_id)
);
create index seat_holds_user_idx on public.seat_holds (user_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  seat_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, seat_id) -- the database itself refuses a second booking
);
create index bookings_user_idx on public.bookings (user_id);

-- Row Level Security: anyone can read venues and shows. People can only read
-- their own holds and bookings. Nobody can write directly; only the functions can.
alter table public.venues enable row level security;
alter table public.shows enable row level security;
alter table public.seat_holds enable row level security;
alter table public.bookings enable row level security;

create policy "Venues are public" on public.venues for select to anon, authenticated using (true);
create policy "Shows are public" on public.shows for select to anon, authenticated using (true);
create policy "See your own holds" on public.seat_holds for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "See your own bookings" on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id);

-- Which seats are taken for a show, without revealing who took them.
create or replace function public.get_seat_states(p_show uuid)
returns table (seat_id text, state text, mine boolean, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.seat_id, 'booked', b.user_id = (select auth.uid()), null::timestamptz
  from public.bookings b
  where b.show_id = p_show
  union all
  select h.seat_id, 'held', h.user_id = (select auth.uid()), h.expires_at
  from public.seat_holds h
  where h.show_id = p_show and h.expires_at > now()
$$;

-- Hold a seat for 5 minutes. Succeeds only if the seat is free, its old hold has
-- expired, or you already hold it. You can hold one seat per show at a time.
create or replace function public.hold_seat(p_show uuid, p_seat text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  held_until timestamptz;
begin
  if uid is null then
    raise exception 'Please sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.bookings where show_id = p_show and seat_id = p_seat) then
    raise exception 'This seat is already booked' using errcode = 'P0001';
  end if;

  delete from public.seat_holds where show_id = p_show and user_id = uid and seat_id <> p_seat;

  insert into public.seat_holds as h (show_id, seat_id, user_id, expires_at)
  values (p_show, p_seat, uid, now() + interval '5 minutes')
  on conflict (show_id, seat_id) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at
    where h.expires_at <= now() or h.user_id = uid
  returning h.expires_at into held_until;

  if held_until is null then
    raise exception 'Someone else is holding this seat' using errcode = 'P0001';
  end if;
  return held_until;
end;
$$;

-- Let go of your hold for a show.
create or replace function public.release_hold(p_show uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.seat_holds where show_id = p_show and user_id = (select auth.uid())
$$;

-- Turn your (still valid) hold into a booking.
-- Phase 5 puts a Stripe test payment in front of this step.
create or replace function public.book_seat(p_show uuid, p_seat text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  booking_id uuid;
begin
  if uid is null then
    raise exception 'Please sign in first' using errcode = '28000';
  end if;

  delete from public.seat_holds
  where show_id = p_show and seat_id = p_seat and user_id = uid and expires_at > now();
  if not found then
    raise exception 'Your hold on this seat ran out. Please select it again.' using errcode = 'P0001';
  end if;

  insert into public.bookings (show_id, seat_id, user_id)
  values (p_show, p_seat, uid)
  returning id into booking_id;
  return booking_id;
end;
$$;

revoke all on function public.get_seat_states(uuid) from public;
revoke all on function public.hold_seat(uuid, text) from public;
revoke all on function public.release_hold(uuid) from public;
revoke all on function public.book_seat(uuid, text) from public;
grant execute on function public.get_seat_states(uuid) to anon, authenticated;
grant execute on function public.hold_seat(uuid, text) to authenticated;
grant execute on function public.release_hold(uuid) to authenticated;
grant execute on function public.book_seat(uuid, text) to authenticated;

-- Live updates: whenever a hold or booking changes, tell everyone watching that
-- show. The message only says which seat changed, never who changed it.
create or replace function public.broadcast_seat_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_show uuid := coalesce(new.show_id, old.show_id);
  row_seat text := coalesce(new.seat_id, old.seat_id);
begin
  perform realtime.send(
    jsonb_build_object('seat_id', row_seat),
    'seat_changed',
    'show:' || row_show::text,
    false
  );
  return null;
end;
$$;

create trigger seat_holds_broadcast
after insert or update or delete on public.seat_holds
for each row execute function public.broadcast_seat_change();

create trigger bookings_broadcast
after insert or update or delete on public.bookings
for each row execute function public.broadcast_seat_change();
