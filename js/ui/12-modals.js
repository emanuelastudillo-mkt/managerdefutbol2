/* V3.08 · Modales de jugador, club, compra, partido, scouting y nueva partida. */

function purchaseOfferRejectionRecord(playerId){
  if(!game) return null;
  const rejected = game.rejectedPurchaseOffers || {};
  return rejected[String(playerId)] || null;
}
function isPurchaseOfferBlockedThisSeason(playerId){
  const record = purchaseOfferRejectionRecord(playerId);
  return Boolean(record && Number(record.season || 0) === Number(game?.seasonNumber || 1));
}
function markPurchaseOfferRejected(playerId, kind, amount){
  if(!game) return;
  game.rejectedPurchaseOffers = (game.rejectedPurchaseOffers && typeof game.rejectedPurchaseOffers === 'object' && !Array.isArray(game.rejectedPurchaseOffers)) ? game.rejectedPurchaseOffers : {};
  game.rejectedPurchaseOffers[String(playerId)] = {
    playerId:Number(playerId),
    season:Number(game.seasonNumber || 1),
    turn:currentTurnIndex(),
    kind:String(kind || ''),
    amount:Number(amount || 0),
    createdAt:Date.now()
  };
}
function purchaseOfferBlockedLabel(playerId){
  if(!isPurchaseOfferBlockedThisSeason(playerId)) return '';
  return 'Oferta rechazada hasta la próxima temporada';
}


function playerModalActionsMarkup(player){
  const clubId = Number(player.clubId || 0);
  if(clubId === Number(game.selectedClubId)){
    return `<div class="card inner player-action-card"><h3>Acciones</h3><div class="row message-actions"><button class="danger ghost" data-dismiss-player="${player.id}">Despedir</button><button class="primary" data-offer-own-player="${player.id}">Ofrecer a clubes</button></div></div>`;
  }
  if(clubId > 0){
    const blocked = isPurchaseOfferBlockedThisSeason(player.id);
    const label = blocked ? purchaseOfferBlockedLabel(player.id) : 'Hacer oferta';
    return `<div class="card inner player-action-card"><h3>Mercado</h3><div class="row message-actions"><button class="primary" data-make-player-offer="${player.id}" ${blocked ? 'disabled' : ''}>${escapeHtml(label)}</button></div></div>`;
  }
  return '';
}
function bindPlayerModalActions(playerId){
  document.querySelector('[data-dismiss-player]')?.addEventListener('click', () => dismissOwnPlayer(playerId));
  document.querySelector('[data-offer-own-player]')?.addEventListener('click', () => offerOwnPlayerToClubs(playerId));
  document.querySelector('[data-make-player-offer]')?.addEventListener('click', () => openPurchaseOfferModal(playerId));
}
function showPlayerModal(playerId){
  const p = playerById(playerId);
  if(!p) return;
  const visible = visibleStats(p);
  const stats = game?.playerStats?.[p.id];
  const meta = roleMeta(p.position);
  const body = `
    <div class="player-modal-grid">
      <div>
        <div class="player-identity-card">
          ${faceImg(p, 'player-photo-placeholder large')}
          <div>
            <p class="label">${escapeHtml(clubName(p.clubId))} · #${jerseyNumber(p.id)}</p>
            <h2>${escapeHtml(p.name)}</h2>
            <p class="muted">${escapeHtml(p.nationality || 'Sin nacionalidad')} · ${escapeHtml(meta.code)} · ${escapeHtml(meta.name)}</p>
            <p class="muted">${p.age} años · ${availabilityStatusMarkup(p.id)}</p>
          </div>
        </div>
        <div class="radar-wrap">${radarSvg(visible)}</div>
      </div>
      <div class="stack">
        <div class="card inner"><h3>Stats visibles</h3>${statPairs(visible, visibleStats(p, rawVisibleSkill))}</div>
        <div class="card inner"><h3>Perfil</h3>
          <div class="stat-rank"><span>Media</span><strong>${visibleOverall(p)}</strong></div>
          <div class="stat-rank"><span>Estado físico</span><strong>${currentCondition(p.id)}/99</strong></div>
          <div class="stat-rank"><span>Moral</span><strong>${currentMorale(p.id)}/99</strong></div>
          <div class="profile-bar-wrap">${moraleBar(p.id)}</div>
          <div class="stat-rank"><span>Cláusula</span><strong>${formatMoney(p.clause || p.value || 0)}</strong></div>
          <div class="stat-rank"><span>Salario</span><strong>${formatMoney(p.salary || 0)}</strong></div>
        </div>
        <div class="card inner"><h3>Temporada</h3>
          <div class="stat-rank"><span>Partidos</span><strong>${stats?.played || 0}</strong></div>
          <div class="stat-rank"><span>Goles</span><strong>${stats?.goals || 0}</strong></div>
          <div class="stat-rank"><span>Asistencias</span><strong>${stats?.assists || 0}</strong></div>
          <div class="stat-rank"><span>Tarjetas</span><strong><span class="yellow-card">■</span> ${stats?.yellow || 0} / <span class="red-card">■</span> ${stats?.red || 0}</strong></div>
        </div>
        ${playerModalActionsMarkup(p)}
      </div>
    </div>`;
  openModal(body);
  bindPlayerModalActions(playerId);
}


function dismissOwnPlayer(playerId){
  const player = playerById(playerId);
  if(!player || Number(player.clubId) !== Number(game.selectedClubId)) return;
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  if(!confirm(`Despedir a ${player.name} del plantel?`)) return;
  removePlayerFromCurrentTactic(player.id);
  player.clubId = 0;
  player.freeAgent = true;
  player.salaryPaidCount = 0;
  player.lastSalaryPaidSeason = 0;
  refreshPlayerClause(player);
  game.marketPlayers = game.marketPlayers || [];
  const idx = game.marketPlayers.findIndex(p => Number(p.id) === Number(player.id));
  const copy = { ...player, clubId:0, freeAgent:true, sold:false };
  if(idx >= 0) game.marketPlayers[idx] = { ...game.marketPlayers[idx], ...copy };
  else game.marketPlayers.push(copy);
  pushGameMessage({ type:'mercado', title:'Jugador despedido', body:`${player.name} dejó el club y quedó como agente libre.`, priority:'normal' });
  closeModal();
  saveLocal(true);
  renderAll();
  showNotice(`${player.name} fue despedido.`);
}
function offerOwnPlayerToClubs(playerId){
  const player = playerById(playerId);
  if(!player || Number(player.clubId) !== Number(game.selectedClubId)) return;
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  if(!hasPlayerSalaryPaid(player)){
    showNotice('Primero debemos haberle pagado al menos un sueldo.');
    return;
  }
  if(turnCooldownLeft(game.lastOwnPlayerOffer, OWN_PLAYER_OFFER_COOLDOWN_TURNS) > 0){
    showNotice('tu asistente está buscando las mejores opciones llamalo luego');
    return;
  }
  game.lastOwnPlayerOffer = turnStamp({ action:'offerOwnPlayer', playerId:player.id });
  const success = Math.random() < 0.85;
  if(!success){
    pushGameMessage({ type:'mercado', title:`Sin ofertas por ${playerLastName(player.name)}`, body:`Se ofreció a ${player.name}, pero ningún club presentó una propuesta formal.`, priority:'normal' });
    closeModal();
    activeTab = 'messages';
    saveLocal(true);
    renderAll();
    return;
  }
  const pct = 35 + hashNumber(`forced-sale-${player.id}-${Date.now()}`, 41); // 35% a 75% de la cláusula
  const amount = Math.round(refreshPlayerClause(player) * pct / 100);
  const foreignClub = FOREIGN_CLUBS[hashNumber(`forced-foreign-${player.id}-${Date.now()}`, FOREIGN_CLUBS.length)];
  pushGameMessage({
    type:'mercado',
    priority:'high',
    title:`Oferta recibida por ${playerLastName(player.name)}`,
    body:`${foreignClub} acercó una oferta de ${formatMoney(amount)} por ${player.name}. Al haberlo ofrecido activamente, el porcentaje pagado sobre la cláusula es menor.`,
    action:{ type:'transferOffer', status:'pending', playerId:player.id, amount, foreignClub, pct }
  });
  closeModal();
  activeTab = 'messages';
  saveLocal(true);
  renderAll();
  showNotice('Llegó una oferta por el jugador.');
}
function openPurchaseOfferModal(playerId){
  const player = playerById(playerId);
  if(!player || Number(player.clubId || 0) <= 0 || Number(player.clubId) === Number(game.selectedClubId)) return;
  if(isPurchaseOfferBlockedThisSeason(player.id)){
    showNotice('Este club ya rechazó una oferta por este jugador. Podrás volver a intentarlo la próxima temporada.');
    return;
  }
  const clause = refreshPlayerClause(player);
  const body = `<div class="purchase-offer-modal">
    <p class="label">Hacer oferta</p>
    <h2>${escapeHtml(player.name)}</h2>
    <p class="muted">${escapeHtml(clubName(player.clubId))} · ${roleBadge(player.position)} · ${visibleOverall(player)} de media · Cláusula ${formatMoney(clause)}</p>
    <div class="grid cols-3 offer-choice-grid" style="margin-top:14px">
      <button class="card clickable plain" data-submit-player-offer="low"><h3>Ofrecer 50% menos</h3><p>${formatMoney(Math.round(clause * 0.50))}</p></button>
      <button class="card clickable plain" data-submit-player-offer="mid"><h3>Ofrecer 25% menos</h3><p>${formatMoney(Math.round(clause * 0.75))}</p></button>
      <button class="card clickable plain" data-submit-player-offer="clause"><h3>Ofrecer cláusula</h3><p>${formatMoney(clause)}</p></button>
    </div>
  </div>`;
  openModal(body);
  document.querySelectorAll('[data-submit-player-offer]').forEach(btn => btn.addEventListener('click', () => submitPurchaseOffer(playerId, btn.dataset.submitPlayerOffer)));
}
function purchaseOfferConfig(kind, clause){
  if(kind === 'low') return { amount:Math.round(clause * 0.50), chance:0.40, fail:'No nos interesa negociar con ratas' };
  if(kind === 'mid') return { amount:Math.round(clause * 0.75), chance:0.65, fail:'Negociar no es tu fuerte, nos vemos' };
  return { amount:Math.round(clause), chance:0.90, fail:'el jugador no quiere jugar en tu club' };
}
function submitPurchaseOffer(playerId, kind){
  const player = playerById(playerId);
  if(!player || Number(player.clubId || 0) <= 0 || Number(player.clubId) === Number(game.selectedClubId)) return;
  if(!hasFirstTeamRosterSpace(game.selectedClubId, 1)){ showRosterLimitNotice(); return; }
  const clause = refreshPlayerClause(player);
  const cfg = purchaseOfferConfig(kind, clause);
  if((game.budget || 0) < cfg.amount){
    showNotice('Presupuesto insuficiente para realizar esta oferta.');
    return;
  }
  const accepted = Math.random() < cfg.chance;
  if(!accepted){
    markPurchaseOfferRejected(player.id, kind, cfg.amount);
    pushGameMessage({ type:'mercado', title:'Oferta rechazada', body:`${cfg.fail}. No podremos volver a enviar una oferta por este jugador hasta la próxima temporada.`, priority:'normal' });
    closeModal();
    activeTab = 'messages';
    saveLocal(true);
    renderAll();
    return;
  }
  game.pendingTransfers = Array.isArray(game.pendingTransfers) ? game.pendingTransfers : [];
  if(game.pendingTransfers.some(t => Number(t.playerId) === Number(player.id) && t.status === 'pending')){
    showNotice('Ya hay una operación pendiente por este jugador.');
    return;
  }
  recordBudgetChange(-cfg.amount, `Compra acordada de ${player.name}`, { type:'transfer_purchase_pending', playerId:player.id, fromClubId:player.clubId });
  game.pendingTransfers.push({
    id:`incoming-${player.id}-${Date.now()}`,
    playerId:player.id,
    fromClubId:player.clubId,
    toClubId:game.selectedClubId,
    amount:cfg.amount,
    acceptedTurn:currentTurnIndex(),
    arrivalTurn:currentTurnIndex() + 1,
    status:'pending'
  });
  pushGameMessage({ type:'mercado', title:'Oferta aceptada', body:`${player.name}: el jugador se pondrá a disposición en breve.`, priority:'high' });
  closeModal();
  activeTab = 'messages';
  saveLocal(true);
  renderAll();
  showNotice('Oferta aceptada. El jugador llegará el próximo domingo.');
}
function processPendingTransfers(){
  if(!game) return;
  game.pendingTransfers = Array.isArray(game.pendingTransfers) ? game.pendingTransfers : [];
  let changed = false;
  game.pendingTransfers.forEach(t => {
    if(t.status !== 'pending') return;
    if(Number(t.arrivalTurn || 0) > currentTurnIndex()) return;
    const player = playerById(t.playerId);
    if(!player){ t.status = 'missing'; changed = true; return; }
    if(!hasFirstTeamRosterSpace(Number(t.toClubId || game.selectedClubId), 1)){
      t.arrivalTurn = currentTurnIndex() + 1;
      changed = true;
      return;
    }
    player.clubId = Number(t.toClubId || game.selectedClubId);
    player.freeAgent = false;
    player.sold = false;
    player.salaryPaidCount = 0;
    player.lastSalaryPaidSeason = 0;
    refreshPlayerClause(player);
    ensurePlayerStateForAll();
    if(game.playerStats && !game.playerStats[player.id]) game.playerStats[player.id] = { playerId:player.id, clubId:player.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0 };
    t.status = 'arrived';
    changed = true;
    pushGameMessage({ type:'mercado', title:'Jugador incorporado', body:`${player.name} ya está disponible en el plantel.`, priority:'high' });
  });
  if(changed) saveLocal(true);
}

function statPairs(obj, baseObj=null){
  return Object.entries(obj).map(([k,v])=>{
    const base = baseObj ? Number(baseObj[k]) : NaN;
    const current = Number(v);
    const trained = Number.isFinite(base) ? Math.max(0, current - base) : 0;
    const valueMarkup = trained > 0 ? `${base}<span class="trained-boost">+${trained}</span>` : `${current}`;
    return `<div class="stat-rank"><span>${escapeHtml(k)}</span><strong>${valueMarkup}</strong></div>`;
  }).join('');
}
function radarSvg(stats){
  const entries = Object.entries(stats);
  const cx = 145, cy = 145, maxR = 98;
  const points = entries.map(([_,value],i)=>{
    const angle = -Math.PI/2 + i * (Math.PI*2/entries.length);
    const r = maxR * clamp(value,0,99) / 99;
    return `${cx + Math.cos(angle)*r},${cy + Math.sin(angle)*r}`;
  }).join(' ');
  const grid = [33,66,99].map(level=>{
    const pts = entries.map(([_,value],i)=>{
      const angle = -Math.PI/2 + i * (Math.PI*2/entries.length);
      const r = maxR * level / 99;
      return `${cx + Math.cos(angle)*r},${cy + Math.sin(angle)*r}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(148,163,184,.25)" stroke-width="1"/>`;
  }).join('');
  const labels = entries.map(([label,value],i)=>{
    const angle = -Math.PI/2 + i * (Math.PI*2/entries.length);
    const r = maxR + 28;
    const x = cx + Math.cos(angle)*r;
    const y = cy + Math.sin(angle)*r;
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="radar-label">${escapeHtml(label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 290 290" class="radar" role="img" aria-label="Rombo de estadísticas">
    ${grid}
    <polygon points="${points}" fill="rgba(59,130,246,.35)" stroke="rgba(147,197,253,.95)" stroke-width="2"/>
    ${labels}
  </svg>`;
}

function clearMatchRevealTimers(){
  matchRevealTimers.forEach(id => clearTimeout(id));
  matchRevealTimers = [];
}
function showMatchRevealModal(match, onRevealComplete=null){
  if(!match) return;
  let revealCompleteNotified = false;
  const context = match.matchContext || { weather:'No registrado', pitch:'No registrado', homeFans:0, awayFans:0 };
  const html = `
    <div class="match-reveal-shell">
      <div class="match-modal-head">
        <p class="label">Fecha ${match.matchday} · ${match.date}</p>
        <h2>${clubLink(match.homeId)} <span id="revealScore">0 - 0</span> ${clubLink(match.awayId)}</h2>
      </div>
      <div class="reveal-control-row">
        <div class="reveal-progress"><span id="revealProgressBar"></span></div>
        <button id="finishMatchReveal" class="primary">Finalizar partido</button>
      </div>
      <div id="matchRevealDynamic"></div>
      <div class="card inner match-context-card">
        <h3>Contexto del partido</h3>
        <div class="grid cols-4">
          <div><p class="label">Clima</p><strong>${escapeHtml(context.weather)}</strong></div>
          <div><p class="label">Campo</p><strong>${escapeHtml(context.pitch)}</strong></div>
          <div><p class="label">Hinchas locales</p><strong>${new Intl.NumberFormat('es-AR').format(context.homeFans || 0)}</strong></div>
          <div><p class="label">Hinchas visitantes</p><strong>${new Intl.NumberFormat('es-AR').format(context.awayFans || 0)}</strong></div>
        </div>
      </div>
    </div>`;
  openModal(html);
  const stages = matchRevealStages(match);
  const notifyRevealComplete = () => {
    if(revealCompleteNotified) return;
    revealCompleteNotified = true;
    if(typeof onRevealComplete === 'function') setTimeout(onRevealComplete, 900);
  };
  const renderStage = (idx) => {
    renderMatchRevealStage(match, stages[idx], idx, stages.length);
    if(idx >= stages.length - 1) notifyRevealComplete();
  };
  renderStage(0);
  stages.slice(1).forEach((stage, i) => {
    matchRevealTimers.push(setTimeout(() => renderStage(i + 1), stage.time));
  });
  $('finishMatchReveal')?.addEventListener('click', () => {
    clearMatchRevealTimers();
    renderStage(stages.length - 1);
  });
}
function matchRevealStageLabel(minute, index, total){
  if(index === 0) return 'Salida al campo';
  if(index >= total - 1) return 'Final';
  if(minute === 45) return 'Entretiempo';
  if(minute < 15) return `Minuto ${minute} · Inicio`;
  if(minute < 30) return `Minuto ${minute} · Primer tiempo`;
  if(minute < 45) return `Minuto ${minute} · Antes del descanso`;
  if(minute < 60) return `Minuto ${minute} · Segundo tiempo`;
  if(minute < 75) return `Minuto ${minute} · Partido abierto`;
  return `Minuto ${minute} · Tramo final`;
}
function matchRevealStageNote(minute, index, total){
  if(index === 0) return 'Los equipos salen a la cancha. Todavía no hay eventos revelados.';
  if(index >= total - 1) return 'Resultado final, estadísticas completas y consecuencias del partido.';
  if(minute < 15) return 'Primeras posesiones, presión inicial y tanteo táctico.';
  if(minute < 30) return 'El ritmo empieza a mostrar quién logra progresar mejor.';
  if(minute < 45) return 'Últimos ataques antes del descanso.';
  if(minute === 45) return 'Cierre del primer tiempo.';
  if(minute < 60) return 'Arranque del complemento y primeros ajustes.';
  if(minute < 75) return 'El partido entra en una zona de mayor desgaste.';
  return 'Últimos riesgos, cambios y acciones decisivas.';
}
function matchRevealStages(match){
  const total = Math.max(6, Math.round(MATCH_REVEAL_PHASES || 30));
  const duration = Math.max(6000, Number(MATCH_REVEAL_DURATION_MS || 30000));
  const stages = [];
  const usedMinutes = new Set();
  for(let i=0;i<total;i++){
    const factor = total <= 1 ? 1 : i / (total - 1);
    let minute = i === 0 ? 0 : (i === total - 1 ? 90 : Math.round(factor * 90));
    if(i > 0 && i < total - 1){
      while(usedMinutes.has(minute) && minute < 89) minute++;
      minute = clamp(minute, 1, 89);
    }
    usedMinutes.add(minute);
    stages.push({
      label:matchRevealStageLabel(minute, i, total),
      minute,
      factor,
      time:Math.round(duration * factor),
      note:matchRevealStageNote(minute, i, total)
    });
  }
  return stages;
}
function renderMatchRevealStage(match, stage, index, total){
  const box = $('matchRevealDynamic');
  if(!box) return;
  const homeGoals = match.goals.filter(g => g.clubId === match.homeId && g.minute <= stage.minute).length;
  const awayGoals = match.goals.filter(g => g.clubId === match.awayId && g.minute <= stage.minute).length;
  const scoreBox = $('revealScore');
  if(scoreBox) scoreBox.textContent = `${homeGoals} - ${awayGoals}`;
  const progress = $('revealProgressBar');
  if(progress) progress.style.width = `${Math.round((index/(total-1))*100)}%`;
  const homeStats = partialMatchStats(match.matchStats.home, stage.factor, match.matchStats.home.possession);
  const awayStats = partialMatchStats(match.matchStats.away, stage.factor, match.matchStats.away.possession);
  if(stage.factor === 1){
    homeStats.possession = match.matchStats.home.possession;
    awayStats.possession = match.matchStats.away.possession;
  } else {
    const hPoss = Math.round(50 + (match.matchStats.home.possession - 50) * stage.factor);
    homeStats.possession = hPoss;
    awayStats.possession = 100 - hPoss;
  }
  const events = matchRevealEvents(match, stage.minute);
  box.innerHTML = `
    <div class="card inner reveal-stage-card">
      <div class="row">
        <div><p class="label">Minuto ${stage.minute || 0}</p><h3>${escapeHtml(stage.label)}</h3></div>
        <span class="pill">${index + 1}/${total}</span>
      </div>
      <p class="muted small">${escapeHtml(stage.note)}</p>
    </div>
    <div class="match-team-columns reveal-columns">
      ${revealTeamStatsCard(match.homeId, homeStats, 'Local')}
      ${revealTeamStatsCard(match.awayId, awayStats, 'Visitante')}
    </div>
    <div class="card inner reveal-events-card">
      <h3>Eventos visibles</h3>
      ${events.length ? events.map(revealEventLine).join('') : '<p class="muted">Sin eventos relevantes en este tramo.</p>'}
    </div>
    ${stage.factor === 1 ? `<div class="row reveal-final-actions"><button class="ghost" data-match-id="${escapeHtml(match.id)}">Ver ficha completa normal</button></div>` : ''}`;
  const finish = $('finishMatchReveal');
  if(finish && stage.factor === 1) finish.textContent = 'Partido finalizado';
}
function partialMatchStats(stats, factor){
  return {
    attacks: Math.round((stats.attacks || 0) * factor),
    chances: Math.round((stats.chances || 0) * factor),
    possession: stats.possession,
    fouls: Math.round((stats.fouls || 0) * factor),
    passScore: stats.passScore
  };
}
function revealTeamStatsCard(clubId, stats, sideLabel){
  return `<div class="card inner team-stat-card"><h3>${clubLink(clubId)} <span class="pill">${escapeHtml(sideLabel)}</span></h3>
    <div class="stat-rank"><span>Total de ataques</span><strong>${stats.attacks}</strong></div>
    <div class="stat-rank"><span>Ocasiones de gol</span><strong>${stats.chances}</strong></div>
    <div class="stat-rank"><span>Posesión</span><strong>${stats.possession}%</strong></div>
    <div class="stat-rank"><span>Faltas</span><strong>${stats.fouls}</strong></div>
    <div class="stat-rank"><span>Puntuación de pases</span><strong>${stats.passScore ?? '—'}</strong></div>
  </div>`;
}
function matchRevealEvents(match, minute){
  const events = [];
  (match.goals || []).forEach(g => events.push({ minute:g.minute, type:'goal', data:g }));
  (match.cards || []).forEach(c => events.push({ minute:c.minute, type:'card', data:c }));
  (match.injuries || []).forEach(i => events.push({ minute:i.minute, type:'injury', data:i }));
  (match.substitutions || []).forEach(s => events.push({ minute:s.minute, type:'sub', data:s }));
  return events.filter(e => e.minute <= minute).sort((a,b)=>a.minute-b.minute);
}
function revealEventLine(event){
  if(event.type === 'goal'){
    const g = event.data;
    const p = playerById(g.playerId);
    const a = g.assistId ? playerById(g.assistId) : null;
    return `<div class="stat-rank event-line"><span>${g.minute}' <span class="event-icon ball">⚽</span> ${escapeHtml(p?.name || 'Jugador')} ${clubBadge(g.clubId)}</span><strong>${a ? `<span class="event-icon boot">🥾</span> ${escapeHtml(playerLastName(a.name))}` : 'Sin asist.'}</strong></div>`;
  }
  if(event.type === 'card'){
    return cardLine(event.data);
  }
  if(event.type === 'injury'){
    return injuryLine(event.data);
  }
  const s = event.data;
  return subLine(s);
}

function showMatchModal(matchId){
  const match = game.matchHistory.find(m => m.id === matchId);
  if(!match) return;
  const home = clubName(match.homeId);
  const away = clubName(match.awayId);
  const context = match.matchContext || { weather:'No registrado', pitch:'No registrado', homeFans:0, awayFans:0 };
  const body = `
    <div class="match-modal-head">
      <p class="label">Fecha ${match.matchday} · ${match.date}</p>
      <h2>${clubLink(match.homeId)} ${match.homeGoals} - ${match.awayGoals} ${clubLink(match.awayId)}</h2>
    </div>
    <div class="card inner match-context-card">
      <h3>Contexto del partido</h3>
      <div class="grid cols-4">
        <div><p class="label">Clima</p><strong>${escapeHtml(context.weather)}</strong></div>
        <div><p class="label">Campo de juego</p><strong>${escapeHtml(context.pitch)}</strong></div>
        <div><p class="label">Hinchas locales</p><strong>${new Intl.NumberFormat('es-AR').format(context.homeFans || 0)}</strong></div>
        <div><p class="label">Hinchas visitantes</p><strong>${new Intl.NumberFormat('es-AR').format(context.awayFans || 0)}</strong></div>
      </div>
    </div>
    <div class="match-team-columns">
      ${matchStatsCard(match.homeId, match.matchStats.home, 'Local')}
      ${matchStatsCard(match.awayId, match.matchStats.away, 'Visitante')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card inner"><h3>Goles</h3>${match.goals.length ? match.goals.map(goalLine).join('') : '<p class="muted">Sin goles.</p>'}</div>
      <div class="card inner"><h3>Amonestados y expulsados</h3>${match.cards.length ? match.cards.map(cardLine).join('') : '<p class="muted">Sin tarjetas.</p>'}</div>
      <div class="card inner"><h3>Cambios automáticos</h3>${match.substitutions?.length ? match.substitutions.map(subLine).join('') : '<p class="muted">Sin cambios automáticos ejecutados.</p>'}</div>
      <div class="card inner"><h3>Lesiones</h3>${match.injuries?.length ? match.injuries.map(injuryLine).join('') : '<p class="muted">Sin lesiones.</p>'}</div>
    </div>`;
  openModal(body);
}
function matchStatsCard(clubId, stats, sideLabel){
  return `<div class="card inner team-stat-card"><h3>${clubLink(clubId)} <span class="pill">${escapeHtml(sideLabel)}</span></h3>
    <div class="stat-rank"><span>Total de ataques</span><strong>${stats.attacks}</strong></div>
    <div class="stat-rank"><span>Ocasiones de gol</span><strong>${stats.chances}</strong></div>
    <div class="stat-rank"><span>Posesión</span><strong>${stats.possession}%</strong></div>
    <div class="stat-rank"><span>Faltas</span><strong>${stats.fouls}</strong></div>
    <div class="stat-rank"><span>Puntuación de pases</span><strong>${stats.passScore ?? '—'}</strong></div>
  </div>`;
}
function goalLine(g){
  const p = playerById(g.playerId);
  const a = g.assistId ? playerById(g.assistId) : null;
  return `<div class="stat-rank event-line"><span>${g.minute}' <span class="event-icon ball">⚽</span> ${escapeHtml(p?.name || 'Jugador')} ${clubBadge(g.clubId)}</span><strong>${a ? `<span class="event-icon boot">🥾</span> ${escapeHtml(a.name.split(' ').slice(-1)[0])}` : 'Sin asist.'}</strong></div>`;
}
function cardLine(c){
  const p = playerById(c.playerId);
  const icon = c.type === 'yellow' ? '<span class="yellow-card">■</span>' : c.type === 'secondYellowRed' ? '<span class="yellow-card">■</span><span class="red-card">■</span>' : '<span class="red-card">■</span>';
  const label = c.type === 'yellow' ? 'Amarilla' : c.type === 'secondYellowRed' ? 'Doble amarilla + roja' : 'Roja directa';
  return `<div class="stat-rank"><span>${c.minute}' ${icon} ${escapeHtml(p?.name || 'Jugador')} ${clubBadge(c.clubId)}</span><strong>${label}</strong></div>`;
}
function subLine(s){
  const out = playerById(s.outId);
  const inn = playerById(s.inId);
  const label = s.trigger === 'injury' ? 'Cambio por lesión' : (SUB_TRIGGERS.find(t=>t.value===s.trigger)?.label || s.trigger);
  return `<div class="stat-rank event-line"><span>${s.minute}' <span class="event-icon sub">⇄</span> ${escapeHtml(inn?.name || 'Jugador')} por ${escapeHtml(out?.name || 'Jugador')}</span><strong>${escapeHtml(label)}</strong></div>`;
}
function injuryLine(i){
  const p = playerById(i.playerId);
  const label = i.injuryLabel || i.name || i.severity || 'Lesión';
  const phase = i.phase === 'final' ? 'al final' : 'durante';
  return `<div class="stat-rank event-line"><span>${i.minute}' <span class="injury-event-icon">✚</span> ${escapeHtml(p?.name || 'Jugador')} ${clubBadge(i.clubId)}</span><strong>${escapeHtml(label)} · ${phase}</strong></div>`;
}
function showClubModal(clubId){
  const club = seed.clubs.find(c => c.id === Number(clubId));
  if(!club) return;
  const tactic = getTacticForClub(club.id);
  const players = playersByClub(club.id).slice().sort((a,b)=>positionOrder(a.position)-positionOrder(b.position) || visibleOverall(b)-visibleOverall(a));
  const keepers = players.filter(p=>p.position === 'POR');
  const fieldPlayers = players.filter(p=>p.position !== 'POR');
  const rows = players.map(scoutingPlayerRow).join('');
  const body = `
    <div class="club-modal-head" style="clear:both">
      <p class="label">Club observado</p>
      <h2>${clubBadge(club.id)}${escapeHtml(club.name)}</h2>
      <p class="muted">${escapeHtml(club.city || '')} · Reputación ${club.reputation} · Presupuesto base ${formatMoney(club.budget || 0)}</p>
    </div>
    <div class="grid cols-3" style="margin:14px 0">
      <div class="card inner"><p class="label">Plantel</p><div class="metric">${players.length}</div></div>
      <div class="card inner"><p class="label">Porteros</p><div class="metric">${keepers.length}</div></div>
      <div class="card inner"><p class="label">Jugadores de campo</p><div class="metric">${fieldPlayers.length}</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card inner">
        <h3>Táctica observada</h3>
        <p class="muted small">No se muestran titulares. Sólo la estructura estimada.</p>
        ${clubTacticPreview(tactic.formation)}
      </div>
      <div class="card inner">
        <h3>Scouting parcial</h3>
        <p class="muted small">En cada nueva fecha se revelan de forma provisoria 2 o 3 habilidades visibles por jugador. Las demás quedan ocultas con guion.</p>
      </div>
    </div>
    <div class="card inner" style="margin-top:14px">
      <h3>Plantilla observada</h3>
      <div class="table-wrap"><table class="scouting-table"><thead><tr><th>Jugador</th><th>Rol</th><th>Nac.</th><th>Media</th><th>Ataque/Salto</th><th>Defensa</th><th>Pase</th><th>Velocidad/Reflejos</th><th>Cabezazo/Mando</th><th>Tiro/Potencia</th><th>Resistencia</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  openModal(body);
}
function clubTacticPreview(formation){
  const layout = formationLayout(formation);
  const labels = ['Defensa','MCD','Medios','MO','Ataque'];
  return `<div class="club-tactic-preview">
    <div class="pill">Formación estimada: ${escapeHtml(formation)}</div>
    <div class="club-lines">${layout.map((count,i)=>`<div class="club-line"><strong>${count}</strong><span>${labels[i]}</span></div>`).join('')}</div>
  </div>`;
}
function scoutingTurnKey(){
  if(!game) return 'no-game';
  return `${game.seasonNumber || 1}-${seasonPhase()}-${currentTurnIndex()}-${currentSeasonTurnNumber()}`;
}
function scoutingVisibleKeys(player){
  const keys = Object.keys(scoutingStatMap(player));
  const turnKey = scoutingTurnKey();
  const count = 2 + hashNumber(`scout-count-${player.id}-${turnKey}`, 2);
  const ordered = keys.slice().sort((a,b)=>hashNumber(`scout-${player.id}-${turnKey}-${a}`, 10000) - hashNumber(`scout-${player.id}-${turnKey}-${b}`, 10000));
  return new Set(ordered.slice(0,count));
}
function scoutingStatMap(player){
  const stats = visibleStats(player);
  if(player.position === 'POR'){
    return {
      'Ataque/Salto': stats.Salto,
      'Defensa': stats.Defensa,
      'Pase': stats.Pase,
      'Velocidad/Reflejos': stats.Reflejos,
      'Cabezazo/Mando': stats.Mando,
      'Tiro/Potencia': stats.Potencia,
      'Resistencia': stats.Resistencia
    };
  }
  return {
    'Ataque/Salto': stats.Ataque,
    'Defensa': stats.Defensa,
    'Pase': stats.Pase,
    'Velocidad/Reflejos': stats.Velocidad,
    'Cabezazo/Mando': stats.Cabezazo,
    'Tiro/Potencia': stats.Tiro,
    'Resistencia': stats.Resistencia
  };
}
function scoutingPlayerRow(player){
  const map = scoutingStatMap(player);
  const visible = scoutingVisibleKeys(player);
  const cell = key => visible.has(key) ? `<strong>${map[key]}</strong>` : '<span class="muted">—</span>';
  return `<tr>
    <td>${faceImg(player,'photo-thumb')} <strong>${escapeHtml(player.name)}</strong></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${nationalityShortMarkup(player.nationality)}</td>
    <td><strong>${visibleOverall(player)}</strong></td>
    <td>${cell('Ataque/Salto')}</td>
    <td>${cell('Defensa')}</td>
    <td>${cell('Pase')}</td>
    <td>${cell('Velocidad/Reflejos')}</td>
    <td>${cell('Cabezazo/Mando')}</td>
    <td>${cell('Tiro/Potencia')}</td>
    <td>${cell('Resistencia')}</td>
  </tr>`;
}
function openNewGameModal(force=false){
  if(!force && game && newGameModalShown) return;
  const body = `
    <div class="new-game-modal">
      <p class="label">Nueva partida</p>
      <h2>Elegir club</h2>
      <p class="muted">Seleccioná el club inicial. Al empezar se crea una partida nueva y se guarda localmente en el navegador.</p>
      <label for="modalClubSelect">Club</label>
      <select id="modalClubSelect">${clubSelectOptionsMarkup()}</select>
      <div class="row" style="margin-top:14px"><button id="btnStartNewGameModal" class="primary">Empezar</button></div>
    </div>`;
  openModal(body);
  $('btnStartNewGameModal')?.addEventListener('click', () => {
    const selected = Number($('modalClubSelect')?.value || 0);
    if(selected) newGame(selected);
  });
  newGameModalShown = true;
}
function openModal(html){
  closeModal();
  const wrapper = document.createElement('div');
  wrapper.id = 'modalRoot';
  wrapper.innerHTML = `<div class="modal-backdrop"><div class="modal-panel"><button class="modal-close" data-close-modal aria-label="Cerrar">×</button>${html}</div></div>`;
  document.body.appendChild(wrapper);
}
function closeModal(){
  clearMatchRevealTimers();
  const root = $('modalRoot');
  if(root) root.remove();
}

