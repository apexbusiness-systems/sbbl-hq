-- Reclassify mis-tagged TGIFBL POTG records that were saved under WBL.
-- Scope: POTG cards with TGIF team signatures from the 2026-04 annotated batch.

with league_ids as (
  select
    (
      select l.id
      from public.leagues l
      where lower(l.code) = 'wbl'
      order by l.id
      limit 1
    ) as wbl_id,
    (
      select l.id
      from public.leagues l
      where lower(l.code) = 'tgifbl'
      order by l.id
      limit 1
    ) as tgifbl_id
),
patterns as (
  select array[
    '%jc trans jrs%',
    '%banayad hoopers%',
    '%full time ballers%',
    '%dbrkdz%',
    '%osy x lcl%',
    '%batang riles x tri j%',
    '%j elite%',
    '%fourteen ounce%',
    '%14oz%',
    '%city above elite%',
    '%conceited fantasy%',
    '%mantiku%',
    '%blbg%',
    '%yg%',
    '%c&f%'
  ]::text[] as team_like
)
update public.media_assets ma
set league_id = li.tgifbl_id,
    updated_at = now()
from league_ids li, patterns p
where li.wbl_id is not null
  and li.tgifbl_id is not null
  and ma.league_id = li.wbl_id
  and (
    lower(coalesce(ma.title, '')) like any (p.team_like)
    or lower(coalesce(ma.metadata->>'team', '')) like any (p.team_like)
    or lower(coalesce(ma.metadata->>'gameResult', '')) like any (p.team_like)
  );

with league_ids as (
  select
    (
      select l.id
      from public.leagues l
      where lower(l.code) = 'wbl'
      order by l.id
      limit 1
    ) as wbl_id,
    (
      select l.id
      from public.leagues l
      where lower(l.code) = 'tgifbl'
      order by l.id
      limit 1
    ) as tgifbl_id
),
patterns as (
  select array[
    '%jc trans jrs%',
    '%banayad hoopers%',
    '%full time ballers%',
    '%dbrkdz%',
    '%osy x lcl%',
    '%batang riles x tri j%',
    '%j elite%',
    '%fourteen ounce%',
    '%14oz%',
    '%city above elite%',
    '%conceited fantasy%',
    '%mantiku%',
    '%blbg%',
    '%yg%',
    '%c&f%'
  ]::text[] as team_like
)
update public.media_publications mp
set league_id = li.tgifbl_id
from league_ids li, patterns p
where li.wbl_id is not null
  and li.tgifbl_id is not null
  and mp.surface = 'potg'
  and mp.league_id = li.wbl_id
  and (
    lower(coalesce(mp.title, '')) like any (p.team_like)
    or lower(coalesce(mp.render_payload->>'team', '')) like any (p.team_like)
    or lower(coalesce(mp.render_payload->>'gameResult', '')) like any (p.team_like)
  );

with patterns as (
  select array[
    '%jc trans jrs%',
    '%banayad hoopers%',
    '%full time ballers%',
    '%dbrkdz%',
    '%osy x lcl%',
    '%batang riles x tri j%',
    '%j elite%',
    '%fourteen ounce%',
    '%14oz%',
    '%city above elite%',
    '%conceited fantasy%',
    '%mantiku%',
    '%blbg%',
    '%yg%',
    '%c&f%'
  ]::text[] as team_like
)
update public.import_jobs ij
set payload_summary = jsonb_set(
      jsonb_set(ij.payload_summary, '{leagueId}', to_jsonb('tgifbl'::text), true),
      '{reclassifiedFromLeagueId}',
      to_jsonb(coalesce(ij.payload_summary->>'leagueId', 'wbl')::text),
      true
    ),
    updated_at = now()
from patterns p
where ij.job_type = 'potg_award'
  and lower(coalesce(ij.payload_summary->>'leagueId', '')) = 'wbl'
  and (
    lower(coalesce(ij.payload_summary->>'team', '')) like any (p.team_like)
    or lower(coalesce(ij.payload_summary->>'gameResult', '')) like any (p.team_like)
  );
