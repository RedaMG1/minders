-- Photos in notes. Each account keeps its photos in its own folder, <account id>/<note id>/<photo id>.jpg,
-- and can only add, open or delete files in that folder. Nothing is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-photos', 'note-photos', false, 15728640, array['image/jpeg']);

create policy "Accounts open their own note photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Accounts add their own note photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Accounts delete their own note photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Each photo is also its own synced item (kind 'photo'), owned by the account that added it and never shared.
alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('module', 'note', 'reminder', 'task', 'budget_category', 'budget_item', 'photo'));

-- The main account's full download lists each account's photos too (the files stay in storage).
create or replace function public.export_all_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid())) then
    raise exception 'Only the main account can download every account.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'email', u.email,
        'createdAt', u.created_at,
        'modules', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'module' and not i.deleted), '[]'),
        'notes', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'note' and not i.deleted), '[]'),
        'reminders', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'reminder' and not i.deleted), '[]'),
        'tasks', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'task' and not i.deleted), '[]'),
        'budgetCategories', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'budget_category' and not i.deleted), '[]'),
        'budgetItems', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'budget_item' and not i.deleted), '[]'),
        'photos', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'photo' and not i.deleted), '[]')
      )
      order by u.created_at
    )
    from auth.users u
  ), '[]');
end;
$$;
