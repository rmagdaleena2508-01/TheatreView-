-- Each showtime now plays a movie from the catalog in src/movies.ts.
alter table public.shows add column movie_id text;

update public.shows set title = 'Spider-Man: No Way Home', movie_id = 'nwh-trailer'
where title = 'Big Buck Bunny';
update public.shows set title = 'Spider-Man: Brand New Day', movie_id = 'bnd-trailer'
where title = 'Sintel';
update public.shows set movie_id = 'tears-of-steel'
where title = 'Tears of Steel';
