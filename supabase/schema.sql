-- Run this once in the SQL Editor of a new Supabase project.
create table public.items (
  id text primary key,
  kind text not null check (kind in ('module', 'note', 'reminder', 'task')),
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  changed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  device text not null
);

comment on table public.items is 'Every module, note, reminder and task, stored one row per record.';
comment on column public.items.deleted is 'Deleted records stay as markers so other devices can remove them too.';
comment on column public.items.changed_at is 'When the record was edited on the device. The newest edit wins.';
comment on column public.items.synced_at is 'When the server received the record. Devices use it to fetch what is new.';

create index items_synced_at_idx on public.items (synced_at);

-- An offline device may upload old edits late, so an older edit must never replace a newer one.
create function public.items_keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.changed_at < old.changed_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create trigger items_keep_newest
before insert or update on public.items
for each row execute function public.items_keep_newest();

alter table public.items enable row level security;

-- This is a personal app with no login, so the public key can read and write.
-- Nothing can be permanently deleted through it: deleting only sets the deleted flag.
create policy "App can read items" on public.items for select to anon using (true);
create policy "App can add items" on public.items for insert to anon with check (true);
create policy "App can change items" on public.items for update to anon using (true) with check (true);
