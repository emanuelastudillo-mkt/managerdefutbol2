/* V9.58/V9.85 · Programación de amistosos durante toda la temporada con ventana libre de cinco días. */
(function(){
  'use strict';

  const VERSION = 'V9.85';
  const DEFAULTS = {
    minimumLeadDays:2,
    matchBufferDays:2,
    optionsPerDate:5,
    candidateAttempts:70
  };

  function cfg(path, fallback){
    try{
      const parts=String(path || '').split('.').filter(Boolean);
      let value=window.GAME_CONFIG;
      for(const part of parts) value=value?.[part];
      return value ?? fallback;
    }catch(_){ return fallback; }
  }
  function numberCfg(path, fallback, min=0, max=999){
    const value=Number(cfg(path, fallback));
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  }
  function settings(){
    return {
      minimumLeadDays:Math.round(numberCfg('calendario.amistosos.anticipacionMinimaDias', DEFAULTS.minimumLeadDays, 2, 30)),
      matchBufferDays:Math.round(numberCfg('calendario.amistosos.margenPartidosDias', DEFAULTS.matchBufferDays, 0, 10)),
      optionsPerDate:Math.round(numberCfg('calendario.amistosos.opcionesPorFecha', DEFAULTS.optionsPerDate, 1, 10)),
      candidateAttempts:Math.round(numberCfg('calendario.amistosos.intentosMaximosRivales', DEFAULTS.candidateAttempts, 10, 250))
    };
  }
  function safeObj(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function uniqueIds(value){ return [...new Set((Array.isArray(value) ? value : []).map(Number).filter(id => id > 0))]; }
  function nowDate(){ return typeof currentCalendarDate === 'function' ? currentCalendarDate() : String(game?.currentDate || ''); }
  function seasonNo(){ return Math.max(1, Math.round(Number(game?.seasonNumber || 1))); }
  function seasonYear(){ return typeof currentSeasonYear === 'function' ? currentSeasonYear() : Math.round(Number(game?.seasonYear || 2026)); }

  function createState(){
    return {
      version:1,
      season:seasonNo(),
      optionsByDate:{},
      proposalsByDate:{},
      blockedByDate:{},
      scheduledByDate:{},
      completed:[]
    };
  }
  function ensureState(target=game){
    if(!target) return null;
    let state=safeObj(target.friendlySchedulingV958);
    const currentSeason=Math.max(1, Math.round(Number(target.seasonNumber || 1)));
    if(Number(state.season || 0)!==currentSeason) state={...createState(),season:currentSeason};
    state.version=1;
    state.season=currentSeason;
    state.optionsByDate=safeObj(state.optionsByDate);
    state.proposalsByDate=safeObj(state.proposalsByDate);
    state.blockedByDate=safeObj(state.blockedByDate);
    state.scheduledByDate=safeObj(state.scheduledByDate);
    state.completed=Array.isArray(state.completed) ? state.completed.slice(-100) : [];
    Object.keys(state.optionsByDate).forEach(date => { state.optionsByDate[date]=uniqueIds(state.optionsByDate[date]); });
    Object.keys(state.blockedByDate).forEach(date => { state.blockedByDate[date]=uniqueIds(state.blockedByDate[date]); });
    target.friendlySchedulingV958=state;
    target.pendingFriendlyOpponentId=0;
    return state;
  }

  function matchDate(match, round){
    if(typeof scheduledDateForMatch === 'function') return scheduledDateForMatch(match, round);
    return validIsoDate(match?.date) ? match.date : (validIsoDate(round?.date) ? round.date : '');
  }
  function clubMatchesNearDate(clubId, date, buffer=settings().matchBufferDays){
    const id=Number(clubId || 0);
    if(!game || !id || !validIsoDate(date)) return [];
    const found=[];
    (game.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
      if(Number(match?.homeId || 0)!==id && Number(match?.awayId || 0)!==id) return;
      const scheduled=matchDate(match, round);
      if(!validIsoDate(scheduled)) return;
      if(Math.abs(daysBetweenIsoDates(date, scheduled)) <= buffer) found.push({match,round,date:scheduled});
    }));
    return found;
  }
  let internationalCache={key:'',ids:null};
  function internationalParticipantIds(){
    const cacheKey=`${seasonNo()}-${seasonYear()}`;
    if(internationalCache.key===cacheKey && internationalCache.ids) return new Set(internationalCache.ids);
    const ids=new Set();
    const addList=list => (Array.isArray(list) ? list : []).forEach(value => { const id=Number(value || 0); if(id) ids.add(id); });
    addList(game?.libertadores?.participantClubIds);
    addList(game?.championsLeague?.participantClubIds);
    addList(game?.clubWorldCup?.participantClubIds);
    try{ if(typeof libertadoresParticipants === 'function') addList(libertadoresParticipants()?.clubIds); }catch(_){ }
    try{ if(typeof championsLeagueParticipants === 'function') addList(championsLeagueParticipants()?.clubIds); }catch(_){ }
    try{ if(typeof clubWorldCupParticipantIds === 'function') addList(clubWorldCupParticipantIds(game?.clubWorldCup)); }catch(_){ }
    (game?.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
      if(!(match?.libertadores || match?.championsLeague || match?.clubWorldCup || match?.internationalCup || match?.continentalCup)) return;
      addList([match.homeId, match.awayId]);
    }));
    internationalCache={key:cacheKey,ids:[...ids]};
    return ids;
  }
  function buildClubMatchDateIndex(){
    const index=new Map();
    (game?.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
      const date=matchDate(match,round);
      if(!validIsoDate(date)) return;
      [Number(match.homeId||0),Number(match.awayId||0)].filter(Boolean).forEach(id => {
        if(!index.has(id)) index.set(id,[]);
        index.get(id).push(date);
      });
    }));
    return index;
  }
  function clubHasIndexedMatchNear(clubId,date,index,buffer=settings().matchBufferDays){
    return (index?.get(Number(clubId||0)) || []).some(matchDateValue => Math.abs(daysBetweenIsoDates(date,matchDateValue))<=buffer);
  }
  function clubHasUsableRoster(clubId){
    try{ return (typeof playersByClub === 'function' ? playersByClub(clubId) : []).filter(player => !player?.retired && !player?.sold).length >= 16; }
    catch(_){ return false; }
  }
  function friendlyWindowForDate(date){
    if(!validIsoDate(date)) return {allowed:false,label:'',reason:'Fecha inválida'};
    const year=seasonYear();
    const start=seasonStartDateForYear(year);
    const end=seasonEndDateForYear(year);
    if(daysBetweenIsoDates(start,date)<0 || daysBetweenIsoDates(date,end)<0) return {allowed:false,label:'',reason:'La fecha está fuera de la temporada'};
    const buffer=settings().matchBufferDays;
    const windowStart=addDaysToIsoDate(date,-buffer);
    const windowEnd=addDaysToIsoDate(date,buffer);
    if(daysBetweenIsoDates(start,windowStart)<0 || daysBetweenIsoDates(windowEnd,end)<0){
      return {allowed:false,label:'',reason:`El amistoso necesita ${buffer} días libres antes y ${buffer} después dentro de la temporada`};
    }
    return {allowed:true,key:'season',label:'Temporada completa',windowStart,windowEnd};
  }
  function scheduledFriendlyForDate(date){
    if(!game || !validIsoDate(date)) return null;
    const own=Number(game.selectedClubId || 0);
    for(const round of game.fixtures || []){
      for(const match of round?.matches || []){
        if(!match?.friendly || match?.played) continue;
        if(Number(match.homeId)!==own && Number(match.awayId)!==own) continue;
        if(matchDate(match,round)===date) return {match,round,date};
      }
    }
    return null;
  }
  function dateStatus(date, offset=null){
    const current=nowDate();
    const lead=validIsoDate(current) && validIsoDate(date) ? daysBetweenIsoDates(current,date) : Number(offset || 0);
    const min=settings().minimumLeadDays;
    if(lead < min) return {allowed:false,reason:lead<=0 ? 'La fecha ya no está disponible' : `Se requiere una anticipación mínima de ${min} días`};
    const windowInfo=friendlyWindowForDate(date);
    if(!windowInfo.allowed) return windowInfo;
    if(scheduledFriendlyForDate(date)) return {allowed:false,reason:'Ya hay un amistoso programado para esa fecha',scheduled:true};
    const own=Number(game?.selectedClubId || 0);
    if(!own) return {allowed:false,reason:'No hay club seleccionado'};
    const nearby=clubMatchesNearDate(own,date);
    if(nearby.length) return {allowed:false,reason:`Necesitás ${settings().matchBufferDays} días libres antes y ${settings().matchBufferDays} después del amistoso`};
    return {...windowInfo,allowed:true,lead};
  }
  function candidateAllowed(clubId,date,blocked,dateIndex=null){
    const id=Number(clubId || 0);
    if(!id || id===Number(game?.selectedClubId || 0) || blocked.has(id)) return false;
    if(!clubHasUsableRoster(id)) return false;
    return dateIndex ? !clubHasIndexedMatchNear(id,date,dateIndex) : clubMatchesNearDate(id,date).length===0;
  }
  function deterministicCandidates(date){
    const state=ensureState();
    if(!state) return [];
    const blocked=new Set(uniqueIds(state.blockedByDate[date]));
    const own=Number(game.selectedClubId || 0);
    const candidates=(seed?.clubs || []).filter(club => Number(club?.id || 0)>0 && Number(club.id)!==own);
    const salt=`friendly-v985-${game.saveCode || ''}-${seasonNo()}-${date}`;
    const dateIndex=buildClubMatchDateIndex();
    const stored=uniqueIds(state.optionsByDate[date]).filter(id=>candidateAllowed(id,date,blocked,dateIndex));
    const chosen=stored.slice(0,settings().optionsPerDate);
    const seen=new Set(chosen.map(id=>candidates.findIndex(club=>Number(club?.id||0)===Number(id))).filter(index=>index>=0));
    const limit=Math.min(candidates.length,settings().candidateAttempts);
    let attempt=0;
    while(seen.size<limit && attempt<settings().candidateAttempts*4 && chosen.length<settings().optionsPerDate){
      const pick=typeof hashNumber==='function' ? hashNumber(`${salt}-${attempt}`,Math.max(1,candidates.length)) : Math.floor(Math.random()*Math.max(1,candidates.length));
      attempt+=1;
      if(seen.has(pick)) continue;
      seen.add(pick);
      const id=Number(candidates[pick]?.id || 0);
      if(candidateAllowed(id,date,blocked,dateIndex)) chosen.push(id);
    }
    state.optionsByDate[date]=chosen;
    return chosen;
  }
  function proposalFor(date,clubId){
    const state=ensureState();
    if(!state) return null;
    const id=Number(clubId || 0);
    const current=safeObj(state.proposalsByDate[date]);
    if(Number(current.clubId || 0)===id && ['home','away'].includes(current.managerVenue)) return current;
    const value=typeof hashNumber==='function' ? hashNumber(`friendly-venue-${game.saveCode || ''}-${seasonNo()}-${date}-${id}`,2) : Math.floor(Math.random()*2);
    const proposal={clubId:id,managerVenue:value===0?'home':'away',createdAt:Date.now()};
    state.proposalsByDate[date]=proposal;
    return proposal;
  }
  function blockedForDate(date){ return new Set(uniqueIds(ensureState()?.blockedByDate?.[date])); }
  function blockProposal(date,clubId){
    const state=ensureState();
    if(!state) return;
    const blocked=blockedForDate(date);
    blocked.add(Number(clubId || 0));
    state.blockedByDate[date]=[...blocked];
    delete state.proposalsByDate[date];
    saveLocal(true);
    openFriendlyOptions(date);
    showNotice(`${clubName(clubId)} quedó bloqueado para el amistoso del ${date}.`);
  }
  function createScheduledFriendly(date,clubId,managerVenue){
    const state=ensureState();
    const own=Number(game.selectedClubId || 0);
    const rival=Number(clubId || 0);
    if(!state || !own || !rival || !validIsoDate(date)) return null;
    const status=dateStatus(date);
    if(!status.allowed){ showNotice(status.reason || 'La fecha dejó de estar disponible.'); return null; }
    if(!candidateAllowed(rival,date,blockedForDate(date),buildClubMatchDateIndex())){ showNotice('El rival ya no tiene libres los dos días anteriores y posteriores a ese amistoso.'); return null; }
    const homeId=managerVenue==='home' ? own : rival;
    const awayId=managerVenue==='home' ? rival : own;
    const token=String(date).replaceAll('-','');
    const match={
      id:`friendly-v958-s${seasonNo()}-${token}-${own}-${rival}`,
      friendly:true,
      calendarFriendlyV958:true,
      matchday:`AM-${token}`,
      divisionId:'friendly',
      divisionName:'Amistoso',
      date,
      roundDate:date,
      homeId,
      awayId,
      played:false,
      negotiatedVenue:true,
      managerVenue
    };
    const round={
      id:`friendly-round-v958-s${seasonNo()}-${token}-${own}-${rival}`,
      friendlyRound:true,
      calendarFriendlyRoundV958:true,
      title:'Partido amistoso',
      matchday:`AM-${token}`,
      date,
      startDate:date,
      endDate:date,
      roundDate:date,
      matches:[match]
    };
    game.fixtures=Array.isArray(game.fixtures) ? game.fixtures : [];
    game.fixtures.push(round);
    state.scheduledByDate[date]=match.id;
    delete state.proposalsByDate[date];
    saveLocal(true);
    closeModal();
    renderAll();
    showNotice(`Amistoso confirmado ante ${clubName(rival)} para el ${date}, ${managerVenue==='home'?'como local':'como visitante'}.`,true);
    return match;
  }

  function clubOptionMarkup(date,clubId){
    const blocked=blockedForDate(date).has(Number(clubId));
    const club=(seed?.clubs || []).find(item=>Number(item.id)===Number(clubId));
    const division=typeof clubDivision==='function' ? clubDivision(clubId) : {name:club?.divisionName || '—'};
    return `<div class="friendly-v958-club ${blocked?'is-blocked':''}">
      <span class="friendly-v958-badge">${typeof clubBadge==='function' ? clubBadge(clubId) : ''}</span>
      <span class="friendly-v958-club-copy"><strong>${escapeHtml(clubName(clubId))}</strong><small>${escapeHtml(division?.name || club?.country || 'Club')}</small></span>
      ${blocked ? '<span class="pill bad">Bloqueado</span>' : `<button type="button" class="ghost" data-friendly-v958-negotiate="${Number(clubId)}" data-friendly-v958-date="${escapeHtml(date)}">Negociar</button>`}
    </div>`;
  }
  function openFriendlyOptions(date){
    const status=dateStatus(date);
    if(!status.allowed){
      openModal(`<div class="card inner"><p class="label">Partido amistoso</p><h2>Fecha no disponible</h2><p>${escapeHtml(status.reason || 'No se puede programar un amistoso en esta fecha.')}</p><div class="modal-actions"><button class="primary" data-close-modal>Entendido</button></div></div>`);
      return;
    }
    const ids=deterministicCandidates(date);
    const proposal=safeObj(ensureState()?.proposalsByDate?.[date]);
    const proposalMarkup=proposal.clubId ? `<div class="friendly-v958-pending"><span>Negociación pendiente</span><strong>${escapeHtml(clubName(proposal.clubId))}</strong><button type="button" class="ghost" data-friendly-v958-negotiate="${Number(proposal.clubId)}" data-friendly-v958-date="${escapeHtml(date)}">Ver oferta</button></div>` : '';
    const list=ids.length ? ids.map(id=>clubOptionMarkup(date,id)).join('') : '<div class="empty"><p>No se encontraron cinco clubes disponibles con las condiciones actuales.</p></div>';
    openModal(`<div class="card inner friendly-v958-modal">
      <p class="label">Programar amistoso · ${escapeHtml(status.label || '')}</p>
      <h2>${escapeHtml(date)}</h2>
      <p class="muted">Se sortearon hasta cinco clubes disponibles. Estas opciones quedan guardadas para esta fecha. Cada rival debe tener libres el día elegido y los dos días anteriores y posteriores. Participar en liga o copas no lo excluye si existe esa ventana libre de cinco días.</p>
      ${proposalMarkup}
      <div class="friendly-v958-list">${list}</div>
      <div class="modal-actions"><button class="ghost" data-close-modal>Cerrar</button></div>
    </div>`);
    bindModalActions();
  }
  function openProposal(date,clubId){
    const id=Number(clubId || 0);
    if(blockedForDate(date).has(id)){ openFriendlyOptions(date); return; }
    const proposal=proposalFor(date,id);
    if(!proposal) return;
    saveLocal(true);
    const ownHome=proposal.managerVenue==='home';
    openModal(`<div class="card inner friendly-v958-modal">
      <p class="label">Propuesta de amistoso</p>
      <h2>${typeof clubBadge==='function'?clubBadge(id):''} ${escapeHtml(clubName(id))}</h2>
      <div class="friendly-v958-offer">
        <strong>${ownHome ? `${escapeHtml(clubName(id))} propone visitar tu estadio.` : `${escapeHtml(clubName(id))} propone jugar en su estadio.`}</strong>
        <span>Tu equipo jugaría ${ownHome?'como local':'como visitante'} el ${escapeHtml(date)}.</span>
      </div>
      <p class="muted">No existe contraoferta directa. Para buscar otra localía tenés que rechazar esta propuesta; ese club quedará bloqueado únicamente para esta fecha.</p>
      <div class="modal-actions two-lines">
        <button type="button" class="primary" data-friendly-v958-accept="${id}" data-friendly-v958-date="${escapeHtml(date)}" data-friendly-v958-venue="${proposal.managerVenue}">Aceptar propuesta</button>
        <button type="button" class="danger" data-friendly-v958-reject="${id}" data-friendly-v958-date="${escapeHtml(date)}">Rechazar y bloquear</button>
        <button type="button" class="ghost" data-friendly-v958-back="${escapeHtml(date)}">Volver</button>
      </div>
    </div>`);
    bindModalActions();
  }
  function bindModalActions(){
    document.querySelectorAll('[data-friendly-v958-negotiate]').forEach(button=>button.addEventListener('click',()=>openProposal(button.dataset.friendlyV958Date,Number(button.dataset.friendlyV958Negotiate))));
    document.querySelectorAll('[data-friendly-v958-accept]').forEach(button=>button.addEventListener('click',()=>createScheduledFriendly(button.dataset.friendlyV958Date,Number(button.dataset.friendlyV958Accept),button.dataset.friendlyV958Venue)));
    document.querySelectorAll('[data-friendly-v958-reject]').forEach(button=>button.addEventListener('click',()=>blockProposal(button.dataset.friendlyV958Date,Number(button.dataset.friendlyV958Reject))));
    document.querySelectorAll('[data-friendly-v958-back]').forEach(button=>button.addEventListener('click',()=>openFriendlyOptions(button.dataset.friendlyV958Back)));
  }
  function bindCalendarButtons(){
    document.querySelectorAll('[data-friendly-v958-date]').forEach(button=>{
      if(button.dataset.friendlyV958Bound==='1') return;
      button.dataset.friendlyV958Bound='1';
      if(button.matches('.home-week-calendar-empty-action')) button.addEventListener('click',()=>openFriendlyOptions(button.dataset.friendlyV958Date));
    });
  }

  function calendarEmptyMarkup(date,offset){
    const status=dateStatus(date,offset);
    if(status.allowed){
      return `<button type="button" class="home-week-calendar-empty home-week-calendar-empty-action" data-friendly-v958-date="${escapeHtml(date)}" aria-label="Programar un amistoso para el ${escapeHtml(date)}">
        <span class="friendly-v960-status"><span aria-hidden="true">⚽</span> Amistoso disponible</span>
        <strong class="friendly-v960-title">Fecha libre</strong>
        <small>Elegir rival</small>
      </button>`;
    }
    const shortReason=offset>0 && offset<settings().minimumLeadDays ? `Disponible con ${settings().minimumLeadDays} días de anticipación` : (status.reason || 'Sin compromiso programado');
    return `<div class="home-week-calendar-empty"><span>Sin partido</span><small>${escapeHtml(shortReason)}</small></div>`;
  }

  function finalizeFriendlyResult(match,result){
    if(!game || !match || !result) return null;
    result={...result,...{
      id:match.id,
      friendly:true,
      calendarFriendlyV958:true,
      date:match.date,
      homeId:match.homeId,
      awayId:match.awayId,
      divisionId:'friendly',
      divisionName:'Amistoso',
      matchday:match.matchday,
      cards:[],
      injuries:[],
      substitutions:Array.isArray(result.substitutions)?result.substitutions:[]
    }};
    Object.assign(match,JSON.parse(JSON.stringify(result)),{played:true});
    game.matchHistory=Array.isArray(game.matchHistory)?game.matchHistory:[];
    game.matchHistory.push(result);
    if(typeof applyConditionUpdates==='function') applyConditionUpdates([result]);
    if(typeof applyMoraleUpdates==='function') applyMoraleUpdates([result]);
    const settlement=window.gameV894?.settleFriendly?.(result) || null;
    if(settlement){ result.friendlySettlementV894=settlement; match.friendlySettlementV894=JSON.parse(JSON.stringify(settlement)); }
    const state=ensureState();
    state.completed.push({matchId:match.id,date:match.date,opponentId:Number(match.homeId)===Number(game.selectedClubId)?Number(match.awayId):Number(match.homeId),managerVenue:match.managerVenue || (Number(match.homeId)===Number(game.selectedClubId)?'home':'away'),homeGoals:Number(result.homeGoals||0),awayGoals:Number(result.awayGoals||0)});
    delete state.scheduledByDate[match.date];
    return {result,settlement};
  }
  function friendlySummary(result,settlement,phaseLabelText){
    const own=Number(game.selectedClubId || 0);
    const opponent=Number(result.homeId)===own?Number(result.awayId):Number(result.homeId);
    const ownGoals=Number(result.homeId)===own?Number(result.homeGoals||0):Number(result.awayGoals||0);
    const rivalGoals=Number(result.homeId)===own?Number(result.awayGoals||0):Number(result.homeGoals||0);
    game.lastTurnSummary={
      title:'Partido amistoso',
      phase:phaseLabelText || (typeof phaseLabel==='function'?phaseLabel():'Amistoso'),
      result:`${clubName(own)} ${ownGoals} - ${rivalGoals} ${clubName(opponent)}`,
      tone:ownGoals>rivalGoals?'ok':ownGoals<rivalGoals?'bad':'info',
      items:[
        {label:'Rival',text:`${clubName(opponent)} · ${Number(result.homeId)===own?'Local':'Visitante'}`,tone:'info'},
        {label:'Recaudación compartida',text:settlement?`Tu club recibió ${formatMoney(Number(settlement.ownShare||0))}.`:'Sin información de recaudación.',tone:settlement?.ownShare?'ok':'info'},
        {label:'Cohesión',text:settlement?`${Number(settlement.ownCohesion||0)>0?'+':''}${Number(settlement.ownCohesion||0)} punto(s).`:'Sin cambios registrados.',tone:Number(settlement?.ownCohesion||0)>0?'ok':Number(settlement?.ownCohesion||0)<0?'bad':'info'}
      ],
      createdAt:Date.now()
    };
  }
  function finishScheduledFriendly(match,result,mode){
    const preBots=(typeof isRegularSeason==='function' && isRegularSeason() && typeof simulateNonOwnDueBeforeOwnMatch==='function') ? simulateNonOwnDueBeforeOwnMatch(match.date,'before_scheduled_friendly') : [];
    const done=finalizeFriendlyResult(match,result);
    if(!done) return;
    if(mode==='preseason'){
      game.preseasonFriendliesPlayed=Math.max(0,Number(game.preseasonFriendliesPlayed||0))+1;
      originalSimulatePreseasonTurn();
      friendlySummary(done.result,done.settlement,'Pretemporada');
      saveLocal(true); renderAll();
    }else if(mode==='postseason'){
      originalSimulatePostseasonTurn();
      if(game && !game.seasonFinalized){ friendlySummary(done.result,done.settlement,'Postemporada'); saveLocal(true); renderAll(); }
    }else{
      if(typeof maintainBotBalanceDuringSeason==='function') maintainBotBalanceDuringSeason();
      if(typeof applyUnifiedAdvanceCooldown==='function') applyUnifiedAdvanceCooldown('match');
      friendlySummary(done.result,done.settlement,'Amistoso programado');
      activeTab='home';
      saveLocal(true); renderAll();
      showNotice(`Amistoso disputado ante ${clubName(Number(match.homeId)===Number(game.selectedClubId)?match.awayId:match.homeId)}.`,true);
    }
  }
  function startFriendlyInteractive(match,mode){
    try{
      const started=window.LiveMatchUI?.start?.(match,{onComplete:result=>finishScheduledFriendly(match,result,mode),onCancel:null});
      if(started) return true;
    }catch(error){ console.error('Error al iniciar amistoso programado:',error); }
    showNotice('No se pudo iniciar la simulación viva del amistoso.',true);
    return false;
  }
  function resultOnlyFriendly(match,mode){
    const result=typeof simulateLiveMatchResultOnly==='function' ? simulateLiveMatchResultOnly(match) : (typeof simulateMatch==='function'?simulateMatch(match):null);
    if(!result){ showNotice('No se pudo generar el resultado del amistoso.'); return; }
    finishScheduledFriendly(match,result,mode);
    if(typeof showResultOnlySummary==='function') showResultOnlySummary(result);
  }
  function startScheduledFriendly(match){
    if(!game || !match || match.played) return false;
    if(game.mustReviewTactics){ showNotice('Revisá la táctica antes de jugar el amistoso.'); return true; }
    const errors=typeof validateCurrentTactic==='function'?validateCurrentTactic(false):[];
    if(errors.length){ showNotice(errors.join(' ')); return true; }
    const mode=typeof isPreseason==='function'&&isPreseason()?'preseason':typeof isPostseason==='function'&&isPostseason()?'postseason':'regular';
    openModal(`<div class="card inner match-start-choice friendly-v958-modal">
      <p class="label">Amistoso programado · ${escapeHtml(match.date || '')}</p>
      <h2>${clubLink(match.homeId)} vs ${clubLink(match.awayId)}</h2>
      <p class="muted">El amistoso no suma estadísticas oficiales del mánager ni sanciones. Sí aplica desgaste, moral, cohesión y recaudación compartida.</p>
      <div class="modal-actions two-lines">
        <button id="startFriendlyV958Live" class="primary">Dirigir partido</button>
        <button id="startFriendlyV958Result" class="ghost">Ver solo resultados</button>
      </div>
    </div>`);
    setTimeout(()=>{
      document.querySelector('#startFriendlyV958Live')?.addEventListener('click',()=>{ closeModal(); startFriendlyInteractive(match,mode); });
      document.querySelector('#startFriendlyV958Result')?.addEventListener('click',()=>{ closeModal(); resultOnlyFriendly(match,mode); });
    },0);
    return true;
  }

  if(typeof normalizeGame==='function'){
    const originalNormalizeGame=normalizeGame;
    normalizeGame=function(saved){ const normalized=originalNormalizeGame(saved); ensureState(normalized); return normalized; };
  }
  if(typeof fixtureRoundIsPersistentCompetition==='function'){
    const originalPersistent=fixtureRoundIsPersistentCompetition;
    fixtureRoundIsPersistentCompetition=function(round){
      if(round?.friendlyRound || round?.calendarFriendlyRoundV958 || (round?.matches||[]).some(match=>match?.friendly)) return true;
      return originalPersistent(round);
    };
  }
  if(typeof isRegularLeagueRound==='function'){
    const originalRegularRound=isRegularLeagueRound;
    isRegularLeagueRound=function(round){
      if(round?.friendlyRound || round?.calendarFriendlyRoundV958 || (round?.matches||[]).some(match=>match?.friendly)) return false;
      return originalRegularRound(round);
    };
  }

  const originalDayMarkup=typeof homeWeekCalendarDayMarkup==='function'?homeWeekCalendarDayMarkup:null;
  if(originalDayMarkup){
    homeWeekCalendarDayMarkup=function(iso,offset,events=[],transferActivity={incoming:0,outgoing:0}){
      let html=originalDayMarkup(iso,offset,events,transferActivity);
      if(!(events||[]).length){
        const friendlyStatus=dateStatus(iso,offset);
        html=html.replace(/<div class="home-week-calendar-empty"><span>Sin partido<\/span><small>Sin compromiso programado<\/small><\/div>/,calendarEmptyMarkup(iso,offset));
        if(friendlyStatus.allowed){
          html=html.replace('home-week-calendar-day ', 'home-week-calendar-day can-schedule-friendly ');
          html=html.replace('<b class="no-match" aria-hidden="true">·</b>','<b class="friendly-available" aria-hidden="true">⚽</b>');
        }
      }
      return html;
    };
  }
  const originalTurnPanel=typeof turnModePanelMarkup==='function'?turnModePanelMarkup:null;
  if(originalTurnPanel){
    turnModePanelMarkup=function(){
      // La disponibilidad se comunica directamente en el calendario; evitamos repetir un bloque explicativo en pretemporada.
      if(typeof isPreseason==='function'&&isPreseason()) return '';
      if(typeof isPostseason==='function'&&isPostseason()) return `<div class="card preseason-card"><div class="row"><div><p class="label">Postemporada</p><h3>${phaseDayRangeLabel(game.phaseTurn||0,postseasonTurnsForCurrentSeason())}</h3></div><span class="pill">Amistosos disponibles</span></div><p class="muted">Podés programar amistosos durante toda la temporada siempre que haya dos días libres antes y dos después.</p></div>`;
      return originalTurnPanel();
    };
  }
  if(typeof renderHome==='function'){
    const originalRenderHome=renderHome;
    renderHome=function(){ ensureState(); const result=originalRenderHome(); bindCalendarButtons(); return result; };
  }
  if(typeof updateAdvanceButtonState==='function'){
    const originalUpdateAdvance=updateAdvanceButtonState;
    updateAdvanceButtonState=function(){
      const result=originalUpdateAdvance();
      const due=scheduledFriendlyForDate(nowDate());
      const button=document.getElementById('advanceUnifiedBtn')||document.getElementById('advanceMatchBtn')||document.getElementById('advanceDayBtn');
      if(due?.match && button && !button.disabled) button.textContent='Jugar amistoso';
      return result;
    };
  }
  const originalSimulatePreseasonTurn=typeof simulatePreseasonTurn==='function'?simulatePreseasonTurn:function(){};
  const originalSimulatePostseasonTurn=typeof simulatePostseasonTurn==='function'?simulatePostseasonTurn:function(){};
  if(typeof advanceCalendarOneStep==='function'){
    const originalAdvance=advanceCalendarOneStep;
    advanceCalendarOneStep=function(){
      const due=scheduledFriendlyForDate(nowDate());
      if(due?.match) return startScheduledFriendly(due.match);
      return originalAdvance();
    };
  }
  if(typeof startNextSeason==='function'){
    const originalStartNext=startNextSeason;
    startNextSeason=function(...args){ const result=originalStartNext.apply(this,args); internationalCache={key:'',ids:null}; ensureState(); return result; };
  }

  window.gameFriendliesV958={
    version:VERSION,
    ensureState,
    dateStatus,
    candidates:deterministicCandidates,
    open:openFriendlyOptions,
    schedule:createScheduledFriendly,
    due:scheduledFriendlyForDate,
    proposal:proposalFor,
    reject:blockProposal,
    finalize:finalizeFriendlyResult,
    finish:finishScheduledFriendly,
    internationalParticipantIds
  };
})();
