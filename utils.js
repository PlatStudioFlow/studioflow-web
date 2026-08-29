// ============================================================
// STUDIOFLOW — Utilitários compartilhados
// Replica fielmente parse_money / fmt_money / fmt_date do app desktop.
// ============================================================

// Converte texto digitado em número, aceitando qualquer formato razoável:
// 900 / 900,00 / 900.00 / 1.200,50 / R$ 900,00 — tudo vira o mesmo float.
export function parseMoney(s) {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return s;
  s = String(s).trim();
  if (!s) return 0;
  s = s.replace(/R\$/gi, '').trim().replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // 1.200,50 -> 1200.50
    } else {
      s = s.replace(/,/g, ''); // 1,200.50 -> 1200.50
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.'); // 900,50 -> 900.50
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function fmtMoney(v) {
  v = parseFloat(v || 0);
  if (isNaN(v)) v = 0;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export const STAGE_LABELS = { contrato: 'Orçamento', evento: 'Evento', entrega: 'Entrega', nao_fechado: 'Não fechado' };

export const DEFAULT_TERMOS =
`A entrega é feita por meio de galeria digital privada, com validade de 1 mês a partir da disponibilização.

Para agendamento do evento solicitamos um sinal de 10% da quantia, que será abatido no valor final. O restante do pagamento pode ser feito até o dia do evento.

Ou o pagamento total pode ser parcelado em até 12x como consta no orçamento.`;
