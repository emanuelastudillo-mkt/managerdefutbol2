/* V3.04 · Academia, captación, juveniles, empleados y tratamientos. */

function createInitialAcademyState(){
  return { players:[], scoutingJobs:[], unlockedStats:{}, trainingPlan:{}, youthPreparer:null, lastConsultTurn:null, lastArrivalTurn:null };
}
function normalizeAcademyState(state){
  const base = createInitialAcademyState();
  const clean = { ...base, ...(state || {}) };
  clean.players = Array.isArray(clean.players) ? clean.players.map(normalizeAcademyPlayer).filter(Boolean) : [];
  clean.scoutingJobs = Array.isArray(clean.scoutingJobs) ? clean.scoutingJobs : [];
  clean.unlockedStats = clean.unlockedStats && typeof clean.unlockedStats === 'object' ? clean.unlockedStats : {};
  clean.trainingPlan = clean.trainingPlan && typeof clean.trainingPlan === 'object' ? clean.trainingPlan : {};
  clean.youthPreparer = clean.youthPreparer || null;
  return clean;
}
function resetAcademySeasonState(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  if(game.academy.youthPreparer){ game.academy.youthPreparer.active = false; }
  game.academy.lastConsultTurn = null;
}
function normalizeAcademyPlayer(player){
  if(!player) return null;
  const group = normalizeAcademyGroup(player.group || player.role || player.positionGroup);
  const age = clamp(Math.round(Number(player.age || 12)), 8, 20);
  const overall = clamp(Math.round(Number(player.overall || player.media || 12)), 1, 40);
  const id = Number(player.id || nextAcademyPlayerId());
  const skills = player.skills && typeof player.skills === 'object' ? { ...player.skills } : academySkillsFor(group, overall, id);
  skills.resistencia = clamp(Math.round(Number(skills.resistencia || (1 + hashNumber(`academy-res-${id}`, 9)))), 1, 99);
  return {
    ...player,
    id,
    name:player.name || academyName(id),
    nationality:player.nationality || academyNationality(id),
    age,
    group,
    overall,
    skills,
    status:player.status || 'academy'
  };
}
function normalizeAcademyGroup(group){
  const raw = String(group || '').toUpperCase();
  if(['POR','ARQ'].includes(raw)) return 'POR';
  if(['DEF','DFC','LD','LI'].includes(raw)) return 'DEF';
  if(['MED','MID','MC','MCD','MCO','MI','MD'].includes(raw)) return 'MED';
  return 'DEL';
}
function academyGroupLabel(group){ return ({ POR:'POR', DEF:'DEF', MED:'MED', DEL:'DEL' })[normalizeAcademyGroup(group)] || 'MED'; }
function academyRepresentativePosition(group){
  const g = normalizeAcademyGroup(group);
  if(g === 'POR') return 'POR';
  if(g === 'DEF') return 'DFC';
  if(g === 'MED') return 'MC';
  return 'DC';
}
function academyExactPositions(group){
  const g = normalizeAcademyGroup(group);
  if(g === 'POR') return ['POR'];
  if(g === 'DEF') return ['DFC','LI','LD'];
  if(g === 'MED') return ['MC','MCO','MD','MI','MCD'];
  return ['DC','EI','ED'];
}
function academyActivePlayers(){
  game.academy = normalizeAcademyState(game.academy);
  return game.academy.players.filter(p => p.status === 'academy');
}
function nextAcademyPlayerId(){
  const ids = [0]
    .concat((seed?.players || []).map(p => Number(p.id) || 0))
    .concat((game?.marketPlayers || []).map(p => Number(p.id) || 0))
    .concat((game?.academy?.players || []).map(p => Number(p.id) || 0));
  return Math.max(...ids) + 1;
}
function academyNationality(id){
  return pickNationalityForGeneration(id, `academy-${game?.seasonNumber || 1}`, null) || 'Argentina';
}
const ACADEMY_FIRST_NAMES = ['Bruno','Mateo','Thiago','Lautaro','Benjamín','Julián','Santino','Tomás','Bautista','Franco','Facundo','Gael','Ignacio','Valentín','Ramiro','Nicolás','Agustín','Ezequiel','Simón','Máximo'];
const ACADEMY_LAST_NAMES = ['Luna','Rojas','Pereyra','Acosta','Sosa','Coronel','Vera','Molina','Cabrera','Medina','Campos','Suárez','Giménez','Arias','Silva','Farias','Roldán','Castro','Ferreyra','Benítez'];
function academyName(id){
  const first = ACADEMY_FIRST_NAMES[hashNumber(`academy-name-${id}`, ACADEMY_FIRST_NAMES.length)];
  const last = ACADEMY_LAST_NAMES[hashNumber(`academy-last-${id}`, ACADEMY_LAST_NAMES.length)];
  return `${first} ${last}`;
}
function academyOverallRoll(id){
  const roll = hashNumber(`academy-overall-band-${game?.seasonNumber || 1}-${id}-${Math.random()}`, 1000) / 1000;
  if(roll < 0.80) return 1 + hashNumber(`academy-overall-low-${id}-${Math.random()}`, 19);
  if(roll < 0.90) return 20 + hashNumber(`academy-overall-mid-${id}-${Math.random()}`, 11);
  return 30 + hashNumber(`academy-overall-high-${id}-${Math.random()}`, 11);
}
function academyGroupRoll(id){
  const roll = hashNumber(`academy-group-${game?.seasonNumber || 1}-${id}-${Math.random()}`, 100);
  if(roll < 10) return 'POR';
  if(roll < 40) return 'DEF';
  if(roll < 70) return 'MED';
  return 'DEL';
}
function academySkillsFor(group, overall, id){
  const mapped = normalizeAcademyGroup(group) === 'MED' ? 'MID' : normalizeAcademyGroup(group) === 'DEL' ? 'ATT' : normalizeAcademyGroup(group);
  const skills = skillsForGroup(mapped, clamp(Number(overall || 10), 1, 40), id);
  skills.resistencia = 1 + hashNumber(`academy-res-init-${id}`, 9);
  return skills;
}
function academyTempPlayer(player){
  return { id:player.id, name:player.name, age:player.age, nationality:player.nationality, position:academyRepresentativePosition(player.group), overall:player.overall, skills:player.skills || academySkillsFor(player.group, player.overall, player.id) };
}
function academyVisibleStats(player){ return visibleStats(academyTempPlayer(player), rawVisibleSkill); }
function academyProjectedOverall(player){ return rawVisibleOverall(academyTempPlayer(player)); }
function startAcademyScouting(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  if((game.budget || 0) < ACADEMY_SCOUTING_COST){ showNotice('Presupuesto insuficiente para hacer una captación.'); return; }
  recordBudgetChange(-ACADEMY_SCOUTING_COST, 'Captación de talentos', { type:'academy_scouting_start' });
  const count = ACADEMY_PLAYERS_MIN + Math.floor(Math.random() * (ACADEMY_PLAYERS_MAX - ACADEMY_PLAYERS_MIN + 1));
  const job = { id:`cap-${Date.now()}-${Math.round(Math.random()*9999)}`, startedTurn:currentTurnIndex(), dueTurn:currentTurnIndex() + ACADEMY_SCOUTING_TURNS, count, status:'pending' };
  game.academy.scoutingJobs.push(job);
  saveLocal(true);
  renderAcademy();
  showNotice('Captación iniciada. El informe llegará en algunos turnos.');
}
function createAcademyBatch(count){
  const players = [];
  let id = nextAcademyPlayerId();
  for(let i=0;i<count;i++, id++){
    const group = academyGroupRoll(id);
    const overall = academyOverallRoll(id);
    const age = 8 + hashNumber(`academy-age-${game?.seasonNumber || 1}-${id}-${Math.random()}`, 7);
    players.push(normalizeAcademyPlayer({
      id,
      name:academyName(id),
      nationality:academyNationality(id),
      age,
      group,
      overall,
      skills:academySkillsFor(group, overall, id),
      status:'academy',
      joinedSeason:game?.seasonNumber || 1,
      joinedTurn:currentTurnIndex()
    }));
  }
  return players;
}
function processAcademyScoutingArrivals(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  let added = 0;
  game.academy.scoutingJobs.forEach(job => {
    if(job.status !== 'pending') return;
    if(Number(job.dueTurn || 0) > currentTurnIndex()) return;
    const batch = createAcademyBatch(clamp(Number(job.count || 0), ACADEMY_PLAYERS_MIN, ACADEMY_PLAYERS_MAX));
    game.academy.players.push(...batch);
    job.status = 'completed';
    job.completedTurn = currentTurnIndex();
    added += batch.length;
  });
  if(added > 0){
    game.academy.lastArrivalTurn = currentTurnIndex();
    pushGameMessage({ type:'academia', title:'Informe de captación recibido', body:`La academia recibió ${added} juveniles para evaluar.`, priority:'normal' });
  }
  return added;
}
function academyTurnSalaryCost(){
  const count = academyActivePlayers().length;
  if(!count) return 0;
  const total = count * ACADEMY_PLAYER_TURN_COST;
  recordBudgetChange(-total, 'Sueldos de academia', { type:'academy_turn_salary', players:count });
  return total;
}
function academyTrainingType(playerId){
  return game?.academy?.trainingPlan?.[playerId] === 'resistance' ? 'resistance' : 'technical';
}
function applyAcademyTrainingEffects(){
  if(!game?.academy) return;
  academyActivePlayers().forEach(player => {
    player.skills = player.skills || academySkillsFor(player.group, player.overall, player.id);
    const type = academyTrainingType(player.id);
    if(type === 'resistance'){
      player.skills.resistencia = clamp(Math.round(Number(player.skills.resistencia || 1) + rnd(3,6)), 1, 99);
    } else {
      const skillNames = Object.keys(player.skills).filter(k => k !== 'porteria' || player.group === 'POR');
      for(let i=0;i<ACADEMY_SKILL_GAIN_MULTIPLIER;i++){
        const skill = skillNames[hashNumber(`academy-train-${player.id}-${currentTurnIndex()}-${i}-${Math.random()}`, skillNames.length)];
        player.skills[skill] = clamp(Math.round(Number(player.skills[skill] || 1) + 1), 1, 99);
      }
    }
    player.overall = clamp(academyProjectedOverall(player), 1, 60);
  });
}
function processAcademyTurn(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  academyTurnSalaryCost();
  applyAcademyTrainingEffects();
  const added = processAcademyScoutingArrivals();
  if(activeTab === 'academy' && added > 0) renderAcademy();
}
function academyYouthPreparerActive(){
  return Boolean(game?.academy?.youthPreparer?.active && Number(game.academy.youthPreparer.season || 0) === Number(game.seasonNumber || 1));
}
function hireYouthPreparer(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  if(academyYouthPreparerActive()){ showNotice('El preparador de juveniles ya está contratado esta temporada.'); return; }
  if((game.budget || 0) < YOUTH_PREPARER_COST){ showNotice('Presupuesto insuficiente para contratar al preparador de juveniles.'); return; }
  recordBudgetChange(-YOUTH_PREPARER_COST, 'Preparador de juveniles', { type:'academy_youth_preparer' });
  game.academy.youthPreparer = { active:true, season:game.seasonNumber || 1, hiredTurn:currentTurnIndex() };
  saveLocal(true);
  renderAcademy();
  showNotice('Preparador de juveniles contratado por esta temporada.');
}
function academyLockedStatTargets(){
  const targets = [];
  academyActivePlayers().forEach(player => {
    const stats = Object.keys(academyVisibleStats(player));
    const unlocked = new Set(game.academy.unlockedStats[player.id] || []);
    stats.forEach(stat => { if(!unlocked.has(stat)) targets.push({ playerId:player.id, stat }); });
  });
  return targets;
}
function consultAcademyPlayers(){
  if(!academyYouthPreparerActive()){ showNotice('Necesitás contratar al preparador de juveniles para consultar informes.'); return; }
  const turn = currentTurnIndex();
  if(Number(game.academy.lastConsultTurn) === turn){ showNotice('El preparador ya entregó un informe en este turno.'); return; }
  const targets = academyLockedStatTargets();
  if(!targets.length){ showNotice('No quedan habilidades ocultas por desbloquear en la academia.'); return; }
  const amount = Math.min(targets.length, 1 + Math.floor(Math.random() * 2));
  const revealed = [];
  for(let i=0;i<amount;i++){
    const remaining = academyLockedStatTargets();
    if(!remaining.length) break;
    const pick = remaining[hashNumber(`academy-consult-${turn}-${i}-${Math.random()}`, remaining.length)];
    game.academy.unlockedStats[pick.playerId] = game.academy.unlockedStats[pick.playerId] || [];
    if(!game.academy.unlockedStats[pick.playerId].includes(pick.stat)) game.academy.unlockedStats[pick.playerId].push(pick.stat);
    const p = game.academy.players.find(x => Number(x.id) === Number(pick.playerId));
    revealed.push(`${p?.name || 'Juvenil'}: ${pick.stat}`);
  }
  game.academy.lastConsultTurn = turn;
  saveLocal(true);
  renderAcademy();
  showNotice(`Informe recibido: ${revealed.join(' · ')}`);
}
function dismissAcademyPlayer(playerId){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const player = game.academy.players.find(p => Number(p.id) === Number(playerId) && p.status === 'academy');
  if(!player) return;
  if((game.budget || 0) < ACADEMY_DISMISS_COMPENSATION){ showNotice('Presupuesto insuficiente para pagar la compensación.'); return; }
  if(!confirm(`Despedir a ${player.name} de la academia?`)) return;
  recordBudgetChange(-ACADEMY_DISMISS_COMPENSATION, 'Compensación por baja de academia', { type:'academy_dismiss', playerId });
  player.status = 'dismissed';
  player.dismissedTurn = currentTurnIndex();
  saveLocal(true);
  renderAcademy();
  showNotice(`${player.name} fue dado de baja de la academia.`);
}
function openPromoteAcademyModal(playerId){
  const player = academyActivePlayers().find(p => Number(p.id) === Number(playerId));
  if(!player) return;
  if(Number(player.age || 0) < 16){ showNotice('El juvenil todavía no tiene edad para firmar contrato profesional.'); return; }
  const options = academyExactPositions(player.group).map(pos => `<option value="${pos}">${pos} · ${escapeHtml(roleMeta(pos).name)}</option>`).join('');
  openModal(`<div class="purchase-offer-modal"><h2>Contrato profesional</h2><p class="muted">Fijá la posición definitiva de ${escapeHtml(player.name)} antes de subirlo al primer equipo.</p><label for="academyPromotePosition">Posición</label><select id="academyPromotePosition">${options}</select><div class="row" style="margin-top:14px"><button class="primary" id="btnConfirmPromoteAcademy">Subir al primer equipo</button></div></div>`);
  $('btnConfirmPromoteAcademy')?.addEventListener('click', () => promoteAcademyPlayer(playerId, $('academyPromotePosition')?.value));
}
function promoteAcademyPlayer(playerId, exactPosition){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const player = game.academy.players.find(p => Number(p.id) === Number(playerId) && p.status === 'academy');
  if(!player) return;
  if(Number(player.age || 0) < 16){ showNotice('El juvenil todavía no tiene edad para firmar contrato profesional.'); return; }
  if(!hasFirstTeamRosterSpace(game.selectedClubId, 1)){ showRosterLimitNotice(); return; }
  const allowed = academyExactPositions(player.group);
  const position = allowed.includes(exactPosition) ? exactPosition : allowed[0];
  const official = {
    id:player.id,
    name:player.name,
    age:player.age,
    nationality:player.nationality,
    position,
    clubId:game.selectedClubId,
    overall:clamp(academyProjectedOverall(player), 1, 99),
    skills:{ ...(player.skills || academySkillsFor(player.group, player.overall, player.id)) },
    freeAgent:false,
    academyOrigin:true,
    joinedClubSeason:game.seasonNumber || 1,
    salaryPaidCount:0,
    lastSalaryPaidSeason:0
  };
  official.salary = initialAnnualSalaryForMedia(official.overall, 0.40);
  refreshPlayerClause(official);
  seed.players = (seed.players || []).filter(p => Number(p.id) !== Number(official.id));
  seed.players.push(official);
  game.playerCondition[official.id] = 70;
  game.playerMorale[official.id] = PLAYER_MORALE_START;
  game.playerSkillBoosts[official.id] = {};
  game.trainingPlan[official.id] = DEFAULT_TRAINING_TYPE;
  game.playerStats[official.id] = { playerId:official.id, clubId:official.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0 };
  player.status = 'promoted';
  player.promotedTurn = currentTurnIndex();
  player.promotedPosition = position;
  pushGameMessage({ type:'academia', title:'Juvenil promovido', body:`${official.name} firmó contrato profesional como ${position}.`, priority:'normal' });
  closeModal();
  saveLocal(true);
  renderAll();
  showNotice(`${official.name} ya está en el primer equipo.`);
}
function applyAcademyAgingIfNeeded(){
  if(!game?.academy) return 0;
  const season = Number(game.seasonNumber || 1);
  if(season % 2 !== 0) return 0;
  let count = 0;
  game.academy.players.forEach(player => {
    if(player.status !== 'academy') return;
    player.age = Math.max(8, Number(player.age || 12) + 1);
    count += 1;
  });
  return count;
}
function academyPendingJobsMarkup(){
  const jobs = (game.academy?.scoutingJobs || []).filter(j => j.status === 'pending');
  if(!jobs.length) return '<p class="muted">No hay captaciones en curso.</p>';
  return `<div class="academy-jobs">${jobs.map(job => `<div class="stat-rank"><span>Captación en curso</span><strong>${Math.max(0, Number(job.dueTurn || 0) - currentTurnIndex())} turno(s)</strong></div>`).join('')}</div>`;
}
function academyPlayerStatsMarkup(player){
  const stats = academyVisibleStats(player);
  const unlocked = new Set(game.academy?.unlockedStats?.[player.id] || []);
  return `<div class="academy-hidden-stats">${Object.entries(stats).map(([label,value]) => `<div class="stat-rank"><span>${escapeHtml(label)}</span><strong>${unlocked.has(label) ? value : '—'}</strong></div>`).join('')}</div>`;
}
function academyPlayerCard(player){
  const training = academyTrainingType(player.id);
  const canPromote = Number(player.age || 0) >= 16;
  return `<div class="card academy-player-card">
    <div class="row academy-player-head"><div><p class="label">${academyGroupLabel(player.group)} · ${Number(player.age || 0)} años · ${nationalityShortMarkup(player.nationality)}</p><h3>${escapeHtml(player.name)}</h3></div><span class="pill">Media oculta</span></div>
    ${academyPlayerStatsMarkup(player)}
    <div class="row academy-actions">
      <select data-academy-training="${player.id}"><option value="technical" ${training==='technical'?'selected':''}>Técnica</option><option value="resistance" ${training==='resistance'?'selected':''}>Resistencia</option></select>
      <button class="ghost small-btn" data-dismiss-academy="${player.id}">Despedir</button>
      <button class="primary small-btn" data-promote-academy="${player.id}" ${canPromote ? '' : 'disabled'}>${canPromote ? 'Contrato profesional' : 'Menor de 16'}</button>
    </div>
  </div>`;
}
function renderAcademy(){
  game.academy = normalizeAcademyState(game.academy);
  const active = academyActivePlayers();
  const activePreparer = academyYouthPreparerActive();
  const salaryTurn = active.length * ACADEMY_PLAYER_TURN_COST;
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Academia</h2><p class="tagline">Captación, seguimiento y entrenamiento de juveniles antes de firmar contrato profesional.</p></div>
      <div class="pill">Costo por turno: ${formatMoney(salaryTurn)}</div>
    </div>
    <div class="grid cols-3 academy-summary">
      <div class="card"><p class="label">Juveniles</p><div class="metric">${active.length}</div><p class="small muted">Stats ocultas hasta consultar informes.</p></div>
      <div class="card"><p class="label">Captación</p><div class="metric small">${formatMoney(ACADEMY_SCOUTING_COST)}</div><button class="primary" id="btnAcademyScouting">Hacer captación de talentos</button></div>
      <div class="card"><p class="label">Preparador de juveniles</p><div class="metric small">${formatMoney(YOUTH_PREPARER_COST)}</div>${activePreparer ? '<span class="pill ok">Contratado</span>' : '<button class="primary" id="btnHireYouthPreparer">Contratar</button>'}<button class="ghost" id="btnConsultAcademy" ${activePreparer ? '' : 'disabled'}>Consultar juveniles</button></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Captaciones pendientes</h3>${academyPendingJobsMarkup()}</div>
    <div class="card academy-rules-card" style="margin-top:14px"><p class="muted">Cada captación tarda 5 turnos y puede sumar entre 5 y 10 juveniles. Los juveniles cobran ${formatMoney(ACADEMY_PLAYER_TURN_COST)} por turno. Despedir uno cuesta ${formatMoney(ACADEMY_DISMISS_COMPENSATION)}.</p></div>
    <div class="academy-grid" style="margin-top:14px">${active.length ? active.map(academyPlayerCard).join('') : '<div class="card"><p class="muted">Todavía no hay juveniles en la academia.</p></div>'}</div>
  `;
  $('btnAcademyScouting')?.addEventListener('click', startAcademyScouting);
  $('btnHireYouthPreparer')?.addEventListener('click', hireYouthPreparer);
  $('btnConsultAcademy')?.addEventListener('click', consultAcademyPlayers);
  document.querySelectorAll('[data-dismiss-academy]').forEach(btn => btn.addEventListener('click', () => dismissAcademyPlayer(Number(btn.dataset.dismissAcademy))));
  document.querySelectorAll('[data-promote-academy]').forEach(btn => btn.addEventListener('click', () => openPromoteAcademyModal(Number(btn.dataset.promoteAcademy))));
  document.querySelectorAll('[data-academy-training]').forEach(select => select.addEventListener('change', () => {
    game.academy.trainingPlan[select.dataset.academyTraining] = select.value === 'resistance' ? 'resistance' : 'technical';
    saveLocal(true);
    showNotice('Entrenamiento juvenil actualizado.');
  }));
}

function renderEmployees(){
  const last = game.staffActions?.motivationalTalk || null;
  const cooldownLeft = turnCooldownLeft(last, PSYCHOLOGIST_COOLDOWN_TURNS);
  const canCallPsychologist = cooldownLeft <= 0 && (game.budget || 0) >= PSYCHOLOGIST_COST;
  const cooldownText = cooldownLeft > 0 ? `<p class="small warn">Disponible nuevamente en ${cooldownLeft} turno(s).</p>` : '';
  const kinesio = game.staffActions?.kinesiologist || null;
  const kinesioActive = Boolean(kinesio?.active);
  const injuredList = injuredPlayersByClub(game.selectedClubId);
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Empleados</h2>
        <p class="tagline">Acciones de apoyo para el plantel. La moral es visible; los valores exactos de mejora no se muestran.</p>
      </div>
      <div class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</div>
    </div>
    <div class="grid cols-2">
      <div class="card staff-card">
        <h3>Psicólogo motivacional</h3>
        <p class="muted">Convoca una charla para intentar mejorar la moral del plantel.</p>
        <p class="label">Costo</p>
        <div class="metric small">${formatMoney(PSYCHOLOGIST_COST)}</div>
        ${cooldownText}
        <button id="btnMotivationalTalk" class="primary" ${canCallPsychologist ? '' : 'disabled'}>Llamar al psicólogo motivacional</button>
      </div>
      <div class="card staff-card">
        <h3>Estado del plantel</h3>
        <div class="stat-rank"><span>Moral media</span><strong>${squadMoraleAverage(game.selectedClubId)}/99</strong></div>
        <div class="profile-bar-wrap">${moraleTeamBar(game.selectedClubId)}</div>
        ${last ? `<div class="staff-result ${last.success ? 'ok-result' : 'bad-result'}"><div class="project-progress completed"><span style="width:100%"></span></div><strong>${escapeHtml(last.message)}</strong></div>` : '<p class="muted">Sin acciones recientes.</p>'}
      </div>
      <div class="card staff-card">
        <h3>Kinesiólogo</h3>
        <p class="muted">Contratación por temporada completa. Permite tratar lesionados una vez por turno para intentar reducir 1 turno de lesión.</p>
        <p class="label">Costo</p>
        <div class="metric small">${formatMoney(KINESIOLOGIST_COST)}</div>
        ${kinesioActive ? '<span class="pill ok">Contratado</span>' : `<button id="btnHireKinesiologist" class="primary" ${(game.budget || 0) >= KINESIOLOGIST_COST ? '' : 'disabled'}>Contratar kinesiólogo</button>`}
      </div>
      <div class="card staff-card">
        <h3>Tratamientos</h3>
        ${kinesioActive ? injuredTreatmentList(injuredList) : '<p class="muted">Contratá al kinesiólogo para habilitar tratamientos sobre jugadores lesionados.</p>'}
      </div>
    </div>
  `;
  $('btnMotivationalTalk')?.addEventListener('click', (event) => callMotivationalPsychologist(event.currentTarget));
  $('btnHireKinesiologist')?.addEventListener('click', hireKinesiologist);
  document.querySelectorAll('[data-kinesio-treat]').forEach(btn => {
    btn.addEventListener('click', () => treatInjuredPlayer(Number(btn.dataset.kinesioTreat), btn));
  });
}
function injuredTreatmentList(injuredList){
  if(!injuredList.length) return '<p class="muted">No hay jugadores lesionados para tratar.</p>';
  return `<div class="injured-treatment-list">${injuredList.map(item => {
    const treated = wasKinesioTreatedThisTurn(item.player.id);
    return `<div class="injured-treatment-row">
      ${faceImg(item.player, 'injured-home-face')}
      <div><button class="linklike" data-player-id="${item.player.id}">${availabilityIcons(item.player.id)}${escapeHtml(item.player.name)}</button><span>${escapeHtml(item.status.injuryLabel || 'Lesión')} · ${item.remaining} turno(s)</span></div>
      <button class="ghost" data-kinesio-treat="${item.player.id}" ${treated ? 'disabled' : ''}>${treated ? 'Tratado este turno' : 'Tratar'}</button>
    </div>`;
  }).join('')}</div>`;
}
function wasKinesioTreatedThisTurn(playerId){
  const key = `${currentTurnIndex()}:${playerId}`;
  return Boolean(game.staffActions?.kinesiologyTreatments?.[key]);
}
function hireKinesiologist(){
  if(!game) return;
  if(game.staffActions?.kinesiologist?.active){ showNotice('El kinesiólogo ya está contratado.'); return; }
  if((game.budget || 0) < KINESIOLOGIST_COST){ showNotice('Presupuesto insuficiente para contratar al kinesiólogo.'); return; }
  recordBudgetChange(-KINESIOLOGIST_COST, 'Contratación de kinesiólogo', { type:'staff_kinesiologist' });
  game.staffActions = game.staffActions || {};
  game.staffActions.kinesiologist = { active:true, ...turnStamp() };
  saveLocal(true);
  showNotice('Kinesiólogo contratado por la temporada completa.');
  renderEmployees();
}
function treatInjuredPlayer(playerId, button=null){
  const performTreatment = () => {
    if(!game?.staffActions?.kinesiologist?.active){ return { success:false, message:'Primero tenés que contratar al kinesiólogo.' }; }
    if(!isInjured(playerId)){ return { success:false, message:'El jugador no está lesionado.', after:renderEmployees }; }
    game.staffActions.kinesiologyTreatments = game.staffActions.kinesiologyTreatments || {};
    const key = `${currentTurnIndex()}:${playerId}`;
    if(game.staffActions.kinesiologyTreatments[key]){ return { success:false, message:'Este jugador ya recibió tratamiento en este turno.' }; }
    const success = Math.random() >= KINESIOLOGIST_FAILURE_CHANCE;
    game.staffActions.kinesiologyTreatments[key] = { success, ...turnStamp({ playerId }) };
    if(success){
      const st = playerStatus(playerId);
      const nextThrough = Number(st.injuredThrough) - 1;
      if(nextThrough < game.matchdayIndex){
        const { injuredThrough, injuryLabel, injuryChance, injuredAtMatchday, ...rest } = st;
        game.playerStatus[playerId] = rest;
      } else {
        game.playerStatus[playerId] = { ...st, injuredThrough:nextThrough };
      }
    }
    saveLocal(true);
    return {
      success,
      buttonLabel: success ? 'Tratamiento realizado' : 'Tratamiento fallido',
      message: success ? 'Tratamiento exitoso. La recuperación se acortó 1 turno.' : 'El tratamiento falló. La lesión no se redujo.',
      after:renderEmployees
    };
  };
  return runActionFeedback(button, performTreatment, {
    loadingLabel:'Tratando...',
    successLabel:'Tratamiento realizado',
    failureLabel:'Tratamiento fallido'
  });
}
function moraleTeamBar(clubId){
  const value = squadMoraleAverage(clubId);
  const cls = value < 40 ? 'low' : value < 70 ? 'mid' : 'high';
  return `<div class="morale-bar ${cls} team-morale-bar" title="Moral media ${value}/99"><span style="width:${clamp(value,1,99)}%"></span><em>${value}/99</em></div>`;
}
function callMotivationalPsychologist(button=null){
  const performTalk = () => {
    if(!game) return { success:false, message:'No hay partida activa.' };
    const last = game.staffActions?.motivationalTalk || null;
    const cooldownLeft = turnCooldownLeft(last, PSYCHOLOGIST_COOLDOWN_TURNS);
    if(cooldownLeft > 0){ return { success:false, message:`La charla motivacional estará disponible en ${cooldownLeft} turno(s).` }; }
    if((game.budget || 0) < PSYCHOLOGIST_COST){ return { success:false, message:'Presupuesto insuficiente para llamar al psicólogo motivacional.' }; }
    recordBudgetChange(-PSYCHOLOGIST_COST, 'Psicólogo motivacional', { type:'staff_psychologist' });
    const success = Math.random() < PSYCHOLOGIST_SUCCESS_CHANCE;
    if(success){
      playersByClub(game.selectedClubId).forEach(player => {
        game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) + rnd(18,25)), 1, 99);
      });
    }
    game.staffActions = game.staffActions || {};
    game.staffActions.motivationalTalk = {
      success,
      ...turnStamp(),
      message: success ? 'La charla motivacional fue un éxito' : 'La charla motivacional fue un fracaso'
    };
    saveLocal(true);
    return {
      success,
      buttonLabel: success ? 'Charla exitosa' : 'Charla fallida',
      message: game.staffActions.motivationalTalk.message,
      after:renderEmployees
    };
  };
  return runActionFeedback(button, performTalk, {
    loadingLabel:'Convocando charla...',
    successLabel:'Charla exitosa',
    failureLabel:'Charla fallida'
  });
}


function getTacticForClub(clubId){
  if(clubId === game.selectedClubId) return game.tactic;
  const club = seed.clubs.find(c=>c.id===clubId);
  const formation = club.reputation > 74 ? '4-3-3' : club.reputation < 61 ? '5-4-1' : '4-4-2';
  return { formation, defense:'posicional', midfield:'posicional', attack:'posicional' };
}
