-- Run this once in the SQL Editor of a new Supabase project.
create table public.items (
  id text primary key,
  kind text not null check (kind in ('module', 'note', 'reminder', 'task', 'budget_category', 'budget_item')),
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  changed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  device text not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid()
);

comment on table public.items is 'Every module, note, reminder and task, stored one row per record.';
comment on column public.items.deleted is 'Deleted records stay as markers so other devices can remove them too.';
comment on column public.items.changed_at is 'When the record was edited on the device. The newest edit wins.';
comment on column public.items.synced_at is 'When the server received the record. Devices use it to fetch what is new.';

create index items_synced_at_idx on public.items (synced_at);
create index items_user_synced_idx on public.items (user_id, synced_at);

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
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create trigger items_keep_newest
before insert or update on public.items
for each row execute function public.items_keep_newest();

alter table public.items enable row level security;

-- Each account can only see and change its own rows. Nothing can be permanently deleted:
-- deleting only sets the deleted flag.
create policy "Accounts read their items" on public.items for select to authenticated using (user_id = (select auth.uid()));
create policy "Accounts add their items" on public.items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Accounts change their items" on public.items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
