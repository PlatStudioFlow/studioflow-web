// ============================================================
// STUDIOFLOW — PWA + navegação mobile
// Roda em toda página que tiver <div class="sidebar"> (páginas
// internas do app). Não precisa de nenhuma alteração no HTML de
// cada tela — ele mesmo cria o botão de menu quando necessário.
// ============================================================

// --- Registra o Service Worker (permite "instalar" o app) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

// --- Menu mobile (hambúrguer) ---
function initMobileNav() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return; // página de auth (login/cadastro/onboarding) não tem sidebar

  const btn = document.createElement('button');
  btn.className = 'mobile-menu-btn';
  btn.setAttribute('aria-label', 'Abrir menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.className = 'mobile-overlay';
  document.body.appendChild(overlay);

  function abrir() {
    document.body.classList.add('sidebar-open');
  }
  function fechar() {
    document.body.classList.remove('sidebar-open');
  }

  btn.addEventListener('click', () => {
    document.body.classList.contains('sidebar-open') ? fechar() : abrir();
  });
  overlay.addEventListener('click', fechar);

  sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', fechar));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
  initMobileNav();
}
