-- Notifications: where each phone can be reached, what was already sent, and a job that runs every minute.
-- Run once in the SQL Editor, after both accounts migrations and after the notifications Edge Function is deployed.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One row per phone or browser that turned notifications on.
create table public.push_subscriptions (
  endpoint text primary key,
  -- The account whose tasks and reminders this device gets.
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  timezone text not null,
  digest_time text not null default '08:00' check (digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  digest_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  last_digest_date text,
  last_test_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every reminder notification sent, so none goes out twice.
create table public.push_sent (
  item_id text not null,
  fire_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, fire_at)
);

-- The keys that sign notifications. Created by the Edge Function the first time it runs.
create table public.push_config (
  id int primary key default 1 check (id = 1),
  vapid jsonb not null
);

-- No policies: the public key can't read or change these tables directly.
alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security;
alter table public.push_config enable row level security;

-- The app signs a device up, or changes its settings, through this function only.
create function public.save_push_subscription(
  p_subscription jsonb,
  p_timezone text,
  p_digest_time text,
  p_digest_enabled boolean,
  p_reminders_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_endpoint text := p_subscription ->> 'endpoint';
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in first';
  end if;
  if v_endpoint is null or v_endpoint not like 'https://%' then
    raise exception 'Invalid push subscription';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, subscription, timezone, digest_time, digest_enabled, reminders_enabled)
  values (v_endpoint, v_user, p_subscription, p_timezone, p_digest_time, p_digest_enabled, p_reminders_enabled)
  on conflict (endpoint) do update set
    -- A device that changed account now gets the new account's notifications.
    user_id = excluded.user_id,
    subscription = excluded.subscription,
    timezone = excluded.timezone,
    digest_time = excluded.digest_time,
    digest_enabled = excluded.digest_enabled,
    reminders_enabled = excluded.reminders_enabled,
    updated_at = now();
end;
$$;

create function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(jsonb, text, text, boolean, boolean) from public;
revoke all on function public.remove_push_subscription(text) from public;
grant execute on function public.save_push_subscription(jsonb, text, text, boolean, boolean) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- Every minute, ask the Edge Function to send whatever is due.
select cron.schedule(
  'minders-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://lmaxbibmdytwfujfcqcz.supabase.co/functions/v1/notifications',
    body := '{"action": "tick"}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
