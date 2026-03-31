do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_insert'
  ) then
    execute $policy$
      create policy profiles_self_insert on public.profiles
      for insert
      to authenticated
      with check (user_id = auth.uid())
    $policy$;
  end if;
end $$;

alter policy profiles_self_update on public.profiles
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_role_assignments'
      and policyname = 'user_role_assignments_self_read'
  ) then
    execute $policy$
      create policy user_role_assignments_self_read on public.user_role_assignments
      for select
      to authenticated
      using (user_id = auth.uid())
    $policy$;
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'media_avatar_insert'
  ) then
    execute $policy$
      create policy media_avatar_insert on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'media'
        and auth.uid() is not null
        and name like ('avatars/' || auth.uid()::text || '/%')
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'media_avatar_select'
  ) then
    execute $policy$
      create policy media_avatar_select on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'media'
        and auth.uid() is not null
        and name like ('avatars/' || auth.uid()::text || '/%')
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'media_avatar_update'
  ) then
    execute $policy$
      create policy media_avatar_update on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'media'
        and auth.uid() is not null
        and name like ('avatars/' || auth.uid()::text || '/%')
      )
      with check (
        bucket_id = 'media'
        and auth.uid() is not null
        and name like ('avatars/' || auth.uid()::text || '/%')
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'store_products_ops_select'
  ) then
    execute $policy$
      create policy store_products_ops_select on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'store-products'
        and exists (
          select 1
          from public.user_role_assignments ura
          where ura.user_id = auth.uid()
            and ura.role in ('league_admin', 'super_admin', 'media_operator', 'store_operator')
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'store_products_ops_insert'
  ) then
    execute $policy$
      create policy store_products_ops_insert on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'store-products'
        and exists (
          select 1
          from public.user_role_assignments ura
          where ura.user_id = auth.uid()
            and ura.role in ('league_admin', 'super_admin', 'media_operator', 'store_operator')
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'store_products_ops_update'
  ) then
    execute $policy$
      create policy store_products_ops_update on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'store-products'
        and exists (
          select 1
          from public.user_role_assignments ura
          where ura.user_id = auth.uid()
            and ura.role in ('league_admin', 'super_admin', 'media_operator', 'store_operator')
        )
      )
      with check (
        bucket_id = 'store-products'
        and exists (
          select 1
          from public.user_role_assignments ura
          where ura.user_id = auth.uid()
            and ura.role in ('league_admin', 'super_admin', 'media_operator', 'store_operator')
        )
      )
    $policy$;
  end if;
end $$;
