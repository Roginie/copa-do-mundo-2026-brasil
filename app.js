/* ============================================================
   Copa do Mundo 2026 — Análise Preditiva do Brasil (Grupo C)
   Motor: força Elo (pontos FIFA) + gols via Poisson (Dixon-Coles simplificado)
   Dados embutidos (fallback) + overlay automático via data.json
   HTML + CSS + JS puro · roda direto no GitHub Pages
   ============================================================ */

// ── CONFIG DO MODELO (idealmente calibrada contra histórico) ──
// Os pesos abaixo seriam ajustados minimizando erro vs. resultados
// reais (ex.: log-loss). Os valores são um ponto de partida sensato.
const CONFIG = {
  pesos: { elo: 0.50, h2h: 0.20, forma: 0.30 }, // soma = 1
  h2hShrinkage: 5,   // pseudo-jogos: puxa o H2H para 0.5 quando há poucos confrontos
  eloDivisor: 600,   // escala da expectativa Elo (padrão FIFA)
  mediaGols: 1.30,   // gols médios por seleção/jogo (nível-base do Poisson)
  tiltForca: 0.75,   // o quanto a força combinada desloca os λ
  rhoDC: -0.05,      // ajuste Dixon-Coles nos placares baixos (calibrável)
  maxGols: 8,        // truncamento da matriz de Poisson
};

// ── DADOS REAIS (fallback embutido — sempre funciona offline) ─
const BASE = {
  // Pontos FIFA (escala tipo Elo). PLACEHOLDERS — confira/atualize com os
  // pontos OFICIAIS atuais em https://inside.fifa.com/fifa-world-ranking
  pontosFIFA: { BRA: 1860, MAR: 1700, SCO: 1500, HAI: 1320 },

  h2h: {
    'BRA-MAR': { jogos: 4, vBRA: 2, e: 1, vADV: 1, golsBRA: 6, golsADV: 4 },
    'BRA-HAI': { jogos: 3, vBRA: 3, e: 0, vADV: 0, golsBRA: 17, golsADV: 1 },
    'BRA-SCO': { jogos: 2, vBRA: 2, e: 0, vADV: 0, golsBRA: 4, golsADV: 1 },
  },

  forma: { BRA: 0.60, MAR: 0.72, SCO: 0.58, HAI: 0.40 }, // aproveitamento últimos 10
  mediagols:    { BRA: 1.8, MAR: 1.5, SCO: 1.4, HAI: 0.9 }, // gols marcados/jogo (ataque)
  golsSofridos: { BRA: 0.7, MAR: 0.9, SCO: 1.1, HAI: 1.6 }, // gols sofridos/jogo (defesa) — estimativa

  jogos: [
    {
      id: 1, rodada: 'Rodada 1',
      data: '2026-06-13T22:00:00-03:00',
      local: 'MetLife Stadium, Nova York',
      adversario: 'Marrocos', codAdv: 'MAR', flag: '🇲🇦',
      resultadoReal: { golsBRA: 1, golsADV: 1, marcadores: ['Vinícius Jr (32\')', 'Saibari (21\')'] },
      finalizado: true,
    },
    {
      id: 2, rodada: 'Rodada 2',
      data: '2026-06-19T22:00:00-03:00',
      local: 'Lincoln Financial Field, Filadélfia',
      adversario: 'Haiti', codAdv: 'HAI', flag: '🇭🇹',
      resultadoReal: { golsBRA: 3, golsADV: 0 },
      finalizado: true,
    },
    {
      id: 3, rodada: 'Rodada 3',
      data: '2026-06-24T19:00:00-03:00',
      local: 'Hard Rock Stadium, Miami',
      adversario: 'Escócia', codAdv: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      resultadoReal: null, finalizado: false,
    },
  ],

  grupoC: [
    { pos: 1, cod: 'BRA', nome: 'Brasil',   flag: '🇧🇷', j:2, v:1, e:1, d:0, gp:4, gc:1, sg:3,  pts:4 },
    { pos: 2, cod: 'SCO', nome: 'Escócia',  flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', j:1, v:1, e:0, d:0, gp:1, gc:0, sg:1,  pts:3 },
    { pos: 3, cod: 'MAR', nome: 'Marrocos', flag: '🇲🇦', j:1, v:0, e:1, d:0, gp:1, gc:1, sg:0,  pts:1 },
    { pos: 4, cod: 'HAI', nome: 'Haiti',    flag: '🇭🇹', j:2, v:0, e:0, d:2, gp:0, gc:4, sg:-4, pts:0 },
  ],
};

// ── FORÇA COMBINADA: Elo + H2H (com encolhimento) + forma ─────
function forcaCombinada(codAdv) {
  // Expectativa Elo a partir dos pontos FIFA (ΔR/600)
  const dR = BASE.pontosFIFA.BRA - BASE.pontosFIFA[codAdv];
  const eElo = 1 / (1 + Math.pow(10, -dR / CONFIG.eloDivisor));

  // H2H com shrinkage em direção a 0.5 (amostra pequena = pouca confiança)
  const h = BASE.h2h[`BRA-${codAdv}`] || { jogos: 0, vBRA: 0, e: 0 };
  const h2hRaw = h.jogos > 0 ? (h.vBRA + 0.5 * h.e) / h.jogos : 0.5;
  const k0 = CONFIG.h2hShrinkage;
  const h2hShrunk = (h2hRaw * h.jogos + 0.5 * k0) / (h.jogos + k0);

  // Forma recente (aproveitamento relativo)
  const forma = BASE.forma.BRA / (BASE.forma.BRA + BASE.forma[codAdv]);

  const w = CONFIG.pesos;
  const forca = w.elo * eElo + w.h2h * h2hShrunk + w.forma * forma;
  return { forca, eElo, h2hShrunk, forma };
}

// ── λ (GOLS ESPERADOS) via ataque/defesa + tilt da força ──────
function calcularLambdas(codAdv, forca) {
  const AVG = CONFIG.mediaGols;
  const ataqueBRA = BASE.mediagols.BRA / AVG;
  const defesaADV = BASE.golsSofridos[codAdv] / AVG;
  const ataqueADV = BASE.mediagols[codAdv] / AVG;
  const defesaBRA = BASE.golsSofridos.BRA / AVG;

  // base Dixon-Coles multiplicativa + inclinação pela força combinada
  let lamBRA = AVG * ataqueBRA * defesaADV * Math.pow(forca / 0.5, CONFIG.tiltForca);
  let lamADV = AVG * ataqueADV * defesaBRA * Math.pow((1 - forca) / 0.5, CONFIG.tiltForca);

  lamBRA = Math.min(6, Math.max(0.15, lamBRA));
  lamADV = Math.min(6, Math.max(0.15, lamADV));
  return { lamBRA, lamADV };
}

// ── POISSON + MATRIZ DE PLACARES ──────────────────────────────
function fatorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function poisson(k, lambda) { return Math.exp(-lambda) * Math.pow(lambda, k) / fatorial(k); }

// Correção Dixon-Coles para placares baixos (rho calibrável)
function tauDC(i, j, lamA, lamB, rho) {
  if (i === 0 && j === 0) return 1 - lamA * lamB * rho;
  if (i === 0 && j === 1) return 1 + lamA * rho;
  if (i === 1 && j === 0) return 1 + lamB * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function matrizPlacares(lamBRA, lamADV) {
  const N = CONFIG.maxGols, m = [];
  let soma = 0;
  for (let i = 0; i <= N; i++) {
    m[i] = [];
    for (let j = 0; j <= N; j++) {
      let p = poisson(i, lamBRA) * poisson(j, lamADV) * tauDC(i, j, lamBRA, lamADV, CONFIG.rhoDC);
      if (p < 0) p = 0;
      m[i][j] = p; soma += p;
    }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) m[i][j] /= soma; // normaliza
  return m;
}

// Vitória/empate/derrota, placar mais provável e top placares — TUDO da matriz
function derivarDaMatriz(m) {
  let pVitBRA = 0, pEmpate = 0, pVitADV = 0, best = { p: -1, i: 0, j: 0 };
  const cels = [];
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) {
    const p = m[i][j];
    if (i > j) pVitBRA += p; else if (i === j) pEmpate += p; else pVitADV += p;
    if (p > best.p) best = { p, i, j };
    cels.push({ i, j, p });
  }
  cels.sort((a, b) => b.p - a.p);
  return { pVitBRA, pEmpate, pVitADV, placar: best, top: cels.slice(0, 5) };
}

// ── ANÁLISE COMPLETA DE UM CONFRONTO ──────────────────────────
function calcularProbabilidades(codAdv) {
  const f = forcaCombinada(codAdv);
  const { lamBRA, lamADV } = calcularLambdas(codAdv, f.forca);
  const m = matrizPlacares(lamBRA, lamADV);
  const r = derivarDaMatriz(m);

  const h = BASE.h2h[`BRA-${codAdv}`] || { jogos: 0 };
  const confianca = h.jogos >= 5 ? 5 : h.jogos >= 3 ? 4 : h.jogos >= 1 ? 3 : 2;

  const topMax = r.top[0].p || 1;
  return {
    pVitBRA: Math.round(r.pVitBRA * 100),
    pEmpate: Math.round(r.pEmpate * 100),
    pVitADV: Math.round(r.pVitADV * 100),
    placarBRA: r.placar.i,
    placarADV: r.placar.j,
    lamBRA: +lamBRA.toFixed(2),
    lamADV: +lamADV.toFixed(2),
    eElo: Math.round(f.eElo * 100),
    confianca,
    top: r.top.map(c => ({ s: `${c.i}×${c.j}`, pct: Math.round(c.p * 100), rel: Math.round((c.p / topMax) * 100) })),
  };
}

// ── VALIDAÇÃO RETROATIVA ─────────────────────────────────────
// Vencedor previsto = PROBABILIDADE DOMINANTE (não o placar projetado).
// Placar (±1 gol) é só critério extra para "acerto cheio".
function validarJogo(analise, resultado) {
  if (!resultado) return null;
  const { golsBRA, golsADV } = resultado;
  const { pVitBRA, pEmpate, pVitADV, placarBRA, placarADV } = analise;

  let previsto = 'empate';
  if (pVitBRA >= pEmpate && pVitBRA >= pVitADV) previsto = 'brasil';
  else if (pVitADV >= pEmpate && pVitADV >= pVitBRA) previsto = 'adversario';

  const real = golsBRA > golsADV ? 'brasil' : golsADV > golsBRA ? 'adversario' : 'empate';
  const acertouVencedor = previsto === real;
  const placarProximo = Math.abs(placarBRA - golsBRA) <= 1 && Math.abs(placarADV - golsADV) <= 1;

  let tipo, label;
  if (acertouVencedor && placarProximo) { tipo = 'acerto'; label = '✅ Acerto'; }
  else if (acertouVencedor) { tipo = 'parcial'; label = '⚠️ Parcial'; }
  else { tipo = 'erro'; label = '❌ Erro'; }

  return {
    tipo, label, acertouVencedor,
    detalhe: `Projeção ${placarBRA}×${placarADV} · Resultado ${golsBRA}×${golsADV}`,
  };
}

// ── UTILS ────────────────────────────────────────────────────
function countdown(dataStr) {
  const diff = new Date(dataStr).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}
const estrelas = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ── TABELA ───────────────────────────────────────────────────
function renderTabela(dados) {
  document.getElementById('grupo-body').innerHTML = dados.map((t, i) => `
    <tr class="${t.cod === 'BRA' ? 'row-brasil' : ''}">
      <td>${i + 1}</td>
      <td>${t.flag} ${t.nome}</td>
      <td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td>
      <td>${t.gp}</td><td>${t.gc}</td>
      <td>${t.sg >= 0 ? '+' : ''}${t.sg}</td>
      <td class="pts-cell">${t.pts}</td>
    </tr>`).join('');
}

// ── CARDS DE JOGOS ───────────────────────────────────────────
function renderJogos(jogos) {
  let acertos = 0, total = 0;

  document.getElementById('jogos-grid').innerHTML = jogos.map(jogo => {
    const a = calcularProbabilidades(jogo.codAdv);
    let validacao = null;

    const dataJogo = new Date(jogo.data).getTime();
    const jogoPassado = Date.now() > dataJogo + 120 * 60 * 1000;

    if ((jogo.finalizado || jogoPassado) && jogo.resultadoReal) {
      jogo.finalizado = true;
      validacao = validarJogo(a, jogo.resultadoReal);
      total++;
      if (validacao.acertouVencedor) acertos++;
    }

    let statusHtml;
    if (jogo.finalizado && jogo.resultadoReal) statusHtml = `<span class="jogo-status status-finalizado">Finalizado</span>`;
    else if (jogoPassado && !jogo.resultadoReal) statusHtml = `<span class="jogo-status status-finalizado">Aguardando resultado</span>`;
    else if (Date.now() > dataJogo - 30 * 60 * 1000) statusHtml = `<span class="jogo-status status-ao-vivo">🔴 Ao vivo</span>`;
    else statusHtml = `<span class="jogo-status status-futuro">Próximo jogo</span>`;

    let placarHtml;
    if (jogo.finalizado && jogo.resultadoReal) {
      placarHtml = `<div class="placar-real">${jogo.resultadoReal.golsBRA} – ${jogo.resultadoReal.golsADV}</div>`;
    } else {
      placarHtml = `
        <div class="placar-vs">VS</div>
        <div class="placar-previsto-label">Mais provável</div>
        <div class="placar-previsto-val">${a.placarBRA} – ${a.placarADV}</div>`;
    }

    const ct = countdown(jogo.data);
    const countdownHtml = (!jogo.finalizado && ct) ? `
      <div class="countdown-box">
        <div class="countdown-label">Faltam</div>
        <div class="countdown-timer" id="ct-${jogo.id}">${ct}</div>
      </div>` : '';

    const validacaoHtml = validacao ? `
      <div class="validacao-row">
        <span class="validacao-badge badge-${validacao.tipo}">${validacao.label}</span>
        <span class="validacao-detalhe">${validacao.detalhe}</span>
      </div>` : '';

    const marcadoresHtml = jogo.resultadoReal?.marcadores ? `
      <div class="info-row" style="margin-top:10px">
        ${jogo.resultadoReal.marcadores.map(m => `<span class="info-chip">⚽ ${m}</span>`).join('')}
      </div>` : '';

    // Top placares mais prováveis (da matriz de Poisson)
    const placaresHtml = `
      <div class="placares">
        <div class="placares-titulo">Placares mais prováveis</div>
        ${a.top.map(t => `
          <div class="pl-row">
            <span class="pl-score">${t.s}</span>
            <span class="pl-bar"><i style="width:${Math.max(6, t.rel)}%"></i></span>
            <span class="pl-pct">${t.pct}%</span>
          </div>`).join('')}
      </div>`;

    const dataFmt = new Date(jogo.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    return `
      <div class="jogo-card">
        <div class="jogo-card-header">
          <span class="jogo-rodada">${jogo.rodada}</span>
          <span class="jogo-data">${dataFmt} · ${jogo.local.split(',')[1]?.trim() || jogo.local}</span>
          ${statusHtml}
        </div>
        <div class="jogo-card-body">
          <div class="confronto">
            <div class="time"><div class="time-bandeira">🇧🇷</div><div class="time-nome brasil">Brasil</div></div>
            <div class="placar-box">${placarHtml}</div>
            <div class="time"><div class="time-bandeira">${jogo.flag}</div><div class="time-nome">${jogo.adversario}</div></div>
          </div>
          ${marcadoresHtml}
          <div class="prob-section">
            <div class="prob-label-row"><span>Brasil</span><span>Empate</span><span>${jogo.adversario}</span></div>
            <div class="prob-bar-wrap">
              <div class="prob-bar-brasil" style="width:0%" data-target="${a.pVitBRA}%"></div>
              <div class="prob-bar-empate" style="width:0%" data-target="${a.pEmpate}%"></div>
              <div class="prob-bar-adversario" style="width:0%" data-target="${a.pVitADV}%"></div>
            </div>
            <div class="prob-pct-row">
              <span class="pct-brasil">${a.pVitBRA}%</span>
              <span class="pct-empate">${a.pEmpate}%</span>
              <span class="pct-adversario">${a.pVitADV}%</span>
            </div>
          </div>
          ${placaresHtml}
          <div class="info-row">
            <span class="info-chip">λ Brasil: ${a.lamBRA}</span>
            <span class="info-chip">λ ${jogo.adversario}: ${a.lamADV}</span>
            <span class="info-chip">Base Elo: ${a.eElo}%</span>
            <span class="info-chip">FIFA: ${BASE.pontosFIFA.BRA} vs ${BASE.pontosFIFA[jogo.codAdv]} pts</span>
          </div>
          <div class="confianca-row"><span>Confiança da projeção:</span><span class="estrelas">${estrelas(a.confianca)}</span></div>
          <p class="analise-texto">${gerarTexto(jogo, a)}</p>
          <p class="modelo-nota">Modelo: força Elo (pontos FIFA) + gols via Poisson (Dixon-Coles simplificado).</p>
          ${countdownHtml}
          ${validacaoHtml}
        </div>
      </div>`;
  }).join('');

  setTimeout(() => document.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target), 100);

  const det = document.getElementById('assert-detalhe');
  if (total > 0) {
    document.getElementById('assert-val').textContent = Math.round((acertos / total) * 100) + '%';
    det.textContent = `${acertos} de ${total} ${total === 1 ? 'jogo' : 'jogos'} no vencedor`;
  } else {
    document.getElementById('assert-val').textContent = '—';
    det.textContent = 'Aguardando o 1º jogo';
  }

  clearInterval(window.__ctTimer);
  window.__ctTimer = setInterval(() => {
    jogos.forEach(jogo => {
      const el = document.getElementById(`ct-${jogo.id}`);
      if (!el) return;
      const ct = countdown(jogo.data);
      if (ct) el.textContent = ct; else el.closest('.countdown-box')?.remove();
    });
  }, 1000);
}

// ── TEXTOS ───────────────────────────────────────────────────
function gerarTexto(jogo, a) {
  const { codAdv, adversario, finalizado, resultadoReal } = jogo;
  if (finalizado && resultadoReal) {
    const { golsBRA, golsADV } = resultadoReal;
    if (golsBRA === golsADV) return `O empate ficou dentro do leque de placares prováveis. O ${adversario} tem qualidade para incomodar, e confirmou isso em campo.`;
    if (golsBRA > golsADV) return `Vitória dentro do esperado. O Brasil confirmou o favoritismo que os números apontavam e seguiu firme rumo à classificação.`;
    return `Resultado fora da curva — a tendência apontava o Brasil como favorito. Futebol tem margem de surpresa, e esse jogo caiu nela.`;
  }
  const textos = {
    HAI: `O retrospecto é direto e a diferença de nível também: o modelo concentra a maior parte da probabilidade numa vitória brasileira por dois ou três gols.`,
    SCO: `A Escócia chega organizada e embalada, mas os pontos FIFA e o histórico pendem para o Brasil. Os números apontam vantagem brasileira num jogo que pode decidir o grupo.`,
    MAR: `Marrocos foi semifinalista em 2022 e é forte. A força combinada dá leve favoritismo ao Brasil, mas o empate aparece com peso real na distribuição de placares.`,
  };
  return textos[codAdv] || `A tendência aponta ${a.pVitBRA > a.pVitADV ? 'favoritismo brasileiro' : 'um duelo equilibrado'}.`;
}

// ── OVERLAY AUTOMÁTICO via data.json ─────────────────────────
async function aplicarDataJson() {
  try {
    const res = await fetch('./data.json?ts=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return false;
    const data = await res.json();
    let mudou = false;
    if (data.resultados) {
      BASE.jogos.forEach(j => {
        const r = data.resultados[j.id] || data.resultados[String(j.id)];
        if (r && typeof r.golsBRA === 'number' && typeof r.golsADV === 'number') {
          j.resultadoReal = r; j.finalizado = true; mudou = true;
        }
      });
    }
    if (Array.isArray(data.grupoC) && data.grupoC.length) { BASE.grupoC = data.grupoC; mudou = true; }
    return mudou;
  } catch { return false; }
}

function renderTudo() {
  const grupo = [...BASE.grupoC].sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp);
  renderTabela(grupo);
  renderJogos(BASE.jogos);
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  const status = document.getElementById('status-text');
  status.textContent = 'Processando análise…';

  renderTudo(); // render imediato com os dados embutidos (não trava na rede)
  document.getElementById('ultima-atualizacao').textContent =
    'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  status.textContent = 'Análise carregada · modelo Elo + Poisson';

  const mudou = await aplicarDataJson(); // em segundo plano
  if (mudou) { renderTudo(); status.textContent = 'Dados atualizados automaticamente'; }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
