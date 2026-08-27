// ============================================================
// STUDIOFLOW — Edge Function: criar-cobranca
// Chamada pelo pagamento.html (usuário autenticado).
// Cria um Checkout no Asaas (Pix + Cartão) para o tenant do
// usuário logado, e devolve o link de pagamento hospedado pelo
// Asaas. A chave secreta do Asaas nunca sai daqui — o navegador
// nunca a vê.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    // Cliente "no contexto do usuário" — respeita RLS, só enxerga o próprio tenant.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: 'Não autenticado' }, 401);

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id, tenants(id, business_name, contact_email, contact_phone)')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.tenants) {
      return json({ error: 'Perfil ou estúdio não encontrado' }, 400);
    }

    const tenant = profile.tenants as any;

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL')!; // sandbox: https://api-sandbox.asaas.com
    const SITE_URL = Deno.env.get('SITE_URL')!;              // ex: http://localhost:8000
    const PRICE = Deno.env.get('STUDIOFLOW_PRICE')!;         // ex: 29.90
    const DESCRIPTION = Deno.env.get('STUDIOFLOW_DESCRIPTION') || 'Acesso StudioFlow';

    // Assinatura mensal recorrente — o Asaas só permite recorrência
    // automática via cartão de crédito (Pix recorrente não está
    // disponível nesse fluxo de Checkout). A primeira cobrança precisa
    // ser HOJE, senão o Asaas só tenta cobrar na próxima data definida.
    const hojeStr = new Date().toISOString().slice(0, 10);

    const payload: Record<string, unknown> = {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 1440, // 24h pra pagar antes do link expirar
      externalReference: tenant.id, // é isso que o webhook usa pra saber qual tenant ativar
      callback: {
        successUrl: `${SITE_URL}/pagamento-sucesso.html`,
        cancelUrl: `${SITE_URL}/pagamento.html`,
        expiredUrl: `${SITE_URL}/pagamento.html`,
      },
      items: [
        {
          name: 'StudioFlow',
          description: DESCRIPTION,
          quantity: 1,
          value: parseFloat(PRICE),
        },
      ],
      subscription: {
        cycle: 'MONTHLY',
        nextDueDate: hojeStr,
      },
    };

    // Não enviamos customerData — se mandarmos incompleto (sem CPF/endereço),
    // o Asaas passa a exigir tudo. É mais simples deixar a própria página
    // do checkout coletar os dados de quem for pagar.

    const resp = await fetch(`${ASAAS_BASE_URL}/v3/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    console.log('Asaas status:', resp.status, '| corpo bruto:', rawText);

    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      console.error('Resposta do Asaas não é JSON válido:', parseErr);
      return json({ error: 'Resposta inesperada do Asaas', status: resp.status, corpo: rawText }, 502);
    }

    if (!resp.ok) {
      console.error('Erro do Asaas:', data);
      return json({ error: 'Não foi possível criar a cobrança', detalhe: data }, 400);
    }

    // Guarda o ID desse checkout no tenant — é assim que o webhook vai
    // saber depois qual tenant ativar (mais confiável do que depender
    // do externalReference se propagar pra dentro da assinatura).
    await supabaseClient
      .from('tenants')
      .update({ checkout_session_id: data.id })
      .eq('id', tenant.id);

    return json({ link: data.link });
  } catch (err) {
    console.error(err);
    return json({ error: 'Erro interno' }, 500);
  }
});
