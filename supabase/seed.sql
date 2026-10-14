-- Demo data: the six venues from src/venues.ts and a few showtimes for each,
-- using free open movies from the Blender Foundation.

insert into public.venues (id, name) values
  ('multiplex', 'Standard multiplex'),
  ('dolby', 'Dolby Cinema'),
  ('bfi', 'BFI IMAX'),
  ('tcl', 'TCL Chinese Theatre IMAX'),
  ('melbourne', 'IMAX Melbourne'),
  ('leonberg', 'Traumpalast IMAX')
on conflict (id) do update set name = excluded.name;

insert into public.shows (venue_id, title, starts_at)
select v.id, m.title, date_trunc('day', now()) + (d.day || ' days')::interval + m.at
from public.venues v
cross join (values
  ('Big Buck Bunny', interval '14 hours'),
  ('Sintel', interval '17 hours 30 minutes'),
  ('Tears of Steel', interval '21 hours')
) as m (title, at)
cross join (values (0), (1), (2)) as d (day)
where not exists (select 1 from public.shows);
