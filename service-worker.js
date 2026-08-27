// ============================================================
// STUDIOFLOW — Service Worker mínimo
// Não faz cache agressivo (os dados vêm sempre do Supabase, ao
// vivo). A única função dele aqui é satisfazer o requisito do
// navegador para permitir "Instalar app" / PWA.
// ============================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Passa direto pra rede — sem cache. Se um dia quisermos suporte
// offline de verdade, é aqui que entra a lógica de cache.
self.addEventListener('fetch', () => {});
