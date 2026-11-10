-- Lets the items table store budget categories and budget items.
-- Run once in the SQL Editor of a project created from an older schema.sql.
alter table public.items
  drop constraint items_kind_check,
  add constraint items_kind_check
    check (kind in ('module', 'note', 'reminder', 'task', 'budget_category', 'budget_item'));
