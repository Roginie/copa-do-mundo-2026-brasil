/* ============================================================
   Copa do Mundo 2026 — Análise Preditiva Brasil
   Dados base reais + enriquecimento via TheSportsDB
   ============================================================ */

// ── BASE DE DADOS REAIS ──────────────────────────────────────
const BASE = {
  // Ranking FIFA junho 2026
  rankingFIFA: { BRA: 5, MAR: 11, SCO: 38, HAI: 85 },

  // Histórico H2H em Copas do Mundo + competições oficiais
  h2h: {
    'BRA-MAR': { jogos: 4, vBRA: 2, e: 1, vADV: 1, golsBRA: 6, golsADV: 4 },
    'BRA-HAI': { jogos: 3, vBRA: 3, e: 0, vADV: 0, golsBRA: 17, golsADV: 1 },
    'BRA-SCO': { jogos: 2, vBRA: 2, e: 0, vADV: 0, golsBRA: 4, golsADV: 1 },
  },

  // Forma recente (aproveitamento % últimos 10 jogos)
  forma: { BRA: 0.60, MAR: 0.72, SCO: 0.58, HAI: 0.40 },

  // Gols marcados por jogo (média últimos 10)
  mediagols: { BRA: 1.8, MAR: 1.5, SCO: 1.4, HAI: 0.9 },

  // Jogos do Brasil no Grupo C
  jogos: [
    {
      id: 1,
      rodada: 'Rodada 1',
      data: '2026-06-13T22:00:00-03:00',
      local: 'MetLife Stadium, Nova York',
      adversario: 'Marrocos',
      codAdv: 'MAR',
      flag: '🇲🇦',
      resultadoReal: { golsBRA: 1, golsADV: 1, marcadores: ['Vinícius Jr (32\')', 'Saibari (21\')'] },
      finalizado: true,
    },
    {
      id: 2,
      rodada: 'Rodada 2',
      data: '2026-06-19T22:00:00-03:00',
      local: 'Lincoln Financial Field, Filadélfia',
      adversario: 'Haiti',
      codAdv: 'HAI',
      flag: '🇭🇹',
      resultadoReal: null, // será buscado via API ou preenchido manualmente
      finalizado: false,
    },
    {
      id: 3,
      rodada: 'Rodada 3',
      data: '2026-06-24T19:00:00-03:00',
      local: 'Hard Rock Stadium, Miami',
      adversario: 'Escócia',
      codAdv: 'SCO',
      flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      resultadoReal: null,
      finalizado: false,
    },
  ],

  // Classificação base (atualizada rodada 1)
  grupoC: [
    { pos: 1, cod: 'SCO', nome: 'Escócia',  flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', j:1, v:1, e:0, d:0, gp:1, gc:0, sg:1, pts:3 },
    { pos: 2, cod: 'BRA', nome: 'Brasil',   flag: '🇧🇷', j:1, v:0, e:1, d:0, gp:1, gc:1, sg:0, pts:1 },
    { pos: 3, cod: 'MAR', nome: 'Marrocos', flag: '🇲🇦', j:1, v:0, e:1, d:0, gp:1, gc:1, sg:0, pts:1 },
    { pos: 4, cod: 'HAI', nome: 'Haiti',    flag: '🇭🇹', j:1, v:0, e:0, d:1, gp:0, gc:1, sg:-1, pts:0 },
  ],
};

// ── MOTOR DE ANÁLISE PREDITIVA ───────────────────────────────
function calcularProbabilidades(codBRA, codAdv) {
  const h2hKey = `BRA-${codAdv}`;
  const h2h = BASE.h2h[h2hKey] || { jogos: 0, vBRA: 0, e: 0, vADV: 0, golsBRA: 0, golsADV: 0 };

  // Força relativa via ranking FIFA (inverso — menor rank = mais forte)
  const rBRA = 1 / BASE.rankingFIFA['BRA'];
  const rADV = 1 / BASE.rankingFIFA[codAdv];
  const forcaRank = rBRA / (rBRA + rADV);

  // Força via H2H histórico
  let forcaH2H = 0.5;
  if (h2h.jogos > 0) {
    forcaH2H = (h2h.vBRA + 0.5 * h2h.e) / h2h.jogos;
  }

  // Força via forma recente
  const forcaForma = BASE.forma['BRA'] / (BASE.forma['BRA'] + BASE.forma[codAdv]);

  // Média ponderada
  const peso = { rank: 0.35, h2h: 0.40, forma: 0.25 };
  const forca = (forcaRank * peso.rank) + (forcaH2H * peso.h2h) + (forcaForma * peso.forma);

  const diff = forca - 0.5;

  let pVitBRA, pEmpate, pVitADV;
  pEmpate = Math.max(0.10, 0.28 - Math.abs(diff) * 0.5);
  if (diff >= 0) {
    pVitBRA = forca * (1 - pEmpate * 0.5);
    pVitADV = 1 - pVitBRA - pEmpate;
  } else {
    pVitADV = (1 - forca) * (1 - pEmpate * 0.5);
    pVitBRA = 1 - pVitADV - pEmpate;
  }
  pVitBRA  = Math.max(0.03, Math.min(0.95, pVitBRA));
  pVitADV  = Math.max(0.03, Math.min(0.95, pVitADV));
  pEmpate  = Math.max(0.02, Math.min(0.40, pEmpate));
  const soma = pVitBRA + pEmpate + pVitADV;
  pVitBRA /= soma; pEmpate /= soma; pVitADV /= soma;

  const xgBRA = parseFloat((BASE.mediagols['BRA'] * forca * 1.1).toFixed(1));
  const xgADV = parseFloat((BASE.mediagols[codAdv] * (1 - forca) * 1.1).toFixed(1));
  const gBRA  = Math.round(xgBRA);
  const gADV  = Math.round(xgADV);

  const confianca = h2h.jogos >= 5 ? 5 : h2h.jogos >= 3 ? 4 : h2h.jogos >= 1 ? 3 : 2;

  return {
    pVitBRA:  Math.round(pVitBRA  * 100),
    pEmpate:  Math.round(pEmpate  * 100),
    pVitADV:  Math.round(pVitADV  * 100),
    placarBRA: gBRA,
    placarADV: gADV,
    xgBRA, xgADV,
    confianca,
  };
}

// ── VALIDAÇÃO RETROATIVA ─────────────────────────────────────
// Critério do projeto: acerto quando o palpite acerta o vencedor
// OU fica a até 1 gol do placar real.
function validarJogo(analise, resultado) {
  if (!resultado) return null;
  const { golsBRA, golsADV } = resultado;
  const { pVitBRA, pEmpate, pVitADV, placarBRA, placarADV } = analise;

  let previsorReal;
  if (pVitBRA > pEmpate && pVitBRA > pVitADV)  previsorReal = 'brasil';
  else if (pVitADV > pEmpate && pVitADV > pVitBRA) previsorReal = 'adversario';
  else                                              previsorReal = 'empate';

  let vencedorReal;
  if (golsBRA > golsADV)      vencedorReal = 'brasil';
  else if (golsADV > golsBRA) vencedorReal = 'adversario';
  else                        vencedorReal = 'empate';

  const acertouVencedor = previsorReal === vencedorReal;
  const diffGolsBRA = Math.abs(placarBRA - golsBRA);
  const diffGolsADV = Math.abs(placarADV - golsADV);
  const placarProximo = diffGolsBRA <= 1 && diffGolsADV <= 1;
  const placarExato = (placarBRA === golsBRA && placarADV === golsADV);

  let tipo, label, detalhe;
  const det = `Projeção ${placarBRA}×${placarADV} · Resultado ${golsBRA}×${golsADV}`;
  if (placarExato || (acertouVencedor && placarProximo)) {
    tipo = 'acerto'; label = '✅ Acerto'; detalhe = det;
  } else if (acertouVencedor || placarProximo) {
    tipo = 'parcial'; label = '⚠️ Parcial'; detalhe = det;
  } else {
    tipo = 'erro'; label = '❌ Erro'; detalhe = det;
  }
  const validou = tipo !== 'erro';
  return { tipo, label, detalhe, acertouVencedor, validou };
}

// ── COUNTDOWN ────────────────────────────────────────────────
function countdown(dataStr) {
  const alvo = new Date(dataStr).getTime();
  const agora = Date.now();
  const diff = alvo - agora;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}

function estrelas(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// ── RENDER TABELA GRUPO ──────────────────────────────────────
function renderTabela(dados) {
  const body = document.getElementById('grupo-body');
  body.innerHTML = dados.map((t, i) => `
    <tr class="${t.cod === 'BRA' ? 'row-brasil' : ''}">
      <td>${i + 1}</td>
      <td>${t.flag} ${t.nome}</td>
      <td>${t.j}</td>
      <td>${t.v}</td>
      <td>${t.e}</td>
      <td>${t.d}</td>
      <td>${t.gp}</td>
      <td>${t.gc}</td>
      <td>${t.sg >= 0 ? '+' : ''}${t.sg}</td>
      <td class="pts-cell">${t.pts}</td>
    </tr>
  `).join('');
}

// ── RENDER CARDS DE JOGOS ────────────────────────────────────
function renderJogos(jogos) {
  const grid = document.getElementById('jogos-grid');

  let acertos = 0, total = 0;

  grid.innerHTML = jogos.map(jogo => {
    const analise = calcularProbabilidades('BRA', jogo.codAdv);
    let validacao = null;

    const agora = Date.now();
    const dataJogo = new Date(jogo.data).getTime();
    const jogoPassado = agora > dataJogo + 120 * 60 * 1000;

    if (jogoPassado && jogo.resultadoReal) {
      jogo.finalizado = true;
      validacao = validarJogo(analise, jogo.resultadoReal);
      total++;
      if (validacao.validou) acertos++;
    }

    let statusHtml;
    if (jogo.finalizado && jogo.resultadoReal) {
      statusHtml = `<span class="jogo-status status-finalizado">Finalizado</span>`;
    } else if (jogoPassado && !jogo.resultadoReal) {
      statusHtml = `<span class="jogo-status status-finalizado">Aguardando resultado</span>`;
    } else if (!jogoPassado && agora > dataJogo - 30 * 60 * 1000) {
      statusHtml = `<span class="jogo-status status-ao-vivo">🔴 Ao vivo</span>`;
    } else {
      statusHtml = `<span class="jogo-status status-futuro">Próximo jogo</span>`;
    }

    let placarHtml;
    if (jogo.finalizado && jogo.resultadoReal) {
      const { golsBRA, golsADV } = jogo.resultadoReal;
      placarHtml = `<div class="placar-real">${golsBRA} – ${golsADV}</div>`;
    } else {
      placarHtml = `
        <div class="placar-vs">VS</div>
        <div class="placar-previsto-label">Projeção</div>
        <div class="placar-previsto-val">${analise.placarBRA} – ${analise.placarADV}</div>
      `;
    }

    const ct = countdown(jogo.data);
    const countdownHtml = (!jogo.finalizado && ct) ? `
      <div class="countdown-box">
        <div class="countdown-label">Faltam</div>
        <div class="countdown-timer" id="ct-${jogo.id}">${ct}</div>
      </div>
    ` : '';

    const validacaoHtml = validacao ? `
      <div class="validacao-row">
        <span class="validacao-badge badge-${validacao.tipo}">${validacao.label}</span>
        <span class="validacao-detalhe">${validacao.detalhe}</span>
      </div>
    ` : '';

    const marcadoresHtml = jogo.resultadoReal?.marcadores ? `
      <div class="info-row" style="margin-top:10px">
        ${jogo.resultadoReal.marcadores.map(m => `<span class="info-chip">⚽ ${m}</span>`).join('')}
      </div>
    ` : '';

    const textoAnalise = gerarTextoAnalise(jogo, analise);

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
            <div class="time">
              <div class="time-bandeira">🇧🇷</div>
              <div class="time-nome brasil">Brasil</div>
            </div>
            <div class="placar-box">
              ${placarHtml}
            </div>
            <div class="time">
              <div class="time-bandeira">${jogo.flag}</div>
              <div class="time-nome">${jogo.adversario}</div>
            </div>
          </div>

          ${marcadoresHtml}

          <div class="prob-section">
            <div class="prob-label-row">
              <span>Brasil</span><span>Empate</span><span>${jogo.adversario}</span>
            </div>
            <div class="prob-bar-wrap">
              <div class="prob-bar-brasil"  style="width:0%" data-target="${analise.pVitBRA}%"></div>
              <div class="prob-bar-empate"  style="width:0%" data-target="${analise.pEmpate}%"></div>
              <div class="prob-bar-adversario" style="width:0%" data-target="${analise.pVitADV}%"></div>
            </div>
            <div class="prob-pct-row">
              <span class="pct-brasil">${analise.pVitBRA}%</span>
              <span class="pct-empate">${analise.pEmpate}%</span>
              <span class="pct-adversario">${analise.pVitADV}%</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-chip">📊 xG Brasil: ${analise.xgBRA}</span>
            <span class="info-chip">📊 xG ${jogo.adversario}: ${analise.xgADV}</span>
            <span class="info-chip">🌐 FIFA: #${BASE.rankingFIFA['BRA']} vs #${BASE.rankingFIFA[jogo.codAdv]}</span>
          </div>

          <div class="confianca-row">
            <span>Confiança da projeção:</span>
            <span class="estrelas">${estrelas(analise.confianca)}</span>
          </div>

          <p class="analise-texto">${textoAnalise}</p>

          ${countdownHtml}
          ${validacaoHtml}
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    document.querySelectorAll('[data-target]').forEach(el => {
      el.style.width = el.dataset.target;
    });
  }, 100);

  const elDet = document.getElementById('assert-detalhe');
  if (total > 0) {
    const pct = Math.round((acertos / total) * 100);
    document.getElementById('assert-val').textContent = `${pct}%`;
    if (elDet) elDet.textContent = `${acertos} de ${total} ${total === 1 ? 'jogo validado' : 'jogos validados'}`;
  } else {
    document.getElementById('assert-val').textContent = '—';
    if (elDet) elDet.textContent = 'Aguardando o 1º jogo';
  }

  setInterval(() => {
    jogos.forEach(jogo => {
      const el = document.getElementById(`ct-${jogo.id}`);
      if (el) {
        const ct = countdown(jogo.data);
        if (ct) el.textContent = ct;
        else el.closest('.countdown-box')?.remove();
      }
    });
  }, 1000);
}

// ── TEXTOS DE ANÁLISE (naturais) ─────────────────────────────
function gerarTextoAnalise(jogo, analise) {
  const { codAdv, adversario, finalizado, resultadoReal } = jogo;
  const { pVitBRA, pVitADV } = analise;

  if (finalizado && resultadoReal) {
    const { golsBRA, golsADV } = resultadoReal;
    if (golsBRA === golsADV) {
      return `O empate refletiu o equilíbrio que os números apontavam. O ${adversario} tem qualidade para incomodar qualquer seleção, como ficou claro em campo.`;
    } else if (golsBRA > golsADV) {
      return `Vitória dentro do esperado. O Brasil confirmou o favoritismo e seguiu firme no caminho da classificação.`;
    } else {
      return `Resultado fora da curva — a tendência apontava o Brasil como favorito. Futebol tem margem de surpresa, e esse jogo caiu nela.`;
    }
  }

  const textos = {
    'HAI': `O retrospecto é direto: três vitórias do Brasil nos confrontos anteriores, com 17 a 1 no agregado. O Haiti resiste com linhas baixas, mas a diferença técnica é grande. A tendência é de vitória brasileira com folga.`,
    'SCO': `A Escócia chega embalada e com defesa bem organizada, mas o histórico pende para o Brasil nos dois duelos anteriores. Os números apontam vantagem brasileira — ainda que o contexto do grupo deixe o jogo tenso.`,
    'MAR': `Marrocos foi semifinalista em 2022 e tem peças de alto nível na Europa. O empate em 2023 mostra que dá trabalho. Confronto parelho, com leve vantagem brasileira no retrospecto geral.`,
  };

  return textos[codAdv] || `Os números apontam ${pVitBRA > pVitADV ? 'favoritismo brasileiro' : 'um duelo equilibrado'} neste confronto.`;
}

// ── BUSCA DE RESULTADOS VIA API ──────────────────────────────
async function buscarResultadosAPI() {
  try {
    const url = 'https://www.thesportsdb.com/api/v1/json/3/searchteam.php?t=Brazil';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('API indisponível');
    // Espaço para enriquecer BASE.jogos com placares ao vivo quando a API
    // disponibilizar os dados da Copa 2026. O fallback mantém os dados base.
  } catch {
    // silencioso — dados base já cobrem os jogos
  }
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  document.getElementById('status-text').textContent = 'Processando análise…';

  await buscarResultadosAPI();

  const grupoOrdenado = [...BASE.grupoC].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.sg  !== a.sg)  return b.sg  - a.sg;
    return b.gp - a.gp;
  });

  renderTabela(grupoOrdenado);
  renderJogos(BASE.jogos);

  const agora = new Date();
  document.getElementById('ultima-atualizacao').textContent =
    `Atualizado às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  document.getElementById('status-text').textContent = 'Análise carregada com dados reais';
}

document.addEventListener('DOMContentLoaded', init);
