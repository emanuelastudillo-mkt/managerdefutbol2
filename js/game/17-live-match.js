/* V5.24 · Simulación viva con resultado directo y terminar partido. */
(function(){
  let liveSession = null;
  let liveOptions = null;
  let liveState = null;
  let livePaused = true;
  let liveAutoTimer = null;
  let liveSelectedInstruction = 'none';
  let liveSelectedStarterId = 0;
  let liveSelectedBenchId = 0;
  let livePendingSubstitutions = [];
  let liveHalftimePaused = false;
  let liveTacticOpen = false;
  let liveSelectedBoardSlot = -1;

  function ehtml(value){
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
  }
  function fmtNumber(value){ return new Intl.NumberFormat('es-AR').format(Number(value || 0)); }
  function lastName(name){ return typeof playerLastName === 'function' ? playerLastName(name) : String(name || 'Jugador').trim().split(/\s+/).slice(-1)[0]; }
  function liveClubName(id){ return typeof clubName === 'function' ? clubName(id) : `Club ${id}`; }
  function liveBadge(id){ return typeof clubBadge === 'function' ? clubBadge(id) : ''; }
  function ownClubId(){ return Number(game?.selectedClubId || 0); }
  function ownSide(){
    const own = ownClubId();
    if(!liveState?.match || !own) return 'home';
    return Number(liveState.match.homeId) === own ? 'home' : 'away';
  }
  function sideClubId(side){ return side === 'home' ? liveState?.match?.homeId : liveState?.match?.awayId; }
  function sideLineup(side){ return side === 'home' ? (liveState?.homeLineup || []) : (liveState?.awayLineup || []); }
  function sideBench(side){ return side === 'home' ? (liveState?.homeBench || []) : (liveState?.awayBench || []); }
  function currentOwnLineup(){ return sideLineup(ownSide()); }
  function ownFormation(){ return liveState?.ownFormation || (ownSide() === 'home' ? liveState?.homeFormation : liveState?.awayFormation) || '4-4-2'; }
  function sideFormation(side){ return side === 'home' ? (liveState?.homeFormation || '4-4-2') : (liveState?.awayFormation || '4-4-2'); }
  function ownBoardSlots(){
    if(Array.isArray(liveState?.ownBoardSlots) && liveState.ownBoardSlots.length) return liveState.ownBoardSlots;
    return ownSide() === 'home' ? (liveState?.homeBoardSlots || []) : (liveState?.awayBoardSlots || []);
  }
  function liveIsBreak(){ return liveState?.period === 'break' || liveState?.nextBlock?.period === 'break' || liveState?.lastBlock?.period === 'break'; }
  function liveDisplayMinute(){
    if(liveState?.finished) return 'FIN';
    if(liveIsBreak()) return 'DESC';
    return `${Number(liveState?.minute || 0)}'`;
  }
  function livePhaseLabel(){
    if(liveState?.finished) return 'Finalizado';
    const next = liveState?.nextBlock;
    if(next?.period === 'break') return `Siguiente: ${next.label}`;
    if(liveState?.lastBlock?.period === 'break') return `Descanso ${Number(liveState.breakPhase || liveState.lastBlock.breakMinute || 0)}/15`;
    return next ? `Siguiente: ${next.label}` : 'Finalizado';
  }
  function eventPlayerLabel(id, full=false){
    const player = typeof playerById === 'function' ? playerById(id) : null;
    const name = player?.name || player?.nombre || 'Jugador';
    return full ? name : lastName(name);
  }
  function liveShowNotice(message, error=false){ if(typeof showNotice === 'function') showNotice(message, error); }
  function liveConfirm(message){ return typeof window.confirm === 'function' ? window.confirm(message) : true; }
  function liveEvents(){
    const events = [];
    (liveState?.goals || []).forEach(g => {
      const assist = g.assistId ? ` · asistencia ${eventPlayerLabel(g.assistId)}` : '';
      const detail = g.errorGoal ? ' · error rival' : (g.setPiece ? ' · pelota parada' : assist);
      events.push({ minute:Number(g.minute || 0), type:'goal', clubId:g.clubId, data:g, text:`Gol de ${eventPlayerLabel(g.playerId)}${detail}` });
    });
    (liveState?.cards || []).forEach(c => {
      const kind = c.type === 'yellow' ? 'Amarilla' : (c.type === 'secondYellowRed' ? 'Doble amarilla y roja' : 'Roja directa');
      events.push({ minute:Number(c.minute || 0), type:c.type === 'yellow' ? 'yellow' : 'red', clubId:c.clubId, data:c, text:`${kind}: ${eventPlayerLabel(c.playerId)}` });
    });
    (liveState?.injuries || []).forEach(i => events.push({ minute:Number(i.minute || 0), type:'injury', clubId:i.clubId, data:i, text:`Lesión de ${eventPlayerLabel(i.playerId)} · ${i.injuryLabel || i.name || 'Lesión'}` }));
    (liveState?.substitutions || []).forEach(s => events.push({ minute:Number(s.minute || 0), type:'sub', clubId:s.clubId, data:s, text:`Cambio: entra ${eventPlayerLabel(s.inId)}, sale ${eventPlayerLabel(s.outId)}` }));
    (liveState?.keySaves || []).forEach(k => events.push({ minute:Number(k.minute || 0), type:'save', clubId:k.clubId, data:k, text:`Tapada clave de ${eventPlayerLabel(k.playerId)}${k.chanceById ? ` a ${eventPlayerLabel(k.chanceById)}` : ''}` }));
    (liveState?.errors || []).forEach(err => events.push({ minute:Number(err.minute || 0), type:'error', clubId:err.clubId, data:err, text:`${err.goal ? 'Error de gol' : 'Error'} de ${eventPlayerLabel(err.playerId)}` }));
    return events.sort((a,b)=>a.minute-b.minute || eventOrder(a.type)-eventOrder(b.type));
  }
  function eventOrder(type){ return ({ goal:1, red:2, injury:3, yellow:4, save:5, error:6, sub:7 })[type] || 9; }
  function eventIcon(type){ return ({ goal:'⚽', yellow:'🟨', red:'🟥', injury:'✚', sub:'⇄', save:'🧤', error:'⚠️' })[type] || '•'; }
  function narrationFallback(event, player, club, rival){
    const p = player?.name || 'el jugador';
    if(event.type === 'goal') return `¡Gol de ${p}! ${club} golpea en el minuto ${event.minute}.`;
    if(event.type === 'save') return `Tapada clave para ${club}. El arquero sostiene el resultado.`;
    if(event.type === 'error') return `Error de ${p}. ${club} queda comprometido ante ${rival}.`;
    if(event.type === 'injury') return `Lesión de ${p}. Malas noticias para ${club}.`;
    if(event.type === 'sub') return `${club} mueve el banco y busca ajustar el partido.`;
    if(event.type === 'red') return `Expulsión para ${p}. El partido cambia de forma inmediata.`;
    if(event.type === 'yellow') return `Amonestado ${p}. El margen de error empieza a achicarse.`;
    return 'El partido sigue vivo.';
  }
  function applyTemplateSafe(text, data){ return String(text || '').replace(/\{([a-zA-Z_]+)\}/g, (_, key) => String(data?.[key] ?? '')); }
  function liveNarration(events){
    const minute = Number(liveState?.minute || 0);
    const fresh = events.filter(ev => Number(ev.minute || 0) === minute).slice(-1)[0];
    const latest = fresh || events.slice(-1)[0];
    if(!liveState?.finished && liveIsBreak()){
      const phase = Number(liveState?.breakPhase || liveState?.lastBlock?.breakMinute || 0);
      const label = phase ? `Descanso ${phase}/15` : 'Entretiempo';
      return { tone:'break', title:label, text:'Los jugadores recuperan algo de estado físico antes del segundo tiempo.', sub:'Podés hacer cambios, tocar la formación o dejar instrucciones listas.' };
    }
    if(liveState?.finished){
      const h = Number(liveState.homeGoals || 0), a = Number(liveState.awayGoals || 0);
      return { tone:'final', title:'Final del partido', text:`Resultado final: ${h} - ${a}.`, sub:'Ya podés cerrar y guardar el resultado.' };
    }
    if(latest && latest.minute === minute){
      const playerId = latest.data?.playerId || latest.data?.inId || latest.data?.outId || 0;
      const player = typeof playerById === 'function' ? playerById(playerId) : null;
      const club = liveClubName(latest.clubId);
      const rivalId = Number(latest.clubId) === Number(liveState.match?.homeId) ? liveState.match?.awayId : liveState.match?.homeId;
      const rival = liveClubName(rivalId);
      const fallback = narrationFallback(latest, player, club, rival);
      const bucket = latest.type === 'yellow' || latest.type === 'red' ? 'card' : latest.type;
      const text = typeof pickRelatoPhrase === 'function'
        ? applyTemplateSafe(pickRelatoPhrase(bucket, `live-${liveState.match?.id}-${latest.type}-${latest.minute}-${playerId}`, fallback), { player:player?.name || 'el jugador', club, rival, minute:latest.minute })
        : fallback;
      return { tone:`event-${latest.type}`, title:`Minuto ${minute}'`, text, sub:latest.text };
    }
    const stats = liveState?.matchStats || {};
    const hStats = stats.home || {}, aStats = stats.away || {};
    const hPressure = Number(hStats.attacks || 0) + Number(hStats.chances || 0) * 3 + Number(hStats.possession || 50) / 12;
    const aPressure = Number(aStats.attacks || 0) + Number(aStats.chances || 0) * 3 + Number(aStats.possession || 50) / 12;
    const leader = hPressure > aPressure + 2 ? liveClubName(liveState.match.homeId) : (aPressure > hPressure + 2 ? liveClubName(liveState.match.awayId) : 'ninguno');
    const text = leader === 'ninguno' ? 'El partido está parejo y todavía no aparece una ventaja clara.' : `${leader} empieza a inclinar la cancha.`;
    return { tone:'ambient', title:`Minuto ${minute}'`, text, sub:minute <= 45 ? 'Primer tiempo en desarrollo.' : 'Segundo tiempo en desarrollo.' };
  }
  function meterClass(value){ const n = Number(value || 0); return n >= 76 ? 'ok' : n >= 55 ? 'warn' : 'bad'; }
  function fitClass(value){ const n = Number(value || 0); return n >= 90 ? 'ok' : n >= 74 ? 'warn' : 'bad'; }
  function remainingSubstitutions(){ return Math.max(0, Number(liveState?.maxSubs || 3) - Number(liveState?.usedSubs || 0) - livePendingSubstitutions.length); }
  function pendingOutIds(){ return new Set(livePendingSubstitutions.map(s => Number(s.outId))); }
  function pendingInIds(){ return new Set(livePendingSubstitutions.map(s => Number(s.inId))); }
  function availabilityTag(player, inField, isOwn){
    if(player?.expelled) return '<span class="live-row-tag red">EXP</span>';
    if(player?.injuredGhost) return '<span class="live-row-tag injury">LES</span>';
    if(!isOwn) return '';
    if(inField && pendingOutIds().has(Number(player.id))) return '<span class="live-row-tag warn">SALE</span>';
    if(!inField && pendingInIds().has(Number(player.id))) return '<span class="live-row-tag ok">ENTRA</span>';
    return '';
  }
  function livePlayerEventSummary(playerId){
    const id = Number(playerId || 0);
    const summary = { goals:0, assists:0, yellow:0, red:0, injuries:0, saves:0, errors:0, goalErrors:0, subIn:0, subOut:0 };
    if(!id || !liveState) return summary;
    (liveState.goals || []).forEach(g => {
      if(Number(g.playerId) === id) summary.goals += 1;
      if(Number(g.assistId) === id) summary.assists += 1;
    });
    (liveState.cards || []).forEach(c => {
      if(Number(c.playerId) !== id) return;
      if(c.type === 'yellow') summary.yellow += 1;
      else if(c.type === 'secondYellowRed'){ summary.yellow += 1; summary.red += 1; }
      else summary.red += 1;
    });
    (liveState.injuries || []).forEach(i => { if(Number(i.playerId) === id) summary.injuries += 1; });
    (liveState.keySaves || []).forEach(k => { if(Number(k.playerId) === id) summary.saves += 1; });
    (liveState.errors || []).forEach(err => {
      if(Number(err.playerId) === id){ summary.errors += 1; if(err.goal) summary.goalErrors += 1; }
    });
    (liveState.substitutions || []).forEach(sub => {
      if(Number(sub.inId) === id) summary.subIn += 1;
      if(Number(sub.outId) === id) summary.subOut += 1;
    });
    return summary;
  }
  function repeatIcon(icon, count, limit=4){
    const n = Math.max(0, Number(count || 0));
    if(!n) return '';
    if(n <= limit) return icon.repeat(n);
    return `${icon}×${n}`;
  }
  function livePlayerIcons(playerId){
    const ev = livePlayerEventSummary(playerId);
    const icons = [
      repeatIcon('⚽', ev.goals),
      repeatIcon('👟', ev.assists),
      repeatIcon('🟨', ev.yellow),
      repeatIcon('🟥', ev.red),
      repeatIcon('✚', ev.injuries, 1)
    ].filter(Boolean).join('');
    return icons ? `<span class="live-player-icons" title="Estados del partido">${icons}</span>` : '';
  }
  function liveRatingClass(value){
    const n = Number(value || 0);
    return n >= 7.2 ? 'ok' : n >= 6.0 ? 'warn' : 'bad';
  }
  function livePlayerRating(player, side, inField=true){
    if(!player || !liveState) return '—';
    const id = Number(player.id || 0);
    const events = livePlayerEventSummary(id);
    const hasPlayed = inField || events.subOut > 0 || events.subIn > 0 || events.goals > 0 || events.assists > 0 || events.yellow > 0 || events.red > 0 || events.saves > 0 || events.errors > 0;
    if(!hasPlayed) return '—';
    const overall = simClampUi(Number(player.overall || 0), 1, 99);
    const cond = simClampUi(Number(player.condition || 0), 1, 100);
    const morale = simClampUi(Number(player.morale || 0), 1, 100);
    const fit = inField ? simClampUi(Number(player.fit || 75), 1, 110) : 75;
    let rating = 6.05 + (overall - 62) * 0.012 + (morale - 55) * 0.006 + (cond - 70) * 0.005 + (fit - 78) * 0.004;
    rating += events.goals * 0.82 + events.assists * 0.48 + events.saves * 0.24;
    rating -= events.yellow * 0.22 + events.red * 1.10 + events.errors * 0.32 + events.goalErrors * 0.42 + events.injuries * 0.18;
    const goalDiff = side === 'home' ? Number(liveState.homeGoals || 0) - Number(liveState.awayGoals || 0) : Number(liveState.awayGoals || 0) - Number(liveState.homeGoals || 0);
    rating += simClampUi(goalDiff, -3, 3) * 0.08;
    const minute = Number(liveState.minute || 0);
    if(minute < 15 && !events.goals && !events.assists && !events.yellow && !events.red && !events.errors && !events.saves) rating = 6.3 + (overall - 60) * 0.006 + (fit - 80) * 0.003;
    return simClampUi(rating, 3.0, 10.0).toFixed(1).replace('.', ',');
  }
  function playerListRow(player, side, inField=true, isOwn=false){
    const id = Number(player.id || 0);
    const expelled = Boolean(player?.expelled);
    const injuredGhost = Boolean(player?.injuredGhost || player?.ghost);
    const blocked = Boolean(player?.blocked && !(isOwn && inField && injuredGhost));
    const selectable = isOwn && !expelled && !blocked;
    const selected = selectable && (inField ? Number(liveSelectedStarterId) === id : Number(liveSelectedBenchId) === id);
    const disabled = expelled || blocked || (isOwn && (inField ? pendingOutIds().has(id) : pendingInIds().has(id)));
    const cond = Math.round(Number(player.condition || 0));
    const morale = Math.round(Number(player.morale || 0));
    const fit = Math.round(Number(player.fit || (inField ? 100 : 0)));
    const rating = livePlayerRating(player, side, inField);
    const ratingClass = rating === '—' ? 'idle' : liveRatingClass(Number(String(rating).replace(',', '.')));
    const cls = `live-list-row ${inField ? 'starter' : 'bench'} ${expelled ? 'expelled' : ''} ${injuredGhost ? 'injured-ghost' : ''} ${selectable ? 'clickable' : ''} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`;
    const attr = selectable ? (inField ? `data-live-starter-id="${id}"` : `data-live-bench-id="${id}"`) : '';
    const tag = availabilityTag(player, inField, isOwn);
    const icons = livePlayerIcons(id);
    const nameCell = `<span class="live-name-cell"><strong>${ehtml(lastName(player.name))}</strong>${icons}${tag}</span>`;
    const rowNo = expelled ? 'R' : (injuredGhost ? 'L' : (inField ? String((Number(player.slotIndex || 0) + 1)).padStart(2,'0') : 'S'));
    const body = `<span class="num">${rowNo}</span>${nameCell}<span>${ehtml(player.role || player.position || '—')}</span><b>${Math.round(Number(player.overall || 0))}</b><b class="live-rating ${ratingClass}">${ehtml(rating)}</b><i class="${meterClass(cond)}">${cond}</i><i class="${meterClass(morale)}">${morale}</i><i class="${fitClass(fit)}">${inField ? fit : '—'}</i>`;
    return selectable ? `<button type="button" class="${cls}" ${attr} ${disabled ? 'disabled' : ''}>${body}</button>` : `<div class="${cls}">${body}</div>`;
  }
  function formationSelect(){
    const current = ownFormation();
    const formations = Array.isArray(liveState?.availableFormations) && liveState.availableFormations.length ? liveState.availableFormations : ['4-4-2','4-3-3','4-2-3-1','3-5-2','5-3-2','4-1-4-1','3-4-3','4-5-1','4-3-1-2','5-4-1'];
    return `<select id="liveFormationSelect" ${liveState?.finished ? 'disabled' : ''}>${formations.map(f => `<option value="${ehtml(f)}" ${f === current ? 'selected' : ''}>${ehtml(f)}</option>`).join('')}</select>`;
  }
  function liveTeamPanel(side){
    const clubId = sideClubId(side);
    const isOwn = Number(clubId) === ownClubId();
    const lineup = sideLineup(side);
    const bench = sideBench(side);
    const used = side === 'home' ? Number(liveState?.usedSubsHome || 0) : Number(liveState?.usedSubsAway || 0);
    const injuredGhosts = lineup.filter(p => p?.injuredGhost).length;
    const selectedHint = isOwn
      ? (injuredGhosts ? 'Lesionado en cancha: tocá al lesionado y luego un suplente para reemplazarlo.' : (liveTacticOpen ? 'Modo táctica abierto: tocá dos titulares para intercambiar roles o cambiá la formación.' : (liveSelectedStarterId ? `Sale ${eventPlayerLabel(liveSelectedStarterId)} · elegí suplente o titular para reacomodar.` : (liveSelectedBenchId ? `Entra ${eventPlayerLabel(liveSelectedBenchId)} · elegí titular que sale.` : 'Titular + suplente = cambio. Titular + titular = reacomodar.'))))
      : `${used} cambios usados · el bot decide cambios automáticos.`;
    return `<section class="card inner live-team-panel ${isOwn ? 'own' : 'bot'} ${side}">
      <div class="live-team-head">
        <div><p class="label">${side === 'home' ? 'Local' : 'Visitante'} ${isOwn ? '· tu equipo' : '· bot'}</p><h3>${liveBadge(clubId)} ${ehtml(liveClubName(clubId))}</h3></div>
        <div class="live-formation-control"><span>Formación</span>${isOwn ? formationSelect() : `<strong>${ehtml(sideFormation(side))}</strong>`}</div>
      </div>
      <p class="muted small live-selected-hint">${ehtml(selectedHint)}</p>
      <div class="live-list-head"><span>N°</span><span>Jugador</span><span>Rol</span><span>MED</span><span>Pun</span><span>Fís</span><span>Mor</span><span>Rol%</span></div>
      <div class="live-team-list starters">${lineup.map(p => playerListRow(p, side, true, isOwn)).join('') || '<p class="muted small">Sin titulares.</p>'}</div>
      <div class="live-bench-title compact"><strong>Banco</strong><span>${bench.length} suplentes · ${used}/3 cambios</span></div>
      <div class="live-team-list bench">${bench.map(p => playerListRow(p, side, false, isOwn)).join('') || '<p class="muted small">Sin suplentes disponibles.</p>'}</div>
      ${isOwn ? `<div class="live-pending-box"><div class="live-bench-title compact"><strong>Pendientes</strong><span>${remainingSubstitutions()} cambios restantes</span></div>${pendingSubstitutionList()}</div>` : ''}
    </section>`;
  }
  function compareValue(value, type){
    if(type === 'xg') return Number(value || 0).toFixed(2).replace('.', ',');
    if(type === 'pct') return `${Math.round(Number(value || 0))}%`;
    return String(Math.round(Number(value || 0)));
  }
  function compareStatRow(label, left, right, type='num'){
    const l = Number(left || 0);
    const r = Number(right || 0);
    const total = Math.max(1, l + r);
    const lp = type === 'pct' ? simClampUi(l, 0, 100) : Math.round((l / total) * 100);
    const rp = type === 'pct' ? simClampUi(r, 0, 100) : Math.round((r / total) * 100);
    return `<div class="live-compare-row" style="--left:${lp}%;--right:${rp}%"><p>${ehtml(label)}</p><div class="live-compare-values"><strong>${ehtml(compareValue(left, type))}</strong><span class="bar left"><i></i></span><span class="bar right"><i></i></span><strong>${ehtml(compareValue(right, type))}</strong></div></div>`;
  }
  function simClampUi(value,min,max){ return Math.max(min, Math.min(max, Number(value || 0))); }
  function compareStatsCard(){
    const match = liveState.match || {};
    const h = liveState.matchStats?.home || {};
    const a = liveState.matchStats?.away || {};
    const awayPoss = Number(a.possession ?? (100 - Number(h.possession || 50)));
    return `<div class="card inner live-compare-card">
      <div class="live-compare-top"><span>${liveBadge(match.homeId)} ${ehtml(liveClubName(match.homeId))}</span><b>Estadísticas del partido</b><span>${ehtml(liveClubName(match.awayId))} ${liveBadge(match.awayId)}</span></div>
      ${compareStatRow('Disparos', h.attacks || 0, a.attacks || 0)}
      ${compareStatRow('Tiros a puerta', h.chances || 0, a.chances || 0)}
      ${compareStatRow('xG', h.xg || 0, a.xg || 0, 'xg')}
      ${compareStatRow('Faltas', h.fouls || 0, a.fouls || 0)}
      ${compareStatRow('Posesión', h.possession || 50, awayPoss, 'pct')}
    </div>`;
  }
  function minuteRail(events){
    const eventByMinute = new Map();
    events.forEach(ev => {
      const minute = Number(ev.minute || 0);
      if(!eventByMinute.has(minute) || eventOrder(ev.type) < eventOrder(eventByMinute.get(minute))) eventByMinute.set(minute, ev.type);
    });
    const played = Number(liveState?.phasesPlayed || 0);
    const timeline = Array.isArray(liveState?.phaseTimeline) && liveState.phaseTimeline.length
      ? liveState.phaseTimeline
      : Array.from({ length:90 }, (_, index) => ({ phase:index + 1, matchMinute:index + 1, label:`${index + 1}'`, period:index < 45 ? 'first' : 'second', playable:true }));
    return `<div class="live-minute-rail" aria-label="45 fases, 15 de descanso y 45 fases">${timeline.map((block, index) => {
      const phaseNo = index + 1;
      const type = block.playable === false ? '' : eventByMinute.get(Number(block.matchMinute || 0));
      const status = phaseNo <= played ? 'done' : (!liveState?.finished && phaseNo === played + 1 ? 'current' : 'pending');
      const period = block.period === 'break' ? 'rest' : (block.period === 'second' ? 'second' : 'first');
      return `<span class="${status} ${period} ${type ? `has-event ${ehtml(type)}` : ''}" title="${ehtml(block.label || `${phaseNo}`)}${type ? ` · ${type}` : ''}"></span>`;
    }).join('')}</div>`;
  }
  function instructionButtons(){
    const options = Array.isArray(window.LIVE_MANAGER_INSTRUCTIONS) ? window.LIVE_MANAGER_INSTRUCTIONS : [];
    return `<div class="live-instruction-buttons compact">${options.map(opt => `<button type="button" data-live-instruction="${ehtml(opt.value)}" class="${opt.value === liveSelectedInstruction ? 'active' : ''}"><strong>${ehtml(opt.label)}</strong></button>`).join('')}</div>`;
  }
  function pendingSubstitutionList(){
    if(!livePendingSubstitutions.length) return '<p class="muted small">Sin cambios pendientes.</p>';
    return `<div class="live-pending-subs">${livePendingSubstitutions.map((s, index) => `<div><span>Próx. minuto</span><strong>Entra ${ehtml(eventPlayerLabel(s.inId))} · Sale ${ehtml(eventPlayerLabel(s.outId))}</strong><button type="button" data-live-remove-pending-sub="${index}" class="ghost mini">Quitar</button></div>`).join('')}</div>`;
  }
  function liveManagerPanel(){
    return `<div class="card inner live-bottom-controls">
      ${instructionButtons()}
      <div class="live-action-row">
        <button id="liveTacticBtn" class="ghost ${liveTacticOpen ? 'active' : ''}" ${liveState.finished ? 'disabled' : ''}>Táctica</button>
        <button id="livePauseBtn" class="ghost">${livePaused ? 'Auto' : 'Pausar'}</button>
        <button id="liveNextBlockBtn" class="primary" ${liveState.finished ? 'disabled' : ''}>${ehtml(liveState?.nextBlock?.period === 'break' ? 'Simular descanso' : 'Simular 1 minuto')}</button>
        <button id="liveInstantFinishBtn" class="ghost" ${liveState.finished ? 'disabled' : ''}>Terminar partido</button>
        <button id="liveFinishBtn" class="primary" ${liveState.finished ? '' : 'disabled'}>Cerrar y guardar</button>
      </div>
    </div>`;
  }
  function boardZone(slot){
    const role = String(slot?.role || '');
    if(role === 'POR') return 'gk';
    if(['DFC','LI','LD'].includes(role)) return 'def';
    if(['MCD','MC'].includes(role)) return 'mid';
    if(['MI','MD','MCO'].includes(role)) return 'am';
    if(['DC','EI','ED'].includes(role)) return 'att';
    return 'mid';
  }
  function boardZoneLabel(zone){ return ({ att:'Ataque', am:'Volantes ofensivos', mid:'Medios', def:'Defensa', gk:'Arquero' })[zone] || 'Zona'; }
  function boardSlotButton(slot){
    const index = Number(slot?.slotIndex ?? -1);
    const player = slot?.player || null;
    const selected = index === Number(liveSelectedBoardSlot);
    const empty = !player;
    const fit = player ? Math.round(Number(player.fit || 0)) : 0;
    const injuredGhost = Boolean(player?.injuredGhost || player?.ghost);
    const cls = `live-board-circle ${empty ? 'empty' : ''} ${injuredGhost ? 'ghost' : ''} ${selected ? 'selected' : ''} ${fit < 70 && player && !injuredGhost ? 'warn' : ''}`;
    const label = player ? lastName(player.name) : 'Hueco';
    const meta = player ? (injuredGhost ? 'Lesionado · no aporta' : `${Math.round(Number(player.overall || 0))} · ${Math.round(Number(player.condition || 0))}%`) : 'Sin jugador';
    return `<button type="button" class="${cls}" data-live-board-slot="${index}" ${liveState?.finished ? 'disabled' : ''}>
      <span class="role">${ehtml(slot?.role || '—')}</span>
      <strong>${ehtml(label)}</strong>
      <small>${ehtml(meta)}</small>
    </button>`;
  }
  function liveTacticBoard(){
    if(!liveTacticOpen || liveState?.finished) return '';
    const slots = ownBoardSlots();
    const redCount = (liveState?.cards || []).filter(c => Number(c.clubId) === ownClubId() && ['red','secondYellowRed'].includes(String(c.type || ''))).length;
    const emptySlots = slots.filter(slot => slot?.empty).length;
    const zones = ['att','am','mid','def','gk'];
    const rows = zones.map(zone => {
      const zoneSlots = slots.filter(slot => boardZone(slot) === zone);
      if(!zoneSlots.length) return '';
      return `<div class="live-board-row ${zone}"><span>${boardZoneLabel(zone)}</span><div>${zoneSlots.map(boardSlotButton).join('')}</div></div>`;
    }).filter(Boolean).join('');
    const selected = liveSelectedBoardSlot >= 0 ? slots.find(slot => Number(slot.slotIndex) === Number(liveSelectedBoardSlot)) : null;
    const selectedText = selected ? (selected.player ? `${selected.role}: ${lastName(selected.player.name)}` : `${selected.role}: hueco`) : 'Elegí un círculo y después otro para intercambiar o cubrir un hueco.';
    return `<section class="card inner live-tactic-board-front">
      <div class="live-tactic-board-head">
        <div><p class="label">Pizarra táctica</p><h3>${redCount ? `${redCount} expulsado(s) · ${emptySlots} hueco(s)` : 'Reacomodar posiciones'}</h3></div>
        <div class="live-formation-control board"><span>Formación</span>${formationSelect()}</div>
        <button type="button" id="liveCloseBoardBtn" class="ghost mini">Cerrar pizarra</button>
      </div>
      <p class="muted small live-board-selected">${ehtml(selectedText)}</p>
      <div class="live-board-field">${rows}</div>
    </section>`;
  }
  function renderLiveMatch(){
    if(!liveState) return;
    const match = liveState.match || {};
    const homeTitle = liveClubName(match.homeId);
    const awayTitle = liveClubName(match.awayId);
    const currentMinute = Number(liveState.minute || 0);
    const totalPhases = Number(liveState.totalPhases || 105);
    const phasesPlayed = Number(liveState.phasesPlayed || 0);
    const progress = Math.max(0, Math.min(100, Math.round((phasesPlayed / Math.max(1,totalPhases)) * 100)));
    const nextBlock = liveState.nextBlock;
    const nextButtonLabel = nextBlock?.period === 'break' ? 'Simular descanso' : 'Simular 1 minuto';
    const events = liveEvents();
    const narration = liveNarration(events);
    const recentEvents = events.slice().reverse().slice(0, 11);
    const html = `<div class="live-match-shell live-v512 live-v517">
      <div class="match-modal-head live-match-head">
        <div class="live-head-left"><p class="label">${match.friendly ? 'Simulación viva · Amistoso' : 'Simulación viva · Fecha'} ${ehtml(match.matchday || '—')} · ${ehtml(match.date || '')}</p><h2>${liveBadge(match.homeId)} ${ehtml(homeTitle)} <span class="live-score">${Number(liveState.homeGoals || 0)} - ${Number(liveState.awayGoals || 0)}</span> ${ehtml(awayTitle)} ${liveBadge(match.awayId)}</h2></div>
        <div class="live-head-right"><strong>${ehtml(liveDisplayMinute())}</strong><span>Fase ${Math.min(totalPhases, Math.max(1, phasesPlayed || 1))} / ${totalPhases}</span><small>${ehtml(livePhaseLabel())}</small></div>
      </div>
      <div class="live-progress"><span style="width:${progress}%"></span></div>
      ${minuteRail(events)}
      ${liveTacticBoard()}
      <div class="live-v512-grid">
        ${liveTeamPanel('home')}
        <section class="live-center-stack">
          <div class="card inner live-commentary-card ${ehtml(narration.tone || 'ambient')}">
            <p class="label">Relato en vivo</p>
            <h3>${ehtml(narration.title)}</h3>
            <div class="live-commentary-text">${ehtml(narration.text)}</div>
            <div class="live-commentary-sub">${ehtml(narration.sub || '')}</div>
          </div>
          ${compareStatsCard()}
          <div class="card inner live-events-card">
            <div class="live-card-head"><h3>Eventos</h3><span class="muted small">últimos arriba</span></div>
            <div class="live-events-list">${recentEvents.length ? recentEvents.map(ev => `<div class="live-event ${ehtml(ev.type)}"><span>${ev.minute}'</span><i>${eventIcon(ev.type)}</i>${liveBadge(ev.clubId)}<strong>${ehtml(ev.text)}</strong></div>`).join('') : '<p class="muted small">Todavía no hay eventos relevantes.</p>'}</div>
          </div>
          <div class="card inner compact-match-context live-context-compact">
            <div><span>Clima</span><strong>${ehtml(liveState.matchContext?.weather || '—')}</strong></div>
            <div><span>Campo</span><strong>${ehtml(liveState.matchContext?.pitch || '—')}</strong></div>
            <div><span>Hinchas</span><strong>${fmtNumber(liveState.matchContext?.homeFans || 0)}</strong></div>
            <div><span>Recaudación</span><strong class="ok">${typeof formatMoney === 'function' ? formatMoney(liveState.matchContext?.ticketRevenue || 0) : (liveState.matchContext?.ticketRevenue || 0)}</strong></div>
          </div>
        </section>
        ${liveTeamPanel('away')}
      </div>
      ${liveManagerPanel()}
    </div>`;
    const root = document.querySelector('#liveMatchRoot');
    if(root) root.innerHTML = html;
    bindLiveControls();
  }
  function resetLiveSelections(){ liveSelectedStarterId = 0; liveSelectedBenchId = 0; liveSelectedBoardSlot = -1; }
  function queueSubstitution(outId, inId){
    outId = Number(outId || 0); inId = Number(inId || 0);
    if(!outId || !inId || outId === inId) return;
    if(remainingSubstitutions() <= 0){ liveShowNotice('Ya no quedan cambios disponibles.', true); return; }
    if(pendingOutIds().has(outId) || pendingInIds().has(inId)){ liveShowNotice('Ese cambio ya está pendiente.', true); return; }
    const msg = `Confirmar sustitución\n\nEntra: ${eventPlayerLabel(inId, true)}\nSale: ${eventPlayerLabel(outId, true)}\n\nSe aplicará antes del próximo minuto.`;
    if(!liveConfirm(msg)) return;
    livePendingSubstitutions.push({ outId, inId });
    resetLiveSelections();
    liveShowNotice('Cambio confirmado para el próximo minuto.', false);
    renderLiveMatch();
  }
  function swapSlots(slotA, slotB){
    slotA = Number(slotA); slotB = Number(slotB);
    if(slotA < 0 || slotB < 0 || slotA === slotB) return;
    const slots = ownBoardSlots();
    const a = slots.find(slot => Number(slot.slotIndex) === slotA);
    const b = slots.find(slot => Number(slot.slotIndex) === slotB);
    if(!a || !b || (!a.player && !b.player)) return;
    const aText = a.player ? `${eventPlayerLabel(a.player.id, true)} (${a.role})` : `Hueco (${a.role})`;
    const bText = b.player ? `${eventPlayerLabel(b.player.id, true)} (${b.role})` : `Hueco (${b.role})`;
    const msg = `Reacomodar pizarra\n\n${aText} ⇄ ${bText}`;
    if(!liveConfirm(msg)) return;
    const ok = window.Simulator20?.swapLiveSlots?.(liveSession, ownClubId(), slotA, slotB);
    if(!ok){ liveShowNotice('No se pudo reacomodar la pizarra.', true); return; }
    liveState = window.Simulator20.livePublicState(liveSession);
    resetLiveSelections();
    liveShowNotice('Pizarra reacomodada.', false);
    renderLiveMatch();
  }
  function swapStarters(aId, bId){
    aId = Number(aId || 0); bId = Number(bId || 0);
    if(!aId || !bId || aId === bId) return;
    const lineup = currentOwnLineup();
    const a = lineup.find(p => Number(p.id) === aId);
    const b = lineup.find(p => Number(p.id) === bId);
    if(!a || !b) return;
    swapSlots(Number(a.slotIndex), Number(b.slotIndex));
  }
  function simulateNextBlockFromUi(){
    if(!liveSession || liveState?.finished) return;
    const wasBeforeBreak = liveState?.nextBlock?.period !== 'break' && liveState?.period !== 'break';
    const substitutions = livePendingSubstitutions.slice();
    const result = window.Simulator20.simulateLiveBlock(liveSession, { instruction:liveSelectedInstruction, substitutions });
    if(result?.played){ liveState = window.Simulator20.livePublicState(liveSession); liveState.finished = true; }
    else{ liveState = result || window.Simulator20.livePublicState(liveSession); }
    const ownInjuries = (liveState?.extra?.injuries || []).filter(injury => Number(injury.clubId || 0) === ownClubId());
    if(substitutions.length) livePendingSubstitutions = [];
    if(ownInjuries.length){
      livePaused = true;
      clearTimeout(liveAutoTimer);
      const injuredName = eventPlayerLabel(ownInjuries[0].playerId, true);
      const canSub = Number(liveState?.usedSubs || 0) + livePendingSubstitutions.length < Number(liveState?.maxSubs || 3);
      liveShowNotice(canSub ? `${injuredName} queda lesionado en cancha. Tocá al lesionado y luego un suplente para reemplazarlo.` : `${injuredName} queda lesionado en cancha, pero ya no quedan cambios.`, false);
    }
    if(wasBeforeBreak && liveState?.nextBlock?.period === 'break' && !liveHalftimePaused){
      livePaused = true;
      liveHalftimePaused = true;
      clearTimeout(liveAutoTimer);
      liveShowNotice('Entretiempo: el partido queda pausado. Podés hacer cambios o ajustar instrucciones.', false);
    }
    resetLiveSelections();
    renderLiveMatch();
  }
  function finishLiveMatchInstantlyFromUi(){
    if(!liveSession || liveState?.finished) return;
    if(!liveConfirm(`Terminar partido ahora?\n\nSe simularán todos los minutos restantes sin más intervenciones y se mostrarán las estadísticas completas.`)) return;
    livePaused = true;
    clearTimeout(liveAutoTimer);
    let guard = 0;
    let first = true;
    while(liveSession && !liveSession.finished && guard < 140){
      const substitutions = first ? livePendingSubstitutions.slice() : [];
      const stateOrResult = window.Simulator20.simulateLiveBlock(liveSession, { instruction:liveSelectedInstruction, substitutions });
      if(stateOrResult?.played){ liveState = window.Simulator20.livePublicState(liveSession); liveState.finished = true; break; }
      liveState = stateOrResult || window.Simulator20.livePublicState(liveSession);
      livePendingSubstitutions = [];
      first = false;
      guard += 1;
    }
    liveState = window.Simulator20.livePublicState(liveSession);
    liveState.finished = true;
    livePendingSubstitutions = [];
    liveTacticOpen = false;
    resetLiveSelections();
    renderLiveMatch();
    liveShowNotice('Partido terminado. Estadísticas completas disponibles.', false);
  }
  function bindLiveControls(){
    document.querySelectorAll('[data-live-instruction]').forEach(btn => btn.addEventListener('click', () => { liveSelectedInstruction = btn.getAttribute('data-live-instruction') || 'none'; renderLiveMatch(); }));
    document.querySelectorAll('#liveFormationSelect').forEach(select => select.addEventListener('change', (ev) => {
      const value = ev.target.value;
      if(!value || value === ownFormation()) return;
      if(!liveConfirm(`Cambiar formación a ${value}.\n\nEl cuerpo técnico reacomodará automáticamente a los titulares para reducir penalizaciones por rol.`)){ ev.target.value = ownFormation(); return; }
      const ok = window.Simulator20?.applyLiveFormation?.(liveSession, ownClubId(), value);
      if(!ok){ liveShowNotice('No se pudo cambiar la formación.', true); return; }
      liveState = window.Simulator20.livePublicState(liveSession);
      resetLiveSelections(); liveShowNotice(`Formación cambiada a ${value}.`, false); renderLiveMatch();
    }));
    document.querySelectorAll('[data-live-starter-id]').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-live-starter-id') || 0);
      if(!id || liveState?.finished) return;
      if(liveSelectedBenchId){ queueSubstitution(id, liveSelectedBenchId); return; }
      if(liveSelectedStarterId && liveSelectedStarterId !== id){ swapStarters(liveSelectedStarterId, id); return; }
      liveSelectedStarterId = liveSelectedStarterId === id ? 0 : id;
      liveSelectedBenchId = 0; renderLiveMatch();
    }));
    document.querySelectorAll('[data-live-bench-id]').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-live-bench-id') || 0);
      if(!id || liveState?.finished) return;
      if(remainingSubstitutions() <= 0){ liveShowNotice('Ya no quedan cambios disponibles.', true); return; }
      if(liveSelectedStarterId){ queueSubstitution(liveSelectedStarterId, id); return; }
      liveSelectedBenchId = liveSelectedBenchId === id ? 0 : id;
      liveSelectedStarterId = 0; renderLiveMatch();
    }));
    document.querySelectorAll('[data-live-remove-pending-sub]').forEach(btn => btn.addEventListener('click', () => {
      const index = Number(btn.getAttribute('data-live-remove-pending-sub') || -1);
      if(index >= 0) livePendingSubstitutions.splice(index, 1);
      resetLiveSelections(); renderLiveMatch();
    }));
    document.querySelectorAll('[data-live-board-slot]').forEach(btn => btn.addEventListener('click', () => {
      const slot = Number(btn.getAttribute('data-live-board-slot') || -1);
      if(slot < 0 || liveState?.finished) return;
      if(liveSelectedBoardSlot >= 0 && liveSelectedBoardSlot !== slot){ swapSlots(liveSelectedBoardSlot, slot); return; }
      liveSelectedBoardSlot = liveSelectedBoardSlot === slot ? -1 : slot;
      liveSelectedStarterId = 0; liveSelectedBenchId = 0; renderLiveMatch();
    }));
    document.querySelector('#liveCloseBoardBtn')?.addEventListener('click', () => { liveTacticOpen = false; liveSelectedBoardSlot = -1; renderLiveMatch(); });
    document.querySelector('#liveTacticBtn')?.addEventListener('click', () => { liveTacticOpen = !liveTacticOpen; livePaused = true; clearTimeout(liveAutoTimer); liveSelectedBoardSlot = -1; renderLiveMatch(); });
    document.querySelector('#liveNextBlockBtn')?.addEventListener('click', () => { livePaused = true; clearTimeout(liveAutoTimer); simulateNextBlockFromUi(); });
    document.querySelector('#liveInstantFinishBtn')?.addEventListener('click', () => { finishLiveMatchInstantlyFromUi(); });
    document.querySelector('#livePauseBtn')?.addEventListener('click', () => { livePaused = !livePaused; if(!livePaused) runAutoMode(); renderLiveMatch(); });
    document.querySelector('#liveFinishBtn')?.addEventListener('click', () => {
      if(!liveSession?.result) return;
      window.__liveMatchCloseLocked = false;
      const result = liveSession.result;
      closeModal();
      if(typeof liveOptions?.onComplete === 'function') liveOptions.onComplete(result);
      liveSession = null; liveOptions = null; liveState = null; livePaused = true; liveSelectedInstruction = 'none'; livePendingSubstitutions = []; liveHalftimePaused = false; liveTacticOpen = false; liveSelectedBoardSlot = -1;
      resetLiveSelections(); clearTimeout(liveAutoTimer);
    });
  }
  function runAutoMode(){
    clearTimeout(liveAutoTimer);
    if(livePaused || !liveSession || liveState?.finished) return;
    const autoDelay = Math.max(300, Number(window.GAME_CONFIG?.ui?.simulacionVivaAutoMs || 840));
    liveAutoTimer = setTimeout(() => { simulateNextBlockFromUi(); runAutoMode(); }, autoDelay);
  }
  function start(match, options={}){
    if(!match || !window.Simulator20?.createLiveMatchSession) return false;
    clearTimeout(liveAutoTimer);
    liveOptions = options || {}; livePaused = true; liveSelectedInstruction = 'none'; livePendingSubstitutions = []; liveHalftimePaused = false; liveTacticOpen = false; liveSelectedBoardSlot = -1; resetLiveSelections();
    liveSession = window.Simulator20.createLiveMatchSession(match);
    liveState = window.Simulator20.livePublicState(liveSession);
    window.__liveMatchCloseLocked = false;
    openModal('<div id="liveMatchRoot"></div>');
    window.__liveMatchCloseLocked = true;
    renderLiveMatch();
    liveShowNotice('Partido propio abierto en simulación viva. El resultado todavía no está decidido.', false);
    return true;
  }
  window.LiveMatchUI = { start };
  window.__LIVE_MATCH_UI_READY = true;
})();
