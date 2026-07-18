-- Gap 7: Drop the redundant public-read policy on media_publications.
--
-- Context: media_publications has two functionally identical SELECT policies
-- that both permit public reads on rows where status = 'published':
--   * media_publications_public_read  (leftover from an earlier naming convention)
--   * public_read_published           (canonical name, current convention)
--
-- This is a benign duplicate (same predicate, same permission, no security gap),
-- but it adds noise to RLS reasoning and could mislead future reviewers.
-- Dropping the older name keeps the table consistent with the established naming
-- pattern used on sibling tables (media_assets, ingest_jobs).
--
-- Rollback: re-create with the exact same definition if needed.
-- create policy media_publications_public_read on media_publications
--   as permissive for select to public
--   using (status = 'published');

drop policy if exists media_publications_public_read on media_publications;

-- public_read_published remains as the sole canonical public-read policy.
-- super_admin_full_access (ALL for super_admin role) remains unchanged.
