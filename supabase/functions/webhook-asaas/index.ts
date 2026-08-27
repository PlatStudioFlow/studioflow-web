// ============================================================
// STUDIOFLOW — Edge Function: webhook-asaas
// Recebe as notificações automáticas do Asaas quando um pagamento
// muda de status. Quando confirma, ativa o tenant sozinho.
//
// Essa função NÃO tem autenticação de usuário (o Asaas não tem
// como logar como ninguém) — a segurança aqui é o "asaas-access-token"
// que configuramos na hora de criar o Webhook no painel do Asaas.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = req.headers.get('asaas-access-token');
  const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
  if (!expected || token !== expected) {
    console.error('Webhook Asaas: token inválido ou ausente');
    return new Response('unauthorized', { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const event = body?.event;
  const payment = body?.payment;

  console.log('Webhook Asaas recebido:', event, payment?.id);

  const eventosConfirmacao = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
  const eventosBloqueio = ['PAYMENT_OVERDUE'];

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Forma mais confiável de achar o tenant: pelo ID do checkout, que
  // salvamos no tenant assim que a cobrança foi criada. Isso não depende
  // do Asaas propagar o externalReference pra dentro da assinatura.
  async function resolverTenantId(): Promise<string | null> {
    if (payment?.checkoutSession) {
      const { data: tenantByCheckout } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('checkout_session_id', payment.checkoutSession)
        .maybeSingle();
      if (tenantByCheckout) return tenantByCheckout.id;
    }

    if (payment?.externalReference) return payment.externalReference;

    if (payment?.subscription) {
      const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
      const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL')!;
      try {
        const resp = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions/${payment.subscription}`, {
          headers: { 'access_token': ASAAS_API_KEY },
        });
        const sub = await resp.json();
        if (sub?.externalReference) return sub.externalReference;
      } catch (e) {
        console.error('Erro ao buscar assinatura no Asaas:', e);
      }
    }

    return null;
  }

  if (eventosConfirmacao.includes(event)) {
    const tenantId = await resolverTenantId();
    if (tenantId) {
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'ativo', trial_ends_at: null })
        .eq('id', tenantId);

      if (error) {
        console.error('Erro ao ativar tenant via webhook:', error);
      } else {
        console.log('Tenant ativado via pagamento:', tenantId);
      }
    } else {
      console.error('Não foi possível resolver o tenant_id para este pagamento:', payment?.id);
    }
  }

  if (eventosBloqueio.includes(event)) {
    const tenantId = await resolverTenantId();
    if (tenantId) {
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'bloqueado' })
        .eq('id', tenantId);

      if (error) {
        console.error('Erro ao bloquear tenant por atraso:', error);
      } else {
        console.log('Tenant bloqueado por cobrança em atraso:', tenantId);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
