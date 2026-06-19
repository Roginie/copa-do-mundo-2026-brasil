// ============================================================
// Copa do Brasil 2026 — dados e modelo probabilístico
// "poder": índice de força de 0 a 100 (elenco, investimento,
// desempenho recente e tradição na Copa do Brasil).
// "copa": participa do ranking de título (clubes).
// ============================================================
const TIMES = [
  { nome: "Flamengo", emoji: "🔴⚫", poder: 92, copa: true,
    motivo: "Elenco mais caro do país, profundidade de banco e investimento pesado. Forte candidato em qualquer competição de mata-mata." },
  { nome: "Palmeiras", emoji: "🟢", poder: 90, copa: true,
    motivo: "Regularidade altíssima, base vencedora e ótimo trabalho de comissão. Sempre entre os favoritos." },
  { nome: "Botafogo", emoji: "⚪⚫", poder: 84, copa: true,
    motivo: "Projeto forte com investimento (grupo John Textor) e elenco competitivo após anos de protagonismo." },
  { nome: "Atlético-MG", emoji: "⚫⚪", poder: 82, copa: true,
    motivo: "Elenco robusto e tradição em jogos decisivos. Especialista em campanhas de copa." },
  { nome: "São Paulo", emoji: "🔴⚪⚫", poder: 81, copa: true,
    motivo: "Campeão da Copa do Brasil de 2023, estrutura sólida e elenco equilibrado." },
  { nome: "Fluminense", emoji: "🟢🔴", poder: 80, copa: true,
    motivo: "Geração recente vitoriosa (Libertadores 2023) e bom futebol coletivo." },
  { nome: "Cruzeiro", emoji: "🔵", poder: 79, copa: true,
    motivo: "Reestruturado e com investimento crescente, voltou a montar elenco forte." },
  { nome: "Corinthians", emoji: "⚫⚪", poder: 78, copa: true,
    motivo: "Maior vencedor da história da Copa do Brasil. Tradição e força de torcida pesam no mata-mata." },
  { nome: "Internacional", emoji: "🔴", poder: 77, copa: true,
    motivo: "Elenco experiente e consistência defensiva. Sempre incômodo em jogos eliminatórios." },
  { nome: "Grêmio", emoji: "🔵⚫⚪", poder: 76, copa: true,
    motivo: "Tradição em copas e capacidade de surpreender em jogos únicos." },
  { nome: "Bahia", emoji: "🔵🔴", poder: 75, copa: true,
    motivo: "Investimento do City Football Group elevou o nível do elenco e da estrutura." },
  { nome: "Athletico-PR", emoji: "🔴⚫", poder: 74, copa: true,
    motivo: "Base forte, boa formação de jogadores e histórico recente de bons resultados em copas." },
  { nome: "Fortaleza", emoji: "🔵🔴⚪", poder: 73, copa: true,
    motivo: "Trabalho consistente, organização tática e regularidade acima da média." },
  { nome: "Red Bull Bragantino", emoji: "🔴⚪", poder: 72, copa: true,
    motivo: "Estrutura moderna e elenco jovem competitivo, com bom scouting." },
  { nome: "Vasco", emoji: "⚫⚪", poder: 70, copa: true,
    motivo: "Investimento recente e torcida gigante; oscila, mas tem potencial de zebra." },
  { nome: "Santos", emoji: "⚪⚫", poder: 69, copa: true,
    motivo: "Tradição e base histórica, em fase de reconstrução do elenco." },
  // Bônus fora do ranking (para o simulador) — a famosa pergunta "clube x seleção"
  { nome: "Seleção Brasileira 🇧🇷", emoji: "🇧🇷", poder: 99, copa: false,
    motivo: "Seleção reúne os melhores jogadores brasileiros espalhados pelo mundo — nível individual muito acima de qualquer clube." },
];

// ---- Modelo de probabilidade de título ----
const EXP_TITULO = 5;   // concentra a chance nos mais fortes
const EXP_DUELO = 6;    // sensibilidade do confronto direto

function probabilidadesTitulo() {
  const clubes = TIMES.filter(t => t.copa);
  const pesos = clubes.map(t => Math.pow(t.poder, EXP_TITULO));
  const soma = pesos.reduce((a, b) => a + b, 0);
  return clubes
    .map((t, i) => ({ ...t, prob: (pesos[i] / soma) * 100 }))
    .sort((a, b) => b.prob - a.prob);
}

function probDuelo(a, b) {
  const pa = Math.pow(a.poder, EXP_DUELO);
  const pb = Math.pow(b.poder, EXP_DUELO);
  return pa / (pa + pb); // chance de A vencer
}

// ---- Render do ranking ----
function renderRanking() {
  const lista = probabilidadesTitulo();
  const max = lista[0].prob;
  const box = document.getElementById("ranking-list");
  box.innerHTML = "";
  lista.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "rank-card" + (i === 0 ? " top1" : "");
    card.style.animationDelay = (i * 60) + "ms";
    card.innerHTML = `
      <div class="rank-pos">${i + 1}º</div>
      <div class="rank-info">
        <h3><span class="rank-emoji">${t.emoji}</span> ${t.nome}
          <span style="font-size:.75rem;color:var(--muted)">· poder ${t.poder}</span></h3>
        <div class="rank-motivo">${t.motivo}</div>
        <div class="rank-bar-wrap"><div class="rank-bar" data-w="${(t.prob / max) * 100}"></div></div>
      </div>
      <div class="rank-prob">${t.prob.toFixed(1)}%<small>chance de título</small></div>
    `;
    box.appendChild(card);
  });
  // anima as barras
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll(".rank-bar").forEach(b => b.style.width = b.dataset.w + "%");
    }, 200);
  });
}

// ---- Simulador ----
function preencherSelects() {
  const a = document.getElementById("teamA");
  const b = document.getElementById("teamB");
  TIMES.forEach((t, i) => {
    a.add(new Option(t.nome, i));
    b.add(new Option(t.nome, i));
  });
  a.value = 0;            // Flamengo
  b.value = TIMES.length - 1; // Seleção Brasileira (o exemplo clássico)
}

function simular() {
  const a = TIMES[+document.getElementById("teamA").value];
  const b = TIMES[+document.getElementById("teamB").value];
  const out = document.getElementById("sim-result");
  if (a.nome === b.nome) {
    out.innerHTML = `<div class="result-card"><p class="result-verdict">Escolha dois times diferentes 😉</p></div>`;
    return;
  }
  const pa = probDuelo(a, b) * 100;
  const pb = 100 - pa;
  const venc = pa >= pb ? a : b;
  const dif = Math.abs(pa - pb);
  let leitura;
  if (dif < 8) leitura = "confronto bem equilibrado — daria um jogão!";
  else if (dif < 22) leitura = "ligeiro favoritismo, mas com espaço pra zebra.";
  else if (dif < 40) leitura = "favoritismo claro.";
  else leitura = "favoritismo amplo — diferença grande de nível.";

  out.innerHTML = `
    <div class="result-card">
      <div class="result-vs">
        <div class="result-team ${pa >= pb ? "win" : "lose"}">
          <div class="name">${a.emoji} ${a.nome}</div>
          <div class="pct">${pa.toFixed(1)}%</div>
        </div>
        <div class="versus">x</div>
        <div class="result-team ${pb > pa ? "win" : "lose"}">
          <div class="name">${b.emoji} ${b.nome}</div>
          <div class="pct">${pb.toFixed(1)}%</div>
        </div>
      </div>
      <div class="result-bar">
        <div class="a" style="width:${pa}%"></div>
        <div class="b" style="width:${pb}%"></div>
      </div>
      <p class="result-verdict">Quem leva a melhor: <strong>${venc.emoji} ${venc.nome}</strong> — ${leitura}</p>
    </div>
  `;
}

// ---- Init ----
renderRanking();
preencherSelects();
document.getElementById("simBtn").addEventListener("click", simular);
