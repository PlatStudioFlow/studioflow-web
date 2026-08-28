// ============================================================
// STUDIOFLOW — Funções compartilhadas de autenticação
// ============================================================

import { supabase } from './supabase-client.js?v=5';

// Garante que o usuário logado tem um tenant + profile.
// Se for o primeiro login dele (perfil ainda não existe), cria os dois agora.
// Isso cobre tanto quem confirmou o e-mail antes de cadastrar o perfil,
// quanto o caso raro de a criação ter falhado no cadastro.
export async function ensureProfileAndTenant(user) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, tenant_id, role, tenants(*)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile) return profile;

  // Ainda não existe profile -> primeiro login de fato. Cria tenant + profile.
  const businessName = user.user_metadata?.business_name || '';

  const { data: newTenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      business_name: businessName,
      contact_email: user.email,
      created_by: user.id,
      aceitou_termos_em: user.user_metadata?.aceitou_termos_em || new Date().toISOString(),
    })
    .select()
    .single();

  if (tenantError) throw tenantError;

  const { data: newProfile, error: newProfileError } = await supabase
    .from('profiles')
    .insert({ id: user.id, tenant_id: newTenant.id })
    .select('id, tenant_id, role, tenants(*)')
    .single();

  if (newProfileError) throw newProfileError;

  return newProfile;
}

// Redireciona conforme o status do tenant. Retorna true se o login pode prosseguir.
// Considera acesso liberado tanto para tenants "ativo" quanto "trial" ainda
// dentro do prazo — usado em toda página protegida, além do handleTenantStatus
// (que só roda no momento do login).
export function isTenantActiveNow(tenant) {
  if (tenant.status === 'ativo') return true;
  if (tenant.status === 'trial') {
    const hojeISO = new Date().toISOString().slice(0, 10);
    return !!tenant.trial_ends_at && tenant.trial_ends_at >= hojeISO;
  }
  return false;
}

export function handleTenantStatus(tenant, statusEl) {
  if (tenant.status === 'pendente') {
    statusEl.textContent = 'Seu cadastro foi recebido e está aguardando aprovação. Você recebe acesso assim que for liberado.';
    statusEl.className = 'status-msg status-pendente';
    return false;
  }
  if (tenant.status === 'trial') {
    const hojeISO = new Date().toISOString().slice(0, 10);
    if (!tenant.trial_ends_at || tenant.trial_ends_at < hojeISO) {
      statusEl.textContent = 'Seu período de teste terminou. Entre em contato para liberar o acesso definitivo.';
      statusEl.className = 'status-msg status-bloqueado';
      return false;
    }
    return true; // trial ainda dentro do prazo
  }
  if (tenant.status === 'bloqueado') {
    statusEl.textContent = 'Seu acesso está bloqueado. Entre em contato com o suporte do StudioFlow.';
    statusEl.className = 'status-msg status-bloqueado';
    return false;
  }
  return true; // ativo
}
