/* Atualiza data.json com os placares reais do Brasil na Copa 2026.
   Fonte: TheSportsDB (gratuita, sem chave de produção).
   Roda na GitHub Action — só ADICIONA/atualiza resultados, nunca apaga
   os que já existem (se a API não tiver dados, o data.json fica intacto). */
import fs from 'fs';

const KEY = '3';
const FIXTURES = [
  { id: 1, adv: 'Morocco' },
  { id: 2, adv: 'Haiti' },
  { id: 3, adv: 'Scotland' },
];

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'roginie-wc2026' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function main() {
  const path = 'data.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.resultados = data.resultados || {};

  let teamId = null;
  try {
    const j = await getJson(`https://www.thesportsdb.com/api/v1/json/${KEY}/searchteam.php?t=Brazil`);
    const times = j.teams || [];
    const sel = times.find(t => t.strSport === 'Soccer') || times[0];
    teamId = sel && sel.idTeam;
  } catch (e) { console.log('Falha ao buscar time:', e.message); }
  if (!teamId) { console.log('Sem teamId — mantendo data.json como está.'); return; }

  let eventos = [];
  try {
    const j = await getJson(`https://www.thesportsdb.com/api/v1/json/${KEY}/eventslast.php?id=${teamId}`);
    eventos = j.results || j.events || [];
  } catch (e) { console.log('Falha ao buscar eventos:', e.message); }

  let mudou = false;
  for (const fx of FIXTURES) {
    const ev = eventos.find(e =>
      ((e.strHomeTeam || '').includes(fx.adv) || (e.strAwayTeam || '').includes(fx.adv)) &&
      e.intHomeScore != null && e.intAwayScore != null);
    if (!ev) continue;
    const casa = /brazil/i.test(ev.strHomeTeam || '');
    const golsBRA = parseInt(casa ? ev.intHomeScore : ev.intAwayScore, 10);
    const golsADV = parseInt(casa ? ev.intAwayScore : ev.intHomeScore, 10);
    if (Number.isNaN(golsBRA) || Number.isNaN(golsADV)) continue;
    const atual = data.resultados[fx.id];
    if (!atual || atual.golsBRA !== golsBRA || atual.golsADV !== golsADV) {
      data.resultados[fx.id] = { golsBRA, golsADV };
      mudou = true;
      console.log(`Jogo ${fx.id} (${fx.adv}): ${golsBRA}x${golsADV}`);
    }
  }

  if (mudou) {
    data.atualizadoEm = new Date().toISOString();
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log('data.json atualizado.');
  } else {
    console.log('Nenhuma mudança (API sem novos resultados).');
  }
}

main().catch(e => { console.log('Erro geral:', e.message); process.exit(0); });
