-- Accounts, part 1 of 2. Run before the version of the app with sign in goes live.
-- Each row gets an owner. Signed-in accounts can only see and change their own rows.
-- The old no-login access keeps working until part 2, so nothing breaks in between.

alter table public.items
  add column user_id uuid references auth.users (id) on delete cascade default auth.uid();

create index items_user_synced_idx on public.items (user_id, synced_at);

create policy "Accounts read their items" on public.items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Accounts add their items" on public.items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Accounts change their items" on public.items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- An item can never move to another account, and an older edit never replaces a newer one.
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
    new.user_id := old.user_id;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;
