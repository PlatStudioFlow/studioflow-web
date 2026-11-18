// ============================================================
// STUDIOFLOW — Contrato de prestação de serviços
// Monta o texto do contrato (a partir dos campos preenchidos na
// tela) e gera o PDF com jsPDF. O mesmo "blocos" alimenta a
// pré-visualização na tela e o PDF, então os dois nunca divergem.
// ============================================================

// ---------- dados padrão do CONTRATADO ----------
export const CONTRATADO_PADRAO = {
  nome: 'Lucas Mendes dos Santos',
  doc_tipo: 'CNPJ',
  doc_numero: '58.728.118/0001-10',
  endereco: 'Rua A, 190 - Roma - Volta Redonda',
  cidade: 'Volta Redonda/RJ',
  foro: 'Volta Redonda - Rio de Janeiro',
  municipio_deslocamento: 'Volta Redonda/RJ',
  titulo: 'LUCASM. FOTOGRAFIA',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ---------- formatação ----------
export function fmtHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  if (!mm || mm === '00') return `${parseInt(hh, 10)}h`;
  return `${parseInt(hh, 10)}h${mm}`;
}

export function dataExtenso(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function fmtReais(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCPF(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ---------- número por extenso (pt-BR) ----------
const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos'];

function ate999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100;
  const partes = [];
  if (c) partes.push(CEN[c]);
  if (r) {
    if (r < 20) partes.push(UNI[r]);
    else {
      const d = Math.floor(r / 10), u = r % 10;
      partes.push(u ? `${DEZ[d]} e ${UNI[u]}` : DEZ[d]);
    }
  }
  return partes.join(' e ');
}

export function numeroExtenso(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const grupos = [];
  let x = n;
  while (x > 0) { grupos.push(x % 1000); x = Math.floor(x / 1000); }
  const nomes = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
  const partes = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    let txt;
    if (i === 1 && g === 1) txt = 'mil';
    else txt = ate999(g) + (i ? ' ' + nomes[i][g === 1 ? 0 : 1] : '');
    partes.push({ txt, g, i });
  }
  // conector "e": entre o último grupo e o anterior quando o último é < 100 ou centena redonda
  let out = '';
  partes.forEach((p, idx) => {
    if (idx === 0) { out = p.txt; return; }
    const ultimo = idx === partes.length - 1;
    const usaE = ultimo && p.i === 0 && (p.g < 100 || p.g % 100 === 0);
    out += (usaE ? ' e ' : ' ') + p.txt;
  });
  return out;
}

export function valorExtenso(v) {
  const n = Math.round((Number(v) || 0) * 100);
  const reais = Math.floor(n / 100), cent = n % 100;
  const partes = [];
  if (reais) {
    let r = numeroExtenso(reais);
    // "um milhão de reais", "dois milhões de reais"
    const deReais = reais >= 1000000 && reais % 1000000 === 0;
    partes.push(`${r} ${deReais ? 'de ' : ''}${reais === 1 ? 'real' : 'reais'}`);
  }
  if (cent) partes.push(`${numeroExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) return 'zero reais';
  return partes.join(' e ');
}

// ---------- blocos do contrato ----------
// segmento: { t: texto, b?: negrito, c?: cor ('accent'), k?: chave do campo, vazio?: true }
function campo(valor, chave, branco = '__________') {
  const v = (valor ?? '').toString().trim();
  return v ? { t: v, k: chave } : { t: branco, k: chave, vazio: true };
}

export function montarBlocos(d) {
  const c = { ...CONTRATADO_PADRAO, ...(d.contratado || {}) };
  const B = [];
  const P = (...segs) => B.push({ tipo: 'p', segs });
  const H = (t) => B.push({ tipo: 'h', segs: [{ t, b: true, c: 'accent' }] });
  const S = (n = 1) => B.push({ tipo: 'esp', n });

  B.push({ tipo: 'titulo', segs: [{ t: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE FOTOGRAFIA E FILMAGEM – ${c.titulo}`, b: true }] });

  P({ t: 'CONTRATANTE: ', b: true, c: 'accent' },
    campo(d.contratante_nome, 'contratante_nome', '______________________________'), { t: ', ' },
    campo(d.contratante_qualificacao, 'contratante_qualificacao', '____________'), { t: ', portador(a) do CPF nº ' },
    campo(d.contratante_cpf, 'contratante_cpf', '________________'), { t: ', residente à ' },
    campo(d.contratante_endereco, 'contratante_endereco', '______________________________'), { t: '.' });

  P({ t: 'CONTRATADO: ', b: true, c: 'accent' },
    { t: `${c.nome}, inscrito no ${c.doc_tipo} sob nº ${c.doc_numero}, com endereço à ${c.endereco}.` });

  P({ t: 'As partes acima identificadas têm entre si justo e contratado o seguinte:' });

  // CLÁUSULA 1
  H('CLÁUSULA 1 – DO OBJETO');
  P({ t: 'O presente contrato tem por objeto a prestação de serviços de fotografia, filmagem ou ambos (conforme opção do CONTRATANTE), a serem realizados no evento descrito abaixo:' });
  const horasNum = parseFloat(String(d.horas || '').replace(',', '.'));
  const horasTxt = d.horas ? `${String(d.horas).replace('.', ',')} ${horasNum === 1 ? 'hora' : 'horas'}` : '';
  const dataSegs = d.data_evento
    ? [campo(dataExtenso(d.data_evento), 'data_evento')]
    : [{ t: '____ de ____________ de ______', k: 'data_evento', vazio: true }];
  P({ t: '- Cobertura de ' }, horasTxt ? { t: horasTxt, k: 'horas' } : { t: '____ horas', k: 'horas', vazio: true },
    { t: ' (' }, campo(fmtHora(d.hora_inicio), 'hora_inicio', '____'), { t: ' às ' }, campo(fmtHora(d.hora_fim), 'hora_fim', '____'),
    { t: ') de serviço de ' }, campo(d.servico, 'servico', '____________________'), { t: ': ' },
    campo(d.evento, 'evento', '_________________________'), { t: ', no dia ' }, ...dataSegs,
    { t: ', às ' }, campo(fmtHora(d.horario_evento), 'horario_evento', '______'),
    { t: ', no local ' }, campo(d.local, 'local', '_____________________________________________'), { t: '.' });

  // CLÁUSULA 2
  H('CLÁUSULA 2 – EQUIPE');
  const qtd = parseInt(d.qtd_profissionais, 10);
  const qtdSegs = qtd > 0
    ? [{ t: `${numeroExtenso(qtd)} (${String(qtd).padStart(2, '0')}) ${qtd === 1 ? 'profissional' : 'profissionais'}`, k: 'qtd_profissionais' }]
    : [{ t: 'um (__) profissional', k: 'qtd_profissionais', vazio: true }];
  P({ t: 'A equipe será composta por ' }, ...qtdSegs,
    { t: `, que ${qtd > 1 ? 'atuarão' : 'atuará'} conforme a modalidade contratada (` },
    campo(d.modalidade, 'modalidade', '______________________________'), { t: ').' });
  P({ t: 'Será concedida pausa de 15 (quinze) minutos para alimentação da equipe, em horário a ser combinado com o CONTRATANTE.' });

  // CLÁUSULA 3
  H('CLÁUSULA 3 – ENTREGA DO MATERIAL');
  P({ t: 'As fotografias e/ou filmagens serão entregues ao CONTRATANTE por meio de link disponibilizado no Google Drive, no prazo de até quatorze (14) dias úteis após a realização do evento.' });
  P({ t: 'Parágrafo primeiro: ', b: true }, { t: 'Serão entregues as fotografias e/ou vídeos editados e tratados, em quantidade definida a critério técnico do CONTRATADO, de acordo com o andamento do evento. Os arquivos brutos (RAW) e as imagens descartadas na seleção não serão entregues.' });
  P({ t: 'Parágrafo segundo: ', b: true }, { t: 'O link de acesso ao material ficará disponível pelo prazo de 1 (um) mês a contar da data de entrega. Cabe ao CONTRATANTE realizar o download e manter cópia de segurança dos arquivos, não se responsabilizando o CONTRATADO pelo armazenamento ou reenvio do material após esse prazo.' });

  // CLÁUSULA 4
  H('CLÁUSULA 4 – DO PAGAMENTO');
  const temValor = d.valor !== '' && d.valor !== null && d.valor !== undefined && Number(d.valor) > 0;
  P({ t: 'O valor total ajustado entre as partes é de R$ ' },
    temValor ? { t: fmtReais(d.valor), k: 'valor' } : { t: '____________', k: 'valor', vazio: true },
    { t: ' (' },
    temValor ? { t: valorExtenso(d.valor), k: 'valor' } : { t: '________________________________________', k: 'valor', vazio: true },
    { t: ').' });
  P({ t: 'O pagamento será realizado da seguinte forma:' });
  P(campo(d.pagamento, 'pagamento', '______________________________________________________________________'));
  P({ t: 'Fica a obrigação do CONTRATADO confirmar o recebimento do pagamento no momento do envio para o CONTRATANTE.' });
  P({ t: '- Caso o valor ajustado não seja quitado até a data previamente combinada entre as partes, o CONTRATADO não estará obrigado a realizar a prestação do serviço, ficando este automaticamente suspenso.' });
  P({ t: 'Parágrafo único: ', b: true }, { t: `Para eventos realizados fora do município de ${c.municipio_deslocamento}, poderá ser cobrada taxa de deslocamento, a ser informada e acordada previamente entre as partes.` });

  // CLÁUSULA 5
  H('CLÁUSULA 5 – HORA EXTRA E ATRASOS');
  P({ t: 'Caso o CONTRATANTE solicite a permanência da equipe além do horário contratado, será cobrado o valor de R$ 150,00 (cento e cinquenta reais) por hora adicional ou fração, a ser pago até a data da entrega do material. A hora extra está sujeita à disponibilidade do CONTRATADO.' });
  P({ t: 'Parágrafo único: ', b: true }, { t: 'A contagem do tempo de cobertura inicia-se no horário contratado, ainda que o evento comece com atraso. Atrasos no início do evento não prorrogam o horário de término do serviço sem o pagamento de hora extra.' });

  // CLÁUSULA 6
  H('CLÁUSULA 6 – OBRIGAÇÕES DO CONTRATADO');
  P({ t: 'O contratado obriga-se a:\na) Executar os serviços contratados de forma profissional, utilizando equipamentos adequados;\nb) Cumprir os prazos estipulados para entrega do material;\nc) Garantir a qualidade técnica das imagens captadas.' });

  // CLÁUSULA 7
  H('CLÁUSULA 7 – OBRIGAÇÕES DO CONTRATANTE');
  P({ t: 'O CONTRATANTE obriga-se a:\na) Fornecer todas as informações necessárias para a execução dos serviços;\nb) Efetuar os pagamentos nos prazos ajustados;\nc) Garantir acesso da equipe contratada aos locais de realização do evento;\nd) Informar ao CONTRATADO, com antecedência, qualquer alteração de horário, local ou programação do evento.' });

  // CLÁUSULA 8
  H('CLÁUSULA 8 – CANCELAMENTO, DESISTÊNCIA E REMARCAÇÃO');
  P({ t: 'Em caso de desistência do CONTRATANTE, o valor pago não será devolvido, servindo como indenização pelas reservas e compromissos assumidos pelo CONTRATADO.' });
  P({ t: 'Parágrafo primeiro: ', b: true }, { t: 'O CONTRATANTE poderá solicitar a remarcação da data do evento uma única vez, com antecedência mínima de 15 (quinze) dias da data original, ficando a nova data sujeita à disponibilidade de agenda do CONTRATADO. Solicitações feitas com prazo inferior a 15 (quinze) dias serão consideradas desistência, aplicando-se o disposto no caput desta cláusula, sem reembolso do valor pago.' });
  P({ t: 'Parágrafo segundo: ', b: true }, { t: 'Caso o CONTRATADO fique impossibilitado de comparecer ao evento por motivo de força maior (doença, acidente ou outro imprevisto grave), indicará outro profissional de sua confiança e de qualificação equivalente para realizar o serviço. Não sendo possível a substituição, o CONTRATADO devolverá integralmente os valores pagos pelo CONTRATANTE.' });

  // CLÁUSULA 9
  H('CLÁUSULA 9 – EVENTOS EXTERNOS E CONDIÇÕES CLIMÁTICAS');
  P({ t: 'Em eventos realizados total ou parcialmente em áreas externas ou descobertas, caso ocorram chuva, garoa, tempestade, ventos fortes, descargas elétricas (raios) ou quaisquer outros fenômenos da natureza que possam danificar os equipamentos ou colocar em risco a segurança da equipe, o CONTRATADO não realizará a captação nas áreas expostas, podendo dar continuidade ao serviço apenas em locais cobertos e protegidos.' });
  P({ t: 'Parágrafo primeiro: ', b: true }, { t: 'A avaliação das condições de segurança para os equipamentos e para a equipe caberá exclusivamente ao CONTRATADO, que poderá suspender a captação externa enquanto durarem as condições adversas.' });
  P({ t: 'Parágrafo segundo: ', b: true }, { t: 'A não realização ou interrupção da captação externa pelos motivos descritos nesta cláusula não caracteriza descumprimento contratual por parte do CONTRATADO, não gerando direito a reembolso, desconto ou indenização, nem prorrogação do horário contratado.' });
  P({ t: 'Parágrafo terceiro: ', b: true }, { t: 'Caso deseje garantir a cobertura em áreas externas sob essas condições, caberá ao CONTRATANTE providenciar estrutura adequada de proteção (tendas, toldos, coberturas ou similares).' });

  // CLÁUSULA 10
  H('CLÁUSULA 10 – USO DE IMAGEM');
  P({ t: 'Ao assinar o presente contrato, o CONTRATANTE autoriza, de forma gratuita e por prazo indeterminado, o uso de todas as imagens (fotografias e vídeos) captadas no evento, nas quais apareçam o próprio CONTRATANTE, seus filhos e demais menores de idade sob sua responsabilidade legal, seus familiares e convidados, para fins de divulgação do trabalho do CONTRATADO em portfólio, site, redes sociais, materiais publicitários e quaisquer outros meios de comunicação.' });
  P({ t: 'Parágrafo único: ', b: true }, { t: 'A presente autorização não gera qualquer remuneração ao CONTRATANTE ou às pessoas retratadas, cabendo ao CONTRATANTE informar seus familiares e convidados de que o evento será fotografado e/ou filmado para os fins aqui previstos.' });

  // CLÁUSULA 11
  H('CLÁUSULA 11 – LIMITAÇÃO DE RESPONSABILIDADE');
  P({ t: 'Em caso de falha de equipamento, perda ou corrompimento de arquivos ou qualquer outro problema técnico alheio à vontade do CONTRATADO que impeça a entrega total ou parcial do material, a responsabilidade do CONTRATADO ficará limitada à devolução proporcional ou integral do valor pago, conforme a parte do serviço não entregue, não cabendo qualquer outra indenização.' });

  // CLÁUSULA 12
  H('CLÁUSULA 12 – DO FORO');
  P({ t: `As partes elegem o foro da comarca de ${c.foro}, como competente para dirimir quaisquer questões oriundas do presente contrato.` });
  // "manter": reserva espaço para o fecho + assinaturas ficarem na mesma página
  B.push({ tipo: 'p', manter: 78, segs: [{ t: 'E, por estarem de pleno acordo, as partes assinam o presente contrato em duas vias de igual teor.' }] });
  S();
  const dataAss = d.data_assinatura
    ? [campo(dataExtenso(d.data_assinatura), 'data_assinatura')]
    : [{ t: '____ de ______________ de ______', k: 'data_assinatura', vazio: true }];
  P({ t: `${c.cidade}, ` }, ...dataAss, { t: '.' });

  return B;
}

// Campos obrigatórios que ainda estão em branco (para o aviso na tela)
export const ROTULOS_CAMPOS = {
  contratante_nome: 'Nome do contratante',
  contratante_qualificacao: 'Qualificação',
  contratante_cpf: 'CPF',
  contratante_endereco: 'Endereço',
  horas: 'Horas de cobertura',
  hora_inicio: 'Início',
  hora_fim: 'Término',
  servico: 'Serviço',
  evento: 'Evento',
  data_evento: 'Data do evento',
  horario_evento: 'Horário do evento',
  local: 'Local',
  qtd_profissionais: 'Nº de profissionais',
  modalidade: 'Modalidade',
  valor: 'Valor',
  pagamento: 'Forma de pagamento',
  data_assinatura: 'Data da assinatura',
};

export function camposVazios(blocos) {
  const set = new Set();
  blocos.forEach(b => (b.segs || []).forEach(s => { if (s.vazio && s.k) set.add(s.k); }));
  return [...set];
}

// ---------- PDF ----------
const ACCENT = '#1F5FA8', DARK = '#1A1A1A', FAINT = '#8A8A8A', LINE = '#444444';

// jsPDF (fontes padrão) só cobre Latin-1: troca o travessão por hífen
function limpa(t) { return t.replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); }

// Largura sem kerning: o jsPDF desenha o texto sem kerning, mas o
// getTextWidth() desconta kerning — isso "cola" palavras como CONTRATADO.
function largura(doc, t, size) {
  return doc.getStringUnitWidth(t, { kerning: {} }) * size / doc.internal.scaleFactor;
}

function estilo(doc, seg, size) {
  doc.setFont('helvetica', seg.b ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(seg.c === 'accent' ? ACCENT : DARK);
}

// Quebra segmentos com estilos misturados em linhas (para justificar)
function quebrarLinhas(doc, segs, maxW, size) {
  const tokens = []; // {pecas:[{t,seg}]} | 'BR'
  let atual = [];
  const fecha = () => { if (atual.length) { tokens.push({ pecas: atual }); atual = []; } };
  segs.forEach(seg => {
    limpa(seg.t).split(/(\n| +)/).forEach(parte => {
      if (parte === '') return;
      if (parte === '\n') { fecha(); tokens.push('BR'); return; }
      if (/^ +$/.test(parte)) { fecha(); return; }
      atual.push({ t: parte, seg });
    });
  });
  fecha();

  tokens.forEach(tk => {
    if (tk === 'BR') return;
    tk.w = tk.pecas.reduce((acc, p) => { estilo(doc, p.seg, size); p.w = largura(doc, p.t, size); return acc + p.w; }, 0);
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
  const espaco = largura(doc, ' ', size);

  const linhas = [];
  let linha = [], larg = 0;
  tokens.forEach(tk => {
    if (tk === 'BR') { linhas.push({ palavras: linha, ultima: true }); linha = []; larg = 0; return; }
    const nova = linha.length ? larg + espaco + tk.w : tk.w;
    if (nova > maxW && linha.length) {
      linhas.push({ palavras: linha, ultima: false });
      linha = [tk]; larg = tk.w;
    } else { linha.push(tk); larg = nova; }
  });
  linhas.push({ palavras: linha, ultima: true });
  return { linhas, espaco };
}

function carregarImagem(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      resolve({ data: cv.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo hash
function jsonEstavel(v) {
  if (Array.isArray(v)) return '[' + v.map(jsonEstavel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + jsonEstavel(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

// SHA-256 do conteúdo do contrato (prova de que o texto assinado não mudou)
export async function hashConteudo(dados) {
  const buf = new TextEncoder().encode(jsonEstavel(dados));
  if (globalThis.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Js(buf); // navegador sem crypto.subtle (página aberta sem https)
}

// SHA-256 em JS puro (reserva)
function sha256Js(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, nBlocos = ((l + 9 + 63) >> 6);
  const m = new Uint8Array(nBlocos * 64); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(m.length - 8, Math.floor(l / 0x20000000)); dv.setUint32(m.length - 4, (l * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

// HTML da pré-visualização (usado na plataforma e na página do cliente)
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export function blocosHtml(blocos, { destacarCampos = true } = {}) {
  const seg = (s) => {
    const h = escH(s.t);
    if (s.k && destacarCampos) return `<span class="v${s.vazio ? ' vazio' : ''}" data-k="${s.k}">${h}</span>`;
    if (s.b && s.c === 'accent') return `<b class="accent">${h}</b>`;
    if (s.b) return `<b>${h}</b>`;
    return h;
  };
  return blocos.map(b => {
    const inner = (b.segs || []).map(seg).join('');
    if (b.tipo === 'titulo') return `<div class="titulo">${inner}</div>`;
    if (b.tipo === 'h') return `<p class="h">${inner}</p>`;
    if (b.tipo === 'esp') return `<div style="height:${10 * b.n}px"></div>`;
    return `<p>${inner}</p>`;
  }).join('');
}

export function fmtDataHora(d) {
  if (!d) return '';
  d = new Date(d);
  const p2 = n => String(n).padStart(2, '0');
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export async function codigoContrato(dados) {
  const h = await hashConteudo({ ...dados, _r: Math.random() });
  return h.slice(0, 10).toUpperCase();
}

// opts: { logo, assinatura, assinadoEm, assinaturaCliente, clienteAssinadoEm, codigo, auditoria }
//   logo/assinaturas: {data,w,h} ou URL/dataURL
//   auditoria: { hash, link, cliente: {nome, cpf, em, ip, ua}, contratado: {nome, em}, criadoEm }
export async function gerarPdfContrato(jsPDF, dados, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const c = { ...CONTRATADO_PADRAO, ...(dados.contratado || {}) };
  const blocos = montarBlocos(dados);

  const PW = 210, PH = 297, X0 = 25, X1 = PW - 25, W = X1 - X0;
  const TOPO = 44, BASE = PH - 22;
  const SIZE = 10.5, LH = 5.1;
  let y = TOPO;

  let logo = opts.logo;
  if (typeof logo === 'string') logo = await carregarImagem(logo);
  let assinatura = opts.assinatura;
  if (typeof assinatura === 'string') assinatura = await carregarImagem(assinatura);
  let assCliente = opts.assinaturaCliente;
  if (typeof assCliente === 'string') assCliente = await carregarImagem(assCliente);

  function cabecalho() {
    if (logo) {
      const lw = 58, lh = lw * logo.h / logo.w;
      try { doc.addImage(logo.data, 'PNG', (PW - lw) / 2, 14, lw, lh); } catch (e) { /* ignora */ }
    }
  }
  function novaPagina() { doc.addPage(); cabecalho(); y = TOPO; }
  function espaco(mm) { if (y + mm > BASE) novaPagina(); }

  function desenhar(segs, { size = SIZE, align = 'justify', lh = LH } = {}) {
    const { linhas, espaco: esp } = quebrarLinhas(doc, segs, W, size);
    linhas.forEach(l => {
      espaco(lh);
      const soma = l.palavras.reduce((a, p) => a + p.w, 0);
      const n = l.palavras.length;
      let gap = esp, x = X0;
      if (align === 'justify' && !l.ultima && n > 1) gap = (W - soma) / (n - 1);
      if (align === 'center') x = X0 + (W - (soma + esp * (n - 1))) / 2;
      l.palavras.forEach(p => {
        p.pecas.forEach(pc => { estilo(doc, pc.seg, size); doc.text(pc.t, x, y); x += pc.w; });
        x += gap;
      });
      y += lh;
    });
  }

  cabecalho();
  blocos.forEach((b, i) => {
    if (b.tipo === 'titulo') {
      desenhar(b.segs, { size: 12, align: 'center', lh: 6 });
      y += 5;
    } else if (b.tipo === 'h') {
      espaco(LH * 3 + 4);   // mantém o título junto com o começo do parágrafo
      y += 2.5;
      desenhar(b.segs, { size: 11 });
      y += 1;
    } else if (b.tipo === 'esp') {
      y += 3 * b.n;
    } else {
      if (b.manter) espaco(b.manter);
      desenhar(b.segs);
      y += 2.4;
    }
  });

  // ---------- bloco de assinaturas ----------
  espaco(52);
  y += 20;
  const colW = 72;
  const cx1 = X0 + W * 0.25, cx2 = X0 + W * 0.75;

  function carimbar(img, cx) {
    const maxW = 60, maxH = 22;
    let aw = maxW, ah = aw * img.h / img.w;
    if (ah > maxH) { ah = maxH; aw = ah * img.w / img.h; }
    try { doc.addImage(img.data, 'PNG', cx - aw / 2, y - ah + 1.5, aw, ah); } catch (e) { /* ignora */ }
  }
  if (assinatura) carimbar(assinatura, cx2);
  if (assCliente) carimbar(assCliente, cx1);

  doc.setDrawColor(LINE); doc.setLineWidth(0.3);
  doc.line(cx1 - colW / 2, y, cx1 + colW / 2, y);
  doc.line(cx2 - colW / 2, y, cx2 + colW / 2, y);
  y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(DARK);
  doc.text('CONTRATANTE', cx1, y, { align: 'center' });
  doc.text('CONTRATADO', cx2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(FAINT);
  const nomeCli = (opts.auditoria && opts.auditoria.cliente && opts.auditoria.cliente.nome) || dados.contratante_nome;
  if (nomeCli) doc.text(limpa(nomeCli), cx1, y, { align: 'center', maxWidth: colW });
  doc.text(limpa(c.nome), cx2, y, { align: 'center', maxWidth: colW });
  y += 4;
  if (dados.contratante_cpf) doc.text(`CPF ${dados.contratante_cpf}`, cx1, y, { align: 'center' });
  doc.text(`${c.doc_tipo} ${c.doc_numero}`, cx2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7.5);
  if (assCliente && opts.clienteAssinadoEm) doc.text(`Assinado eletronicamente em ${fmtDataHora(opts.clienteAssinadoEm)}`, cx1, y, { align: 'center' });
  if (assinatura && opts.assinadoEm) doc.text(`Assinado eletronicamente em ${fmtDataHora(opts.assinadoEm)}`, cx2, y, { align: 'center' });

  // ---------- página de registro das assinaturas ----------
  const au = opts.auditoria;
  if (au) {
    novaPagina();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(DARK);
    doc.text('REGISTRO DE ASSINATURAS ELETRÔNICAS', PW / 2, y, { align: 'center' });
    y += 10;
    const linhaInfo = (rot, val) => {
      if (!val) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(FAINT);
      doc.text(limpa(rot.toUpperCase()), X0, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(DARK);
      const ls = doc.splitTextToSize(limpa(String(val)), W - 48);
      ls.forEach((l, i) => { espaco(5); doc.text(l, X0 + 48, y); y += 4.8; });
      y += 1.2;
    };
    const secao = (t) => {
      espaco(16); y += 3;
      doc.setDrawColor('#D9D9D9'); doc.line(X0, y - 4.5, X1, y - 4.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(ACCENT);
      doc.text(t, X0, y); y += 7;
    };
    secao('Documento');
    linhaInfo('Contrato nº', opts.codigo);
    linhaInfo('Criado em', au.criadoEm ? fmtDataHora(au.criadoEm) : '');
    linhaInfo('Hash SHA-256', au.hash);
    linhaInfo('Link de assinatura', au.link);
    if (au.contratado) {
      secao('Contratado');
      linhaInfo('Nome', au.contratado.nome);
      linhaInfo('Documento', au.contratado.doc);
      linhaInfo('Assinado em', au.contratado.em ? fmtDataHora(au.contratado.em) : 'não assinado');
      linhaInfo('Método', 'Assinatura manuscrita digital aplicada na plataforma StudioFlow');
    }
    if (au.cliente) {
      secao('Contratante');
      linhaInfo('Nome informado', au.cliente.nome);
      linhaInfo('CPF informado', au.cliente.cpf);
      linhaInfo('Assinado em', au.cliente.em ? fmtDataHora(au.cliente.em) : 'aguardando assinatura');
      linhaInfo('Endereço IP', au.cliente.ip);
      linhaInfo('Dispositivo', au.cliente.ua);
      linhaInfo('Método', 'Assinatura manuscrita digital por link exclusivo, após leitura do contrato e aceite expresso dos termos e do uso de assinatura eletrônica (Lei nº 14.063/2020 e MP nº 2.200-2/2001, art. 10, § 2º)');
    }
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(FAINT);
    doc.splitTextToSize(limpa('O hash SHA-256 identifica o conteúdo exato do contrato no momento do envio. A assinatura do contratante só é aceita pela plataforma se o conteúdo exibido a ele corresponder a esse hash.'), W)
      .forEach(l => { espaco(4.5); doc.text(l, X0, y); y += 4.2; });
  }

  // ---------- rodapé com paginação e código ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(FAINT);
    const cod = opts.codigo ? `Contrato nº ${opts.codigo}  ·  ` : '';
    doc.text(`${cod}Página ${i} de ${total}`, PW / 2, PH - 10, { align: 'center' });
  }

  return doc;
}

// PDF a partir de um contrato salvo no banco (tabela contratos)
export async function gerarPdfDoRegistro(jsPDF, r, { link, logo = 'assets/logo-contrato.png' } = {}) {
  const c = { ...CONTRATADO_PADRAO, ...((r.dados && r.dados.contratado) || {}) };
  return gerarPdfContrato(jsPDF, r.dados, {
    logo,
    codigo: r.codigo,
    assinatura: r.assinatura_contratado || null,
    assinadoEm: r.contratado_assinado_em ? new Date(r.contratado_assinado_em) : null,
    assinaturaCliente: r.cliente_assinatura || null,
    clienteAssinadoEm: r.cliente_assinado_em ? new Date(r.cliente_assinado_em) : null,
    auditoria: {
      hash: r.hash_conteudo,
      link,
      criadoEm: r.created_at || null,
      contratado: { nome: c.nome, doc: `${c.doc_tipo} ${c.doc_numero}`, em: r.contratado_assinado_em },
      cliente: {
        nome: r.cliente_nome || (r.dados && r.dados.contratante_nome),
        cpf: r.cliente_cpf || (r.dados && r.dados.contratante_cpf),
        em: r.cliente_assinado_em, ip: r.cliente_ip, ua: r.cliente_user_agent,
      },
    },
  });
}

export function nomeArquivoContrato(dados, sufixo = '') {
  const slug = (dados.contratante_nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `contrato-${slug}${dados.data_evento ? '-' + dados.data_evento : ''}${sufixo}.pdf`;
}
