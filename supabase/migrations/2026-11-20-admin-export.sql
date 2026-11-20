-- The main account can download a backup of every account. Run after the accounts migrations.

-- Accounts allowed to download everyone's data. Nobody can read or change this table from the app.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

insert into public.admins (user_id)
select id from auth.users where email = 'redareada6@gmail.com';

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
        'budgetItems', coalesce((select jsonb_agg(i.data order by i.changed_at) from public.items i where i.user_id = u.id and i.kind = 'budget_item' and not i.deleted), '[]')
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
