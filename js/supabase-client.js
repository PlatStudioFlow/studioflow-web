// ============================================================
// STUDIOFLOW — Cliente Supabase compartilhado
// ============================================================
// Este arquivo é importado (via <script type="module">) em toda
// página que precisa falar com o banco/autenticação.
//
// A "publishable key" é pública por natureza — o que protege os
// dados de cada estúdio é a política de RLS no banco, não o sigilo
// desta chave. Por isso é seguro ela aparecer no código do site.
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cypvzsfavqykgogeidtm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2b0Jg1LF_pkJBf8b5KPqpQ_fRqPsphn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
