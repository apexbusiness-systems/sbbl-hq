alter table media_publications
  add column if not exists sort_order integer default 0;

comment on column media_publications.sort_order is
  'Owner-controlled manual ordering for public /media feed (ascending).';
