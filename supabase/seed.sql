-- Demo data: the six venues from src/venues.ts and a few showtimes for each.
-- movie_id matches an entry in src/movies.ts.

insert into public.venues (id, name) values
  ('multiplex', 'Standard multiplex'),
  ('dolby', 'Dolby Cinema'),
  ('bfi', 'BFI IMAX'),
  ('tcl', 'TCL Chinese Theatre IMAX'),
  ('melbourne', 'IMAX Melbourne'),
  ('leonberg', 'Traumpalast IMAX')
on conflict (id) do update set name = excluded.name;

insert into public.shows (venue_id, title, movie_id, starts_at)
select v.id, m.title, m.movie_id, date_trunc('day', now()) + (d.day || ' days')::interval + m.at
from public.venues v
cross join (values
  ('Spider-Man: No Way Home', 'nwh-trailer', interval '14 hours'),
  ('Spider-Man: Brand New Day', 'bnd-trailer', interval '17 hours 30 minutes'),
  ('Tears of Steel', 'tears-of-steel', interval '21 hours')
) as m (title, movie_id, at)
cross join (values (0), (1), (2)) as d (day)
where not exists (select 1 from public.shows);
