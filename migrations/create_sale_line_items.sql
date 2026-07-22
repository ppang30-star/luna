-- Flattened relational table for per-item / per-combo-option sales statistics.
-- ADDITIVE ONLY: does not modify or drop sales_records. Existing reads/writes are unaffected.

create table if not exists public.sale_line_items (
  id             bigint generated always as identity primary key,
  sale_record_id bigint references public.sales_records(id) on delete cascade,
  bill_id        bigint,
  created_at     timestamptz not null default now(),
  line_type      text not null default 'item',   -- 'item' | 'combo_option'
  parent_menu_id text,
  parent_name_ko text,
  parent_name_en text,
  combo_group_ko text,      -- combo group Korean name (combo_option rows only)
  item_name_ko   text,
  item_name_en   text,
  quantity       numeric not null default 0,
  unit_price     numeric not null default 0,
  line_total     numeric not null default 0,
  payment_method text
);

create index if not exists idx_sli_created_at   on public.sale_line_items(created_at);
create index if not exists idx_sli_item_name_ko on public.sale_line_items(item_name_ko);
create index if not exists idx_sli_line_type    on public.sale_line_items(line_type);
create index if not exists idx_sli_sale_record  on public.sale_line_items(sale_record_id);

-- Mirror the exact RLS posture of sales_records (public read/insert/delete).
alter table public.sale_line_items enable row level security;

create policy "Allow public read access"   on public.sale_line_items for select using (true);
create policy "Allow public insert access" on public.sale_line_items for insert with check (true);
create policy "Allow public delete access" on public.sale_line_items for delete using (true);

-- One-time backfill of existing sales_records into parent 'item' rows.
-- Historical rows contain no comboOptions, so only parent item rows are produced.
insert into public.sale_line_items (
  sale_record_id, bill_id, created_at, line_type,
  parent_menu_id, parent_name_ko, parent_name_en,
  item_name_ko, item_name_en, quantity, unit_price, line_total, payment_method
)
select
  sr.id,
  sr.bill_id,
  sr.created_at,
  'item',
  it->>'menuId',
  it->>'nameKo',
  it->>'nameEn',
  it->>'nameKo',
  it->>'nameEn',
  coalesce((it->>'quantity')::numeric, 0),
  coalesce((it->>'unitPrice')::numeric, 0),
  coalesce((it->>'quantity')::numeric, 0) * coalesce((it->>'unitPrice')::numeric, 0),
  sr.payment_method
from public.sales_records sr
cross join lateral jsonb_array_elements(sr.items) as it;

-- One-time backfill of combo sub-items where present (none in historical data).
insert into public.sale_line_items (
  sale_record_id, bill_id, created_at, line_type,
  parent_menu_id, parent_name_ko, parent_name_en,
  combo_group_ko, item_name_ko, item_name_en, quantity, unit_price, line_total, payment_method
)
select
  sr.id, sr.bill_id, sr.created_at, 'combo_option',
  it->>'menuId', it->>'nameKo', it->>'nameEn',
  opt->>'groupName', opt->>'itemName', opt->>'itemName',
  coalesce((opt->>'quantity')::numeric, 0) * coalesce((it->>'quantity')::numeric, 1),
  0, 0, sr.payment_method
from public.sales_records sr
cross join lateral jsonb_array_elements(sr.items) as it
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(it->'comboOptions') = 'array' then it->'comboOptions' else '[]'::jsonb end
) as opt;
