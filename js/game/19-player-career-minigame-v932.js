/*
  V9.32 · Ser jugador
  - Pulido visual de la ficha compacta.
  - OVR pasa a mostrarse como Media.
  - Historial breve de trofeos individuales.
  - Archivo persistente con las últimas 20 carreras finalizadas.
*/

const pcV932BaseRetireCareer = pcRetireCareer;
const pcV932BaseIdentityMarkup = pcV930IdentityMarkup;
const pcV932BaseCareerTableMarkup = pcV930CareerTableMarkup;

function pcV932ArchiveId(snapshot){
  return String(snapshot?.archiveId || [snapshot?.playerId || '', snapshot?.retiredAt || '', snapshot?.name || ''].join('|'));
}

function pcV932NormalizeArchivedCareer(raw){
  if(!raw || typeof raw !== 'object') return null;
  const stats = pcNormalizeStats(raw.stats);
  const awards = pcNormalizeAwards(raw.awards);
  const titles = raw.titles && typeof raw.titles === 'object' ? raw.titles : {};
  const normalized = {
    archiveId:String(raw.archiveId || raw.id || ''),
    playerId:String(raw.playerId || ''),
    name:String(raw.name || 'Jugador'),
    nationality:String(raw.nationality || '—'),
    position:String(raw.position || '—'),
    retiredAge:Math.max(16,Math.round(Number(raw.retiredAge || raw.age || 35))),
    retiredYear:Math.max(2020,Math.round(Number(raw.retiredYear || raw.year || 2026))),
    retiredAt:String(raw.retiredAt || ''),
    reason:String(raw.reason || 'Fin de carrera'),
    lastClub:raw.lastClub && typeof raw.lastClub === 'object' ? pcNormalizeClubSnapshot(raw.lastClub) : pcNormalizeClubSnapshot(null),
    stats,
    awards,
    titles:{
      total:Math.max(0,Math.round(Number(titles.total || 0))),
      league:Math.max(0,Math.round(Number(titles.league || 0))),
      cups:Math.max(0,Math.round(Number(titles.cups || 0))),
      clubWorldCup:Math.max(0,Math.round(Number(titles.clubWorldCup || 0)))
    },
    maxOverall:pcClamp(Number(raw.maxOverall || raw.mediaMaxima || 0),1,99),
    bestValue:Math.max(0,Math.round(Number(raw.bestValue || 0))),
    seasons:Math.max(0,Math.round(Number(raw.seasons || 0))),
    clubs:Array.isArray(raw.clubs) ? raw.clubs.map(item => String(item || '')).filter(Boolean).slice(0,30) : []
  };
  if(!normalized.archiveId) normalized.archiveId = [normalized.playerId,normalized.retiredAt,normalized.name].join('|');
  return normalized;
}

function pcV932NormalizeArchive(raw){
  const rows = Array.isArray(raw) ? raw.map(pcV932NormalizeArchivedCareer).filter(Boolean) : [];
  const seen = new Set();
  return rows.filter(item => {
    const id = pcV932ArchiveId(item);
    if(seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((a,b) => String(b.retiredAt || '').localeCompare(String(a.retiredAt || '')) || Number(b.retiredYear || 0)-Number(a.retiredYear || 0)).slice(0,20);
}

function pcV932ArchiveStore(){
  if(!game) return [];
  game.miniGames = game.miniGames && typeof game.miniGames === 'object' ? game.miniGames : {};
  game.miniGames.playerCareerArchive = pcV932NormalizeArchive(game.miniGames.playerCareerArchive);
  return game.miniGames.playerCareerArchive;
}

function pcV932CareerMaxOverall(state){
  const values = [Number(state?.player?.overall || 0), Number(state?.season?.overallStart || 0)];
  (state?.history?.seasons || []).forEach(item => values.push(Number(item?.overallStart || 0),Number(item?.overallEnd || 0)));
  return pcClamp(Math.max(...values,1),1,99);
}

function pcV932CareerBestValue(state){
  const values = [Number(state?.player?.value || 0)];
  (state?.history?.seasons || []).forEach(item => values.push(Number(item?.valueEnd || 0)));
  return Math.max(...values,0);
}

function pcV932CareerClubNames(state){
  const names = [];
  const seen = new Set();
  (state?.history?.clubs || []).forEach(item => {
    const name = String(item?.club?.name || '').trim();
    if(name && !seen.has(name)){ seen.add(name); names.push(name); }
  });
  const current = String(state?.club?.name || '').trim();
  if(current && !seen.has(current)) names.push(current);
  return names;
}

function pcV932RetiredSnapshot(state){
  const palmares = pcPalmaresSummary(state);
  return pcV932NormalizeArchivedCareer({
    archiveId:[state?.player?.id || '',state?.retirement?.retiredAt || '',state?.player?.name || ''].join('|'),
    playerId:String(state?.player?.id || ''),
    name:String(state?.player?.name || 'Jugador'),
    nationality:String(state?.player?.nationality || '—'),
    position:String(state?.player?.position || '—'),
    retiredAge:Number(state?.retirement?.age || state?.player?.age || 35),
    retiredYear:Number(state?.retirement?.year || state?.season?.year || 2026),
    retiredAt:String(state?.retirement?.retiredAt || new Date().toISOString()),
    reason:String(state?.retirement?.reason || 'Fin de carrera'),
    lastClub:{...(state?.retirement?.club || state?.club || {})},
    stats:pcNormalizeStats(state?.careerStats),
    awards:pcNormalizeAwards(palmares.awards),
    titles:{ total:palmares.total,league:palmares.league,cups:palmares.teamCups,clubWorldCup:palmares.clubWorldCup },
    maxOverall:pcV932CareerMaxOverall(state),
    bestValue:pcV932CareerBestValue(state),
    seasons:Number(state?.history?.seasons?.length || 0),
    clubs:pcV932CareerClubNames(state)
  });
}

function pcV932ArchiveRetiredCareer(state){
  if(!game || !state || state.status !== 'retired') return false;
  const snapshot = pcV932RetiredSnapshot(state);
  const archive = pcV932ArchiveStore();
  const id = pcV932ArchiveId(snapshot);
  const currentIndex = archive.findIndex(item => pcV932ArchiveId(item) === id);
  if(currentIndex >= 0) archive.splice(currentIndex,1);
  archive.unshift(snapshot);
  game.miniGames.playerCareerArchive = pcV932NormalizeArchive(archive);
  return currentIndex < 0;
}

pcRetireCareer = function(state,reason='Decisión personal'){
  const wasActive = Boolean(state && state.status !== 'retired');
  pcV932BaseRetireCareer(state,reason);
  if(wasActive && state?.status === 'retired') pcV932ArchiveRetiredCareer(state);
};

function pcV932AwardIcon(type){
  if(type === 'leaguePlayer') return 'leagueTrophy';
  if(type === 'cupPlayer') return 'cupTrophy';
  if(type === 'worldPlayer') return 'worldBoot';
  return 'individualTrophy';
}

function pcV932IndividualTrophiesMarkup(state){
  const awards = (state?.history?.awards || []).filter(item => ['leaguePlayer','cupPlayer','worldPlayer'].includes(String(item?.type || ''))).slice(0,8);
  const totals = pcNormalizeAwards(pcPalmaresSummary(state).awards);
  return `<section class="pc-v932-individual-history">
    <div class="pc-v932-section-head">
      <div><small>Trofeos individuales</small><h3>Historial de distinciones</h3></div>
      <span>${pcFormatNumber(totals.leaguePlayer + totals.cupPlayer + totals.worldPlayer)}</span>
    </div>
    <div class="pc-v932-award-list">
      ${awards.length ? awards.map(item => `<article>
        <i>${pcVectorIcon(pcV932AwardIcon(String(item.type || '')))}</i>
        <div><strong>${pcEscape(item.label || 'Distinción')}</strong><small>${pcEscape(item.competition || 'Temporada')} · ${pcFormatNumber(item.year)}</small></div>
        <span>${pcEscape(item.club?.name || state.club?.name || 'Club')}</span>
      </article>`).join('') : '<p class="pc-v932-empty">Todavía no obtuvo trofeos individuales de temporada.</p>'}
    </div>
    <footer><span>Figuras del partido <b>${pcFormatNumber(totals.manOfMatch)}</b></span><span>Bota mundial <b>${pcFormatNumber(totals.worldPlayer)}</b></span></footer>
  </section>`;
}

pcV930IdentityMarkup = function(state){
  const career = pcNormalizeStats(state.careerStats);
  const palmares = pcPalmaresSummary(state);
  const awards = palmares.awards;
  const totalCups = palmares.teamCups;
  return `<div class="pc-v930-identity pc-v931-identity pc-v932-identity">
    <div class="pc-v930-overall" data-pc-stat="overall"><small>Media</small><strong>${Math.round(state.player.overall)}</strong></div>
    <div class="pc-v930-player-card">
      <div class="pc-v930-pills"><span>${pcEscape(state.player.nationality)}</span><span>#${pcEscape(state.player.position)}</span></div>
      <div class="pc-v930-name-row">${pcClubBadge(state.club)}<div><h2>${pcEscape(state.player.name)}</h2><p>${pcEscape(state.club.name)} · ${pcEscape(state.club.divisionName || 'Liga')}</p></div></div>
      <div class="pc-v930-player-meta"><span><small>Edad</small><strong>${pcFormatNumber(state.player.age)}</strong></span><span data-pc-stat="value"><small>Valor</small><strong>${pcMoney(state.player.value)}</strong></span><span><small>Sueldo</small><strong>${pcMoney(state.contract.salary)}</strong></span></div>
    </div>
    <div class="pc-v930-main-stats">
      <div><small>PJ</small><strong data-pc-stat="matches">${pcFormatNumber(career.matches)}</strong></div>
      <div><small>Goles</small><strong data-pc-stat="goals">${pcFormatNumber(career.goals)}</strong></div>
      <div><small>Asistencias</small><strong data-pc-stat="assists">${pcFormatNumber(career.assists)}</strong></div>
    </div>
    <div class="pc-v930-status-line">
      <span>Físico <b>${Math.round(state.player.condition)}%</b></span>
      <span>Moral <b>${Math.round(state.player.morale)}%</b></span>
      <span>Forma <b>${Math.round(state.player.form)}%</b></span>
      <span>Rol <b>${pcEscape(pcCurrentRole(state))}</b></span>
    </div>
    <div class="pc-v931-trophy-strip">
      <div class="pc-v931-trophy-card major">${pcVectorIcon('leagueTrophy')}<span><small>Títulos</small><strong>${pcFormatNumber(palmares.total)}</strong><em>Palmarés de equipo</em></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('leagueTrophy')}<span><small>Ligas</small><strong>${pcFormatNumber(palmares.league)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('cupTrophy')}<span><small>Copas</small><strong>${pcFormatNumber(totalCups)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('individualTrophy')}<span><small>Distinciones</small><strong>${pcFormatNumber(palmares.individualTotal)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('worldBoot')}<span><small>Bota mundial</small><strong>${pcFormatNumber(awards.worldPlayer)}</strong></span></div>
    </div>
    <div class="pc-v931-awards-summary">
      <span>${pcVectorIcon('star')} Figuras del partido <b>${pcFormatNumber(awards.manOfMatch)}</b></span>
      <span>${pcVectorIcon('individualTrophy')} Mejor liga/copa <b>${pcFormatNumber(awards.leaguePlayer + awards.cupPlayer)}</b></span>
    </div>
  </div>`;
};

pcV930CareerTableMarkup = function(state){
  const rows = pcV930CareerRows(state);
  return `<section class="pc-v930-career-list">
    <div class="pc-v930-list-head">
      <span>Edad</span><span>Club</span><span>Media</span><span>PJ</span><span>${pcVectorIcon('football')}</span><span>${pcVectorIcon('trend')}</span>
    </div>
    <div class="pc-v930-list-rows">
      ${rows.length ? rows.map(row => `<article class="${pcV930ClubTone(row.club?.id)} ${row.current?'is-current':''} ${row.choosing?'is-choosing':''}">
        <strong class="pc-v930-age">${pcFormatNumber(row.age)}</strong>
        <div class="pc-v930-row-club">${row.choosing?'<span class="pc-v930-question">?</span>':pcClubBadge(row.club)}<b>${pcEscape(row.club?.name || 'Club')}</b>${row.titles?`<small>${pcVectorIcon('star')} ${row.titles}</small>`:''}</div>
        <strong class="pc-v930-row-overall">${Math.round(row.overall || 0)}</strong>
        <span>${pcFormatNumber(row.stats.matches)}</span>
        <span>${pcFormatNumber(row.stats.goals)}</span>
        <span>${pcFormatNumber(row.stats.assists)}</span>
      </article>`).join('') : '<p class="muted">La carrera todavía no comenzó.</p>'}
    </div>
    <footer>${pcEscape(state.player.nationality)}<span>${pcFormatNumber(rows.length)} temporada${rows.length===1?'':'s'}</span></footer>
  </section>`;
};

function pcV932ArchiveRowMarkup(item,index){
  const individual = pcV931IndividualAwardTotal(item.awards);
  return `<article class="pc-v932-archive-row">
    <span class="pc-v932-archive-rank">${index+1}</span>
    <div class="pc-v932-archive-player"><strong>${pcEscape(item.name)}</strong><small>${pcEscape(item.nationality)} · ${pcEscape(item.position)} · Retiro ${pcFormatNumber(item.retiredAge)} años</small></div>
    <div><small>Media máx.</small><strong>${Math.round(item.maxOverall)}</strong></div>
    <div><small>PJ</small><strong>${pcFormatNumber(item.stats.matches)}</strong></div>
    <div><small>G</small><strong>${pcFormatNumber(item.stats.goals)}</strong></div>
    <div><small>A</small><strong>${pcFormatNumber(item.stats.assists)}</strong></div>
    <div><small>Títulos</small><strong>${pcFormatNumber(item.titles.total)}</strong></div>
    <div><small>Distinciones</small><strong>${pcFormatNumber(individual)}</strong></div>
    <div class="pc-v932-archive-club">${pcClubBadge(item.lastClub)}<span><small>Último club</small><strong>${pcEscape(item.lastClub?.name || '—')}</strong></span></div>
  </article>`;
}

function pcV932ArchiveMarkup(){
  const archive = pcV932ArchiveStore();
  if(!archive.length) return '';
  return `<section class="pc-v932-career-archive">
    <div class="pc-v932-section-head"><div><small>Archivo de carreras</small><h3>Últimos jugadores retirados</h3></div><span>${archive.length}/20</span></div>
    <div class="pc-v932-archive-list">${archive.map(pcV932ArchiveRowMarkup).join('')}</div>
  </section>`;
}

function pcV932PersistArchiveIfNeeded(state){
  if(state?.status !== 'retired') return;
  if(pcV932ArchiveRetiredCareer(state) && typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>undefined);
}

renderPlayerCareer = function(){
  if(!game){
    view.innerHTML = '<div class="card blocker"><h2>Ser jugador</h2><p>Primero cargá o creá una carrera de mánager.</p></div>';
    return;
  }
  let state = pcCareerState();
  if(!state){
    view.innerHTML = `<div class="player-career-shell player-career-v932-empty">${pcCreationView()}${pcV932ArchiveMarkup()}</div>`;
    return;
  }
  state = pcSetCareerState(state);
  pcV932PersistArchiveIfNeeded(state);
  if(state.status === 'active' && Number(state.season?.stage || 0) === 5){
    pcV930EnsureMarketDecision(state);
    state = pcSetCareerState(state);
  }
  view.innerHTML = `<div class="player-career-shell player-career-v930 player-career-v931 player-career-v932">
    <div class="pc-v930-board">
      <main class="pc-v930-left">
        ${pcV930IdentityMarkup(state)}
        ${pcV932IndividualTrophiesMarkup(state)}
        ${pcV930RetiredMarkup(state)}
        ${state.status==='active' ? (Number(state.season?.stage || 0)===5 ? pcV930MarketMarkup(state) : pcV930AdvanceMarkup(state)) : ''}
        ${pcV930ResultMarkup(state)}
      </main>
      <aside class="pc-v930-right">${pcV930CareerTableMarkup(state)}</aside>
    </div>
    ${pcV932ArchiveMarkup()}
    <div class="pc-v930-footer-actions">
      <span>Ser jugador · carrera independiente de la gestión principal</span>
      <div>${state.status==='active'&&Number(state.player.age||0)>=33?'<button type="button" class="ghost" data-pc-action="retire">Retirarse</button>':''}<button type="button" class="ghost danger" data-pc-action="reset">${state.status==='retired'?'Nueva carrera':'Reiniciar'}</button></div>
    </div>
  </div>`;
  pcAnimateStatChanges(state);
};

if(typeof normalizeGame === 'function'){
  const pcV932NormalizeGameBase = normalizeGame;
  normalizeGame = function(saved){
    const normalized = pcV932NormalizeGameBase(saved);
    if(normalized){
      normalized.miniGames = normalized.miniGames && typeof normalized.miniGames === 'object' ? normalized.miniGames : {};
      normalized.miniGames.playerCareerArchive = pcV932NormalizeArchive(normalized.miniGames.playerCareerArchive);
    }
    return normalized;
  };
}
