-- Painel DRE — schema do banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e clique em "Run".

create extension if not exists "pgcrypto";

-- =========================================================
-- Tabela de empresas
-- Cada empresa pertence a exatamente um usuário (user_id).
-- =========================================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies
  for select using (auth.uid() = user_id);

drop policy if exists "companies_insert_own" on public.companies;
create policy "companies_insert_own" on public.companies
  for insert with check (auth.uid() = user_id);

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own" on public.companies
  for update using (auth.uid() = user_id);

drop policy if exists "companies_delete_own" on public.companies;
create policy "companies_delete_own" on public.companies
  for delete using (auth.uid() = user_id);

-- =========================================================
-- Tabela de transações
-- Cada transação pertence a uma empresa (company_id).
-- O acesso só é permitido se a empresa pertencer ao usuário logado —
-- é essa checagem que garante que os dados de uma empresa nunca se
-- misturam com os de outra, mesmo que haja um bug na aplicação.
-- =========================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(14, 2) not null,
  category text not null default 'Outras Despesas',
  account text not null default 'Conta',
  tipo text not null default 'banco' check (tipo in ('cartao', 'banco')),
  created_at timestamptz not null default now()
);

create index if not exists transactions_company_id_idx on public.transactions(company_id);
create index if not exists transactions_date_idx on public.transactions(date);

-- Caso a tabela já existisse antes da coluna "tipo" ser introduzida:
alter table public.transactions add column if not exists tipo text not null default 'banco';
alter table public.transactions drop constraint if exists transactions_tipo_check;
alter table public.transactions add constraint transactions_tipo_check check (tipo in ('cartao', 'banco'));

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (
    exists (
      select 1 from public.companies c
      where c.id = transactions.company_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (
    exists (
      select 1 from public.companies c
      where c.id = transactions.company_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (
    exists (
      select 1 from public.companies c
      where c.id = transactions.company_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (
    exists (
      select 1 from public.companies c
      where c.id = transactions.company_id and c.user_id = auth.uid()
    )
  );
