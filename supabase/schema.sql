-- Run this once in the SQL Editor of a new Supabase project.
create table public.items (
  id text primary key,
  kind text not null check (kind in ('module', 'note', 'reminder', 'task', 'budget_category', 'budget_item', 'photo')),
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  changed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  device text not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Visible to every signed-in account, and any of them can change it.
  shared boolean not null default false
);

comment on table public.items is 'Every module, note, reminder and task, stored one row per record.';
comment on column public.items.deleted is 'Deleted records stay as markers so other devices can remove them too.';
comment on column public.items.changed_at is 'When the record was edited on the device. The newest edit wins.';
comment on column public.items.synced_at is 'When the server received the record. Devices use it to fetch what is new.';

create index items_synced_at_idx on public.items (synced_at);
create index items_user_synced_idx on public.items (user_id, synced_at);
create index items_shared_idx on public.items (kind) where shared;

-- An offline device may upload old edits late, so an older edit must never replace a newer one.
create function public.items_keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.changed_at < old.changed_at then
      return null;
    end if;
    -- An item can never move to another account.
    new.user_id := old.user_id;
    -- Someone else's shared item stays shared, and a shared module can't be deleted by someone else.
    if old.user_id is distinct from auth.uid() then
      new.shared := old.shared;
      if old.kind = 'module' and old.shared then
        new.deleted := old.deleted;
      end if;
    end if;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create trigger items_keep_newest
before insert or update on public.items
for each row execute function public.items_keep_newest();

alter table public.items enable row level security;

-- Each account can only see and change its own rows, plus shared ones. Nothing can be permanently deleted:
-- deleting only sets the deleted flag.
create policy "Accounts read their own and shared items" on public.items for select to authenticated using (user_id = (select auth.uid()) or shared);
create policy "Accounts add their items" on public.items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Accounts change their own and shared items" on public.items for update to authenticated using (user_id = (select auth.uid()) or shared) with check (user_id = (select auth.uid()) or shared);

-- Main account backups. See migrations/2026-11-20-admin-export.sql; add the main account to public.admins after it signs up.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

-- Whether the signed-in account is a main account, so the app knows to show the button.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Every account with all of its items, in the same layout as a normal backup.
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

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.export_all_accounts() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.export_all_accounts() to authenticated;

-- Photos in notes. See migrations/2026-11-24-note-photos.sql.
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
