alter table media_publications
  add column if not exists sort_order integer;

alter table media_publications
  alter column sort_order drop not null,
  alter column sort_order set default 0;

comment on column media_publications.sort_order is
  'Owner-controlled manual ordering for public /media feed (ascending, nullable with default 0).';
