-- Accounts, part 3: shared modules. Run after part 2, and before the version of the app with sharing goes live.
-- A shared item is visible to every signed-in account, and any of them can change it.
-- Only the owner can stop sharing an item, and nobody else can delete a shared module.

alter table public.items add column shared boolean not null default false;

create index items_shared_idx on public.items (kind) where shared;

drop policy "Accounts read their items" on public.items;
drop policy "Accounts change their items" on public.items;

create policy "Accounts read their own and shared items" on public.items
  for select to authenticated using (user_id = (select auth.uid()) or shared);
create policy "Accounts change their own and shared items" on public.items
  for update to authenticated using (user_id = (select auth.uid()) or shared) with check (user_id = (select auth.uid()) or shared);

create or replace function public.items_keep_newest()
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
