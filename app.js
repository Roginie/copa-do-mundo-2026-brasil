/* ============================================================
   Copa do Mundo 2026 — Análise Preditiva do Brasil (Grupo C)
   Dados reais embutidos (fallback) + overlay automático via data.json
   HTML + CSS + JS puro · roda direto no GitHub Pages
   ============================================================ */

// ── DADOS REAIS (fallback embutido — sempre funciona offline) ─
const BASE = {
  rankingFIFA: { BRA: 5, MAR: 11, SCO: 38, HAI: 85 },

  h2h: {
    'BRA-MAR': { jogos: 4, vBRA: 2, e: 1, vADV: 1, golsBRA: 6, golsADV: 4 },
    'BRA-HAI': { jogos: 3, vBRA: 3, e: 0, vADV: 0, golsBRA: 17, golsADV: 1 },
    'BRA-SCO': { jogos: 2, vBRA: 2, e: 0, vADV: 0, golsBRA: 4, golsADV: 1 },
  },

  forma: { BRA: 0.60, MAR: 0.72, SCO: 0.58, HAI: 0.40 },
  mediagols: { BRA: 1.8, MAR: 1.5, SCO: 1.4, HAI: 0.9 },

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

// ── MOTOR DE ANÁLISE ─────────────────────────────────────────
function calcularProbabilidades(codAdv) {
  const h2h = BASE.h2h[`BRA-${codAdv}`] || { jogos: 0, vBRA: 0, e: 0, vADV: 0 };

  const rBRA = 1 / BASE.rankingFIFA.BRA;
  const rADV = 1 / BASE.rankingFIFA[codAdv];
  const forcaRank = rBRA / (rBRA + rADV);

  let forcaH2H = 0.5;
  if (h2h.jogos > 0) forcaH2H = (h2h.vBRA + 0.5 * h2h.e) / h2h.jogos;

  const forcaForma = BASE.forma.BRA / (BASE.forma.BRA + BASE.forma[codAdv]);

  const peso = { rank: 0.35, h2h: 0.40, forma: 0.25 };
  const forca = forcaRank * peso.rank + forcaH2H * peso.h2h + forcaForma * peso.forma;

  const diff = forca - 0.5;
  let pVitBRA, pEmpate, pVitADV;
  pEmpate = Math.max(0.10, Math.min(0.40, 0.28 - Math.abs(diff) * 0.5));
  if (diff >= 0) {
    pVitBRA = forca * (1 - pEmpate * 0.5);
    pVitADV = 1 - pVitBRA - pEmpate;
  } else {
    pVitADV = (1 - forca) * (1 - pEmpate * 0.5);
    pVitBRA = 1 - pVitADV - pEmpate;
  }
  pVitBRA = Math.max(0.03, Math.min(0.95, pVitBRA));
  pVitADV = Math.max(0.03, Math.min(0.95, pVitADV));
  const soma = pVitBRA + pEmpate + pVitADV;
  pVitBRA /= soma; pEmpate /= soma; pVitADV /= soma;

  const xgBRA = +(BASE.mediagols.BRA * forca * 1.1).toFixed(1);
  const xgADV = +(BASE.mediagols[codAdv] * (1 - forca) * 1.1).toFixed(1);

  const confianca = h2h.jogos >= 5 ? 5 : h2h.jogos >= 3 ? 4 : h2h.jogos >= 1 ? 3 : 2;

  return {
    pVitBRA: Math.round(pVitBRA * 100),
    pEmpate: Math.round(pEmpate * 100),
    pVitADV: Math.round(pVitADV * 100),
    placarBRA: Math.round(xgBRA),
    placarADV: Math.round(xgADV),
    xgBRA, xgADV, confianca,
  };
}

// ── VALIDAÇÃO RETROATIVA ─────────────────────────────────────
function validarJogo(analise, resultado) {
  if (!resultado) return null;
  const { golsBRA, golsADV } = resultado;
  const { placarBRA, placarADV } = analise;

  const sinal = (a, b) => (a > b ? 'brasil' : a < b ? 'adversario' : 'empate');
  const previsto = sinal(placarBRA, placarADV);
  const real = sinal(golsBRA, golsADV);

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
        <div class="placar-previsto-label">Projeção</div>
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
          <div class="info-row">
            <span class="info-chip">📊 xG Brasil: ${a.xgBRA}</span>
            <span class="info-chip">📊 xG ${jogo.adversario}: ${a.xgADV}</span>
            <span class="info-chip">🌐 FIFA: #${BASE.rankingFIFA.BRA} vs #${BASE.rankingFIFA[jogo.codAdv]}</span>
          </div>
          <div class="confianca-row"><span>Confiança da projeção:</span><span class="estrelas">${estrelas(a.confianca)}</span></div>
          <p class="analise-texto">${gerarTexto(jogo, a)}</p>
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
    if (golsBRA === golsADV) return `O empate refletiu o equilíbrio que os números apontavam. O ${adversario} tem qualidade para incomodar, e confirmou isso em campo.`;
    if (golsBRA > golsADV) return `Vitória dentro do esperado. O Brasil confirmou o favoritismo e seguiu firme rumo à classificação.`;
    return `Resultado fora da curva — a tendência apontava o Brasil como favorito. Futebol tem margem de surpresa, e esse jogo caiu nela.`;
  }
  const textos = {
    HAI: `O retrospecto é direto: três vitórias do Brasil nos confrontos anteriores, 17 a 1 no agregado. O Haiti se fecha bem, mas a diferença técnica é grande. A tendência é de vitória brasileira com folga.`,
    SCO: `A Escócia chega embalada e com defesa organizada, mas o histórico pende para o Brasil nos dois duelos anteriores. Os números apontam vantagem brasileira num jogo que pode decidir o grupo.`,
    MAR: `Marrocos foi semifinalista em 2022 e tem peças de alto nível na Europa. O empate em 2023 mostra que dá trabalho. Confronto parelho, com leve vantagem brasileira no retrospecto.`,
  };
  return textos[codAdv] || `Os números apontam ${a.pVitBRA > a.pVitADV ? 'favoritismo brasileiro' : 'um duelo equilibrado'}.`;
}

// ── OVERLAY AUTOMÁTICO via data.json (mantido por GitHub Action) ─
// Lê os resultados/standings mais recentes da mesma origem (sem CORS).
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
          j.resultadoReal = r;
          j.finalizado = true;
          mudou = true;
        }
      });
    }
    if (Array.isArray(data.grupoC) && data.grupoC.length) {
      BASE.grupoC = data.grupoC;
      mudou = true;
    }
    if (data.atualizadoEm) window.__dataAtualizadoEm = data.atualizadoEm;
    return mudou;
  } catch {
    return false; // sem data.json: usa os dados embutidos
  }
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

  // 1) Render imediato com os dados embutidos (nunca trava na rede)
  renderTudo();
  document.getElementById('ultima-atualizacao').textContent =
    'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  status.textContent = 'Análise carregada com dados reais';

  // 2) Em segundo plano: aplica o data.json (atualizado pela automação) e re-renderiza
  const mudou = await aplicarDataJson();
  if (mudou) {
    renderTudo();
    status.textContent = 'Dados atualizados automaticamente';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
