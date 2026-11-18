-- ============================================================
-- STUDIOFLOW — Contratos com assinatura do cliente por link
-- Rode este arquivo UMA vez em: Supabase > SQL Editor > New query
-- (pode rodar de novo sem problema: ele não apaga nada)
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.contratos (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  job_id                 uuid references public.jobs(id) on delete set null,
  token                  uuid not null unique default gen_random_uuid(),  -- vai no link do cliente
  codigo                 text not null,                                   -- nº que sai no rodapé do PDF
  dados                  jsonb not null,                                  -- campos preenchidos do contrato
  hash_conteudo          text not null,                                   -- SHA-256 do conteúdo enviado
  status                 text not null default 'pendente'
                         check (status in ('pendente', 'assinado', 'cancelado')),

  -- assinatura do CONTRATADO (você)
  assinatura_contratado  text,
  contratado_assinado_em timestamptz,

  -- assinatura do CONTRATANTE (cliente) + registro de evidências
  cliente_assinatura     text,
  cliente_nome           text,
  cliente_cpf            text,
  cliente_assinado_em    timestamptz,
  cliente_ip             text,
  cliente_user_agent     text,
  cliente_visualizado_em timestamptz,

  created_at             timestamptz not null default now()
);

create index if not exists contratos_tenant_idx on public.contratos (tenant_id, created_at desc);

-- ---------- RLS: cada estúdio só enxerga os próprios contratos ----------
alter table public.contratos enable row level security;

drop policy if exists contratos_tenant_select on public.contratos;
drop policy if exists contratos_tenant_insert on public.contratos;
drop policy if exists contratos_tenant_update on public.contratos;
drop policy if exists contratos_tenant_delete on public.contratos;

create policy contratos_tenant_select on public.contratos for select to authenticated
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));
create policy contratos_tenant_insert on public.contratos for insert to authenticated
  with check (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));
create policy contratos_tenant_update on public.contratos for update to authenticated
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));
create policy contratos_tenant_delete on public.contratos for delete to authenticated
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

-- O cliente NÃO tem acesso à tabela. Ele só consegue ler/assinar
-- o contrato do próprio link, pelas duas funções abaixo.

-- ---------- leitura pública por token ----------
drop function if exists public.contrato_por_token(uuid);
create or replace function public.contrato_por_token(p_token uuid)
returns table (
  codigo text, dados jsonb, hash_conteudo text, status text,
  assinatura_contratado text, contratado_assinado_em timestamptz,
  cliente_assinatura text, cliente_nome text, cliente_cpf text,
  cliente_assinado_em timestamptz, cliente_ip text, cliente_user_agent text,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  update contratos as ct set cliente_visualizado_em = coalesce(ct.cliente_visualizado_em, now())
   where ct.token = p_token and ct.status = 'pendente';

  return query
    select c.codigo, c.dados, c.hash_conteudo, c.status,
           c.assinatura_contratado, c.contratado_assinado_em,
           c.cliente_assinatura, c.cliente_nome, c.cliente_cpf,
           c.cliente_assinado_em, c.cliente_ip, c.cliente_user_agent,
           c.created_at
      from contratos c
     where c.token = p_token;
end $$;

-- ---------- assinatura pública por token ----------
create or replace function public.assinar_contrato(
  p_token uuid, p_assinatura text, p_nome text, p_cpf text, p_hash text, p_user_agent text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
  v_quando timestamptz := now();
  v_hash text;
  v_status text;
begin
  select hash_conteudo, status into v_hash, v_status from contratos where token = p_token for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  if v_status = 'assinado' then raise exception 'Este contrato já foi assinado'; end if;
  if v_status = 'cancelado' then raise exception 'Este contrato foi cancelado'; end if;
  if p_hash is distinct from v_hash then raise exception 'O conteúdo do contrato não confere'; end if;
  if coalesce(length(p_assinatura), 0) < 200 or p_assinatura not like 'data:image/png;base64,%' then
    raise exception 'Assinatura inválida';
  end if;
  if length(p_assinatura) > 400000 then raise exception 'Assinatura muito grande'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe seu nome completo'; end if;

  -- IP de quem assinou (o Supabase repassa o cabeçalho da requisição)
  begin
    v_ip := split_part(coalesce(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      current_setting('request.headers', true)::json ->> 'x-real-ip', ''), ',', 1);
  exception when others then v_ip := null;
  end;

  update contratos set
    status = 'assinado',
    cliente_assinatura = p_assinatura,
    cliente_nome = trim(p_nome),
    cliente_cpf = trim(p_cpf),
    cliente_assinado_em = v_quando,
    cliente_ip = nullif(trim(v_ip), ''),
    cliente_user_agent = left(p_user_agent, 400)
  where token = p_token;

  return v_quando;
end $$;

revoke all on function public.contrato_por_token(uuid) from public;
revoke all on function public.assinar_contrato(uuid, text, text, text, text, text) from public;
grant execute on function public.contrato_por_token(uuid) to anon, authenticated;
grant execute on function public.assinar_contrato(uuid, text, text, text, text, text) to anon, authenticated;
