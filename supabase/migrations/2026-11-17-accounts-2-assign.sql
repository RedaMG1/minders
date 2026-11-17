-- Accounts, part 2 of 2. Run after the account redareada6@gmail.com has been created and confirmed.
-- Gives every existing row to that account, then turns off access without signing in.

do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'redareada6@gmail.com';
  if owner_id is null then
    raise exception 'No account for redareada6@gmail.com yet. Create it in the app first.';
  end if;
  update public.items set user_id = owner_id where user_id is null;
end;
$$;

alter table public.items alter column user_id set not null;

drop policy "App can read items" on public.items;
drop policy "App can add items" on public.items;
drop policy "App can change items" on public.items;
