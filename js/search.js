// ============================================================
// STUDIOFLOW — Busca rápida global (Ctrl+K / Cmd+K)
// Roda em qualquer página que tenha sidebar (já autenticada).
// Busca em clientes, trabalhos, anotações e tarefas ao mesmo
// tempo, e navega pra tela correspondente ao clicar.
// ============================================================

import { supabase } from './supabase-client.js?v=5';

function montarModal() {
  const overlay = document.createElement('div');
  overlay.className = 'gs-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="gs-box">
      <input type="text" placeholder="Buscar clientes, trabalhos, anotações, tarefas..." id="gs-input">
      <div class="gs-results" id="gs-results"></div>
      <div class="gs-hint"><kbd>Ctrl</kbd> + <kbd>K</kbd> para abrir · <kbd>Esc</kbd> para fechar</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

let debounceTimer = null;

function initGlobalSearch() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const overlay = montarModal();
  const input = overlay.querySelector('#gs-input');
  const resultsEl = overlay.querySelector('#gs-results');

  function abrir() {
    overlay.style.display = 'flex';
    input.value = '';
    resultsEl.innerHTML = '';
    setTimeout(() => input.focus(), 30);
  }
  function fechar() {
    overlay.style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.style.display === 'flex' ? fechar() : abrir();
    }
    if (e.key === 'Escape' && overlay.style.display === 'flex') fechar();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const termo = input.value.trim();
    if (!termo) { resultsEl.innerHTML = ''; return; }
    debounceTimer = setTimeout(() => buscar(termo), 220);
  });

  async function buscar(termo) {
    const like = `%${termo}%`;

    const [clientesR, jobsR, notasR, tarefasR] = await Promise.all([
      supabase.from('clients').select('id, nome, email').ilike('nome', like).limit(5),
      supabase.from('jobs').select('id, tipo_trabalho, stage, clients(nome)').or(`tipo_trabalho.ilike.${like}`).limit(5),
      supabase.from('notas').select('id, titulo, conteudo').or(`titulo.ilike.${like},conteudo.ilike.${like}`).limit(5),
      supabase.from('tarefas').select('id, descricao').ilike('descricao', like).limit(5),
    ]);

    const grupos = [
      { label: 'Clientes', href: 'clientes.html', itens: (clientesR.data || []).map(c => ({ t: c.nome, s: c.email || '' })) },
      { label: 'Trabalhos', href: 'orcamentos.html', itens: (jobsR.data || []).map(j => ({ t: j.clients ? j.clients.nome : '—', s: j.tipo_trabalho || '' })) },
      { label: 'Anotações', href: 'anotacoes.html', itens: (notasR.data || []).map(n => ({ t: n.titulo || '(sem título)', s: (n.conteudo || '').slice(0, 60) })) },
      { label: 'Tarefas', href: 'tarefas.html', itens: (tarefasR.data || []).map(t => ({ t: t.descricao, s: '' })) },
    ].filter(g => g.itens.length);

    if (!grupos.length) {
      resultsEl.innerHTML = `<div class="gs-empty">Nada encontrado para "${escapeHtml(termo)}".</div>`;
      return;
    }

    resultsEl.innerHTML = grupos.map(g => `
      <div class="gs-group-label">${g.label}</div>
      ${g.itens.map(it => `
        <div class="gs-item" data-href="${g.href}">
          <div class="t">${escapeHtml(it.t)}</div>
          ${it.s ? `<div class="s">${escapeHtml(it.s)}</div>` : ''}
        </div>
      `).join('')}
    `).join('');

    resultsEl.querySelectorAll('.gs-item').forEach(el => {
      el.addEventListener('click', () => { window.location.href = el.dataset.href; });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalSearch);
} else {
  initGlobalSearch();
}
