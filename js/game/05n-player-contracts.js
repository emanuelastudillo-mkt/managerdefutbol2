/* V8.77 · Contratos de jugadores, negociación manual, renovaciones bot,
   control de plantel al inicio de temporada y vista táctica de grupos. */

(function(){
  const PLAYER_CONTRACTS_VERSION = 1;
  let playerContractsSort = 'expiry_asc';

  function pcCfg(path, fallback){
    return typeof configValue === 'function' ? configValue(`plantel.contratosJugadores.${path}`, fallback) : fallback;
  }
  function pcClamp(value,min,max){ return Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min)); }
  function pcSeason(state=game){ return Math.max(1,Math.round(Number(state?.seasonNumber||1))); }
  function pcDay(state=game){ return Math.max(1,Math.round(Number(typeof currentGlobalDayNumber==='function'?currentGlobalDayNumber():seasonDayFromDate(state?.currentDate,currentSeasonYear()))||1)); }
  function pcHash(key,max=10000){ return typeof hashNumber==='function'?hashNumber(String(key||''),Math.max(1,max)):0; }
  function pcPlayers(clubId){ return (typeof playersByClub==='function'?playersByClub(clubId):(seed?.players||[]).filter(p=>Number(p.clubId)===Number(clubId))).filter(p=>p&&!p.retired&&!p.sold); }
  function pcTrust(playerId){ return pcClamp(typeof managerDressingRoomTrust==='function'?managerDressingRoomTrust(playerId):50,0,100); }
  function pcLeadership(){ return pcClamp(game?.managerStats?.careerProfile?.capabilities?.leadership??35,0,100); }
  function pcContractYearsRemaining(player,state=game){
    const end=Math.round(Number(player?.contractEndSeason||0));
    return end?Math.max(0,end-pcSeason(state)):0;
  }
  function pcDefaultYears(player,state=game){
    const min=Math.max(1,Math.round(Number(pcCfg('migracionAniosMin',2))));
    const max=Math.max(min,Math.round(Number(pcCfg('migracionAniosMax',4))));
    const age=Math.round(Number(player?.age||24));
    const ageCap=age>=37?1:age>=34?2:max;
    return Math.min(ageCap,min+pcHash(`contract-migration-${state?.saveCode||''}-${player?.id||0}-${pcSeason(state)}`,max-min+1));
  }
  function pcNormalizeContract(player,state=game){
    if(!player||player.retired||player.sold) return player;
    const clubId=Number(player.clubId||0);
    if(clubId<=0||player.freeAgent||player.youthFreeAgent){
      player.contractStartSeason=0; player.contractEndSeason=0; player.contractSignedDate='';
      return player;
    }
    const season=pcSeason(state);
    if(!Number.isFinite(Number(player.contractEndSeason))||Number(player.contractEndSeason)<season){
      const years=pcDefaultYears(player,state);
      player.contractStartSeason=season;
      player.contractEndSeason=season+years;
      player.contractSignedDate=String(state?.currentDate||'');
      player.contractSource=player.contractSource||'migration_v875';
    }
    player.contractStartSeason=Math.max(1,Math.round(Number(player.contractStartSeason||season)));
    player.contractEndSeason=Math.max(player.contractStartSeason,Math.round(Number(player.contractEndSeason||season)));
    player.contractRenewalAttempts=Math.max(0,Math.round(Number(player.contractRenewalAttempts||0)));
    player.contractRejectedUntil=validIsoDate(player.contractRejectedUntil)?player.contractRejectedUntil:'';
    return player;
  }
  function ensureAllPlayerContracts(state=game,options={}){
    if(pcCfg('activo',true)===false||!seed?.players||!state) return { normalized:0, skipped:true };
    state.playerContractsState=state.playerContractsState&&typeof state.playerContractsState==='object'?state.playerContractsState:{};
    const season=pcSeason(state);
    const signature=`${season}:${seed.players.length}`;
    if(options.force!==true && state.playerContractsState.normalizationSignature===signature){
      return { normalized:0, skipped:true, signature };
    }
    let normalized=0;
    seed.players.forEach(player=>{
      const before=`${player?.contractStartSeason||0}:${player?.contractEndSeason||0}`;
      pcNormalizeContract(player,state);
      if(before!==`${player?.contractStartSeason||0}:${player?.contractEndSeason||0}`) normalized++;
    });
    state.playerContractsState.version=PLAYER_CONTRACTS_VERSION;
    state.playerContractsState.normalizationSignature=signature;
    state.playerContractsState.lastNormalizationDate=String(state?.currentDate||'');
    return { normalized, skipped:false, signature };
  }
  window.ensureAllPlayerContracts=ensureAllPlayerContracts;

  function pcTrustDisposition(player){
    if(typeof managerDressingRoomRenewalDisposition==='function'){
      const shared=managerDressingRoomRenewalDisposition(player?.id);
      if(shared) return shared;
    }
    const trust=pcTrust(player?.id);
    if(trust>=85) return {code:'excellent',label:'Muy predispuesto',tone:'ok',factor:.98};
    if(trust>=70) return {code:'ready',label:'Predispuesto',tone:'ok',factor:1};
    if(trust>=50) return {code:'open',label:'Abierto a renovar',tone:'neutral',factor:1};
    if(trust>=35) return {code:'doubts',label:'Tiene dudas',tone:'warn',factor:1.05};
    if(trust>=20) return {code:'hard',label:'Renovación difícil',tone:'danger',factor:1.10};
    return {code:'refusal',label:'No quiere renovar',tone:'danger',factor:1.15};
  }
  function pcMaxYears(player){
    const trust=pcTrust(player.id);
    const rules=pcCfg('confianzaMaxAnios',[])||[];
    let years=1;
    for(const rule of rules){ if(trust>=Number(rule?.desde||0)){ years=Math.max(1,Math.round(Number(rule?.anios||1))); break; } }
    const age=Number(player?.age||24);
    if(age>=37) years=Math.min(years,1);
    else if(age>=34) years=Math.min(years,2);
    return Math.max(1,years);
  }
  function pcNegotiationWindow(player){
    const remaining=pcContractYearsRemaining(player);
    const maxYears=pcMaxYears(player);
    if(remaining>2) return {available:false,reason:'too_early',remaining,maxYears,minYears:remaining+1};
    const minYears=Math.max(1,remaining+1);
    if(maxYears<minYears) return {available:false,reason:'trust_limit',remaining,maxYears,minYears};
    return {available:true,reason:'available',remaining,maxYears,minYears};
  }
  function pcBaseDemand(player,years=1){
    const disposition=pcTrustDisposition(player);
    const current=Math.max(100000,Math.round(Number(player.salary||0)));
    const overall=typeof visibleOverall==='function'?Number(visibleOverall(player)||50):Number(player.overall||50);
    const played=Math.max(0,Number(game?.playerStats?.[player.id]?.played||0));
    const performance=pcClamp(.94+(overall-50)/230+Math.min(played,35)*.004,.90,1.32);
    const length=1+Math.max(0,Number(years||1)-1)*.018;
    const prior=Math.max(1,Number(player.contractNextDemandFactor||1));
    return Math.max(100000,Math.round(current*performance*disposition.factor*length*prior));
  }
  function pcOfferFactor(key){
    const value=Number(pcCfg(`ofertaSalarial.${key}`,key==='ajustada'?.95:key==='generosa'?1.10:1));
    return pcClamp(value,.75,1.35);
  }
  function pcOfferAmount(player,years,key){ return Math.max(100000,Math.round(pcBaseDemand(player,years)*pcOfferFactor(key))); }
  function pcAcceptanceChance(player,years,key){
    const trust=pcTrust(player.id);
    const maxYears=pcMaxYears(player);
    let chance=.22+trust*.0062+(pcLeadership()-35)*.0018;
    if(key==='ajustada') chance-=.18;
    if(key==='generosa') chance+=.17;
    if(years===maxYears&&years>=4) chance-=.04;
    if(trust<20) chance-=.20;
    else if(trust<35) chance-=.08;
    if(player.transferRequest) chance-=.12;
    chance-=Math.max(0,Number(player.contractRenewalAttempts||0))*.035;
    return pcClamp(chance,Number(pcCfg('probabilidadMinima',.08)),Number(pcCfg('probabilidadMaxima',.96)));
  }
  function pcContractBlocked(player){
    if(!validIsoDate(player?.contractRejectedUntil)||!validIsoDate(game?.currentDate)) return false;
    return daysBetweenIsoDates(game.currentDate,player.contractRejectedUntil)>0;
  }
  function pcSetDressingRenewal(player,status,amount,years,key,salaryBefore=null){
    const stint=typeof managerDressingRoomState==='function'?managerDressingRoomState():null;
    const entry=stint?.playerTrust?.[Number(player.id)];
    if(!entry) return;
    entry.renewal={season:pcSeason(),disposition:pcTrustDisposition(player).code,status,demandFactor:Number(player.contractNextDemandFactor||1),requestedTransfer:Boolean(player.transferRequest),salaryBefore:Number(salaryBefore??player.salary??0),salaryAfter:Number(amount||player.salary||0),years:Number(years||0),offerType:String(key||'')};
  }
  function pcApplyTrust(playerId,delta,reason){
    const stint=typeof managerDressingRoomState==='function'?managerDressingRoomState():null;
    const entry=stint?.playerTrust?.[Number(playerId)];
    if(!entry) return;
    entry.value=pcClamp(Number(entry.value||50)+Number(delta||0),0,100);
    entry.lastChange=Number(delta||0); entry.lastReason=reason; entry.updatedAt=String(game?.currentDate||'');
  }
  function negotiatePlayerContract(playerId,years,offerKey='recommended'){
    ensureAllPlayerContracts();
    const player=typeof playerById==='function'?playerById(playerId):null;
    if(!player||Number(player.clubId)!==Number(game?.selectedClubId)||game?.gameOver?.active) return {accepted:false,reason:'invalid'};
    const windowInfo=pcNegotiationWindow(player);
    if(!windowInfo.available){
      const message=windowInfo.reason==='too_early'?'Sólo podés negociar cuando resten dos temporadas o menos.':'El jugador todavía no acepta extender la vigencia actual. Mejorá su confianza o esperá a que se acerque el vencimiento.';
      showNotice(message,true); return {accepted:false,reason:windowInfo.reason};
    }
    if(pcContractBlocked(player)){ showNotice(`La negociación podrá retomarse el ${player.contractRejectedUntil}.`,true); return {accepted:false,reason:'blocked'}; }
    const maxYears=windowInfo.maxYears;
    const cleanYears=pcClamp(Math.round(Number(years||windowInfo.minYears)),windowInfo.minYears,maxYears);
    const key=['adjusted','recommended','generous'].includes(offerKey)?offerKey:'recommended';
    const map={adjusted:'ajustada',recommended:'recomendada',generous:'generosa'};
    const cfgKey=map[key];
    const amount=pcOfferAmount(player,cleanYears,cfgKey);
    const chance=pcAcceptanceChance(player,cleanYears,cfgKey);
    const attempt=Math.max(0,Number(player.contractRenewalAttempts||0));
    const roll=pcHash(`player-contract-${game?.saveCode||''}-${pcSeason()}-${player.id}-${attempt}-${cleanYears}-${cfgKey}-${game?.currentDate||''}`,10000)/10000;
    player.contractRenewalAttempts=attempt+1;
    if(roll<=chance){
      const oldSalary=Math.max(0,Number(player.salary||0));
      player.salary=amount;
      player.contractStartSeason=pcSeason();
      player.contractEndSeason=pcSeason()+cleanYears;
      player.contractSignedDate=String(game?.currentDate||'');
      player.contractSource='manual_renewal';
      player.contractRejectedUntil='';
      player.contractNextDemandFactor=1;
      player.transferRequest=false;
      if(typeof refreshPlayerClause==='function') refreshPlayerClause(player);
      pcApplyTrust(player.id,1,'La renovación reforzó su relación con el club');
      pcSetDressingRenewal(player,'renewed',amount,cleanYears,cfgKey,oldSalary);
      if(typeof pushGameMessage==='function') pushGameMessage({type:'deportivo',priority:'normal',title:'Contrato renovado',body:`${player.name} renovó por ${cleanYears} temporada(s), con un sueldo anual de ${formatMoney(amount)}.`,id:`player-renewal-${pcSeason()}-${player.id}-${player.contractEndSeason}`});
      if(typeof saveLocal==='function') saveLocal(true);
      if(typeof renderFirstTeam==='function') renderFirstTeam();
      showNotice(`${playerLastName(player.name)} aceptó la renovación.`);
      return {accepted:true,amount,years:cleanYears,chance,oldSalary};
    }
    const days=Math.max(1,Math.round(Number(pcCfg('bloqueoTrasRechazoDias',7))));
    player.contractRejectedUntil=addDaysToIsoDate(game.currentDate||currentCalendarDate(),days);
    player.contractNextDemandFactor=pcClamp(Number(player.contractNextDemandFactor||1)+.04,1,1.35);
    pcApplyTrust(player.id,-1,'Rechazó una propuesta de renovación');
    pcSetDressingRenewal(player,'rejected',amount,cleanYears,cfgKey);
    if(typeof pushGameMessage==='function') pushGameMessage({type:'deportivo',priority:'high',title:'Renovación rechazada',body:`${player.name} rechazó la propuesta. La negociación podrá retomarse el ${player.contractRejectedUntil}.`,id:`player-renewal-rejected-${pcSeason()}-${player.id}-${player.contractRenewalAttempts}`});
    if(typeof saveLocal==='function') saveLocal(true);
    if(typeof renderFirstTeam==='function') renderFirstTeam();
    showNotice(`${playerLastName(player.name)} rechazó la propuesta.`,true);
    return {accepted:false,amount,years:cleanYears,chance,roll};
  }
  window.negotiatePlayerContract=negotiatePlayerContract;

  function pcOpenNegotiation(playerId){
    const player=typeof playerById==='function'?playerById(playerId):null;
    if(!player) return;
    const windowInfo=pcNegotiationWindow(player);
    if(!windowInfo.available){
      const message=windowInfo.reason==='too_early'?'Sólo podés negociar cuando resten dos temporadas o menos.':'El jugador todavía no acepta extender la vigencia actual. Mejorá su confianza o esperá a que se acerque el vencimiento.';
      showNotice(message,true); return;
    }
    if(pcContractBlocked(player)){ showNotice(`La negociación podrá retomarse el ${player.contractRejectedUntil}.`,true); return; }
    const disposition=pcTrustDisposition(player);
    const maxYears=windowInfo.maxYears;
    const yearOptions=Array.from({length:maxYears-windowInfo.minYears+1},(_,i)=>windowInfo.minYears+i).map(year=>`<option value="${year}">${year} temporada${year===1?'':'s'}</option>`).join('');
    const body=`<div class="player-contract-modal"><p class="label">Renovación contractual</p><h2>${escapeHtml(player.name)}</h2><div class="grid cols-3"><div class="card"><p class="label">Contrato actual</p><strong>Hasta T${Number(player.contractEndSeason||pcSeason())}</strong><span class="small muted">${pcContractYearsRemaining(player)} temporada(s) futura(s)</span></div><div class="card"><p class="label">Confianza</p><strong>${Math.round(pcTrust(player.id))}/100</strong><span class="${disposition.tone}">${escapeHtml(disposition.label)}</span></div><div class="card"><p class="label">Sueldo anual</p><strong>${formatMoney(player.salary||0)}</strong><span class="small muted">Máximo ofrecido: ${maxYears} año(s)</span></div></div><div class="card contract-negotiation-form"><label>Duración<select id="playerContractYears">${yearOptions}</select></label><label>Propuesta salarial<select id="playerContractOffer"><option value="adjusted">Ajustada · menor coste, más riesgo</option><option value="recommended" selected>Recomendada · equilibrio</option><option value="generous">Generosa · mayor posibilidad</option></select></label><div id="playerContractPreview"></div><button id="confirmPlayerContract" class="primary full">Enviar propuesta</button></div></div>`;
    openModal(body);
    const refresh=()=>{
      const years=Number($('playerContractYears')?.value||1);
      const key=String($('playerContractOffer')?.value||'recommended');
      const map={adjusted:'ajustada',recommended:'recomendada',generous:'generosa'};
      const amount=pcOfferAmount(player,years,map[key]);
      const chance=pcAcceptanceChance(player,years,map[key]);
      const preview=$('playerContractPreview');
      if(preview) preview.innerHTML=`<div class="contract-preview-line"><span>Sueldo propuesto</span><strong>${formatMoney(amount)}</strong></div><div class="contract-preview-line"><span>Posibilidad estimada</span><strong>${Math.round(chance*100)}%</strong></div><p class="muted small">El descontento eleva la exigencia y limita la duración. Una relación positiva permite contratos más largos.</p>`;
    };
    $('playerContractYears')?.addEventListener('change',refresh);
    $('playerContractOffer')?.addEventListener('change',refresh);
    $('confirmPlayerContract')?.addEventListener('click',()=>{ const years=Number($('playerContractYears')?.value||1); const key=String($('playerContractOffer')?.value||'recommended'); closeModal(); negotiatePlayerContract(player.id,years,key); });
    refresh();
  }

  window.openPlayerContractNegotiation=pcOpenNegotiation;

  function pcSortPlayers(players){
    const byName=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es');
    const sorters={
      expiry_asc:(a,b)=>Number(a.contractEndSeason||0)-Number(b.contractEndSeason||0)||byName(a,b),
      expiry_desc:(a,b)=>Number(b.contractEndSeason||0)-Number(a.contractEndSeason||0)||byName(a,b),
      trust_asc:(a,b)=>pcTrust(a.id)-pcTrust(b.id)||byName(a,b),
      trust_desc:(a,b)=>pcTrust(b.id)-pcTrust(a.id)||byName(a,b),
      salary_asc:(a,b)=>Number(a.salary||0)-Number(b.salary||0)||byName(a,b),
      salary_desc:(a,b)=>Number(b.salary||0)-Number(a.salary||0)||byName(a,b),
      age_asc:(a,b)=>Number(a.age||0)-Number(b.age||0)||byName(a,b),
      age_desc:(a,b)=>Number(b.age||0)-Number(a.age||0)||byName(a,b),
      overall_asc:(a,b)=>(typeof visibleOverall==='function'?visibleOverall(a):Number(a.overall||0))-(typeof visibleOverall==='function'?visibleOverall(b):Number(b.overall||0))||byName(a,b),
      overall_desc:(a,b)=>(typeof visibleOverall==='function'?visibleOverall(b):Number(b.overall||0))-(typeof visibleOverall==='function'?visibleOverall(a):Number(a.overall||0))||byName(a,b),
      name_asc:byName,name_desc:(a,b)=>-byName(a,b)
    };
    return players.slice().sort(sorters[playerContractsSort]||sorters.expiry_asc);
  }
  function pcSortHeader(label,asc,desc){ return typeof compactSortButtons==='function'?compactSortButtons(label,[[asc,'Menor a mayor'],[desc,'Mayor a menor']],playerContractsSort,'data-player-contract-sort'):label; }
  function renderPlayerContracts(){
    ensureAllPlayerContracts();
    if(typeof managerDressingRoomState === 'function') managerDressingRoomState();
    const squad=pcSortPlayers(pcPlayers(game.selectedClubId));
    const current=pcSeason();
    const expiring=squad.filter(p=>Number(p.contractEndSeason||0)<=current).length;
    const next=squad.filter(p=>Number(p.contractEndSeason||0)===current+1).length;
    const rows=squad.map(player=>{
      const disposition=pcTrustDisposition(player);
      const blocked=pcContractBlocked(player);
      const remaining=pcContractYearsRemaining(player);
      const windowInfo=pcNegotiationWindow(player);
      const action=!windowInfo.available
        ? `<span class="muted">Vigente</span><small>${windowInfo.reason==='too_early'?'Negociable con 2 años o menos':'Debe acercarse al vencimiento o mejorar su confianza'}</small>`
        : blocked?`<span class="warn">Rechazada</span><small>Hasta ${escapeHtml(player.contractRejectedUntil)}</small>`:`<button class="ghost" data-renew-player="${player.id}">Negociar</button>`;
      const overall=typeof visibleOverall==='function'?visibleOverall(player):Number(player.overall||0);
      return `<tr><td>${typeof faceImg==='function'?faceImg(player,'photo-thumb'):''}</td><td><button class="linklike" data-player-id="${player.id}"><strong>${typeof playerNameWithStar==='function'?playerNameWithStar(player):escapeHtml(player.name||'')}</strong></button><small>${escapeHtml(player.position||'')}</small></td><td><strong>${Number(player.age||0)}</strong></td><td><strong>${overall}</strong></td><td><strong>T${Number(player.contractEndSeason||current)}</strong><small>${remaining===0?'Vence al cierre':`${remaining} temporada(s) futura(s)`}</small></td><td><strong>${formatMoney(player.salary||0)}</strong></td><td><strong>${Math.round(pcTrust(player.id))}</strong><small class="${disposition.tone}">${escapeHtml(disposition.label)}</small></td><td>${action}</td></tr>`;
    }).join('');
    view.innerHTML=`<div class="section-title"><h2>Contratos del plantel</h2><p class="tagline">Las renovaciones del club dirigido son manuales. La confianza modifica salario, aceptación y duración máxima.</p></div><div class="grid cols-3 contract-summary-grid"><div class="card"><p class="label">Vencen esta temporada</p><strong>${expiring}</strong></div><div class="card"><p class="label">Vencen la próxima</p><strong>${next}</strong></div><div class="card"><p class="label">Masa salarial anual</p><strong>${formatMoney(squad.reduce((s,p)=>s+Number(p.salary||0),0))}</strong></div></div><div class="card contract-rule-note"><p><strong>Importante:</strong> al cerrar la temporada, los contratos vencidos no renovados pasan al mercado de libres. Los clubes bots renuevan automáticamente.</p></div><div class="table-wrap player-contract-table-wrap"><table><thead><tr><th>Foto</th><th>${pcSortHeader('Jugador','name_asc','name_desc')}</th><th>${pcSortHeader('Edad','age_asc','age_desc')}</th><th>${pcSortHeader('Media','overall_asc','overall_desc')}</th><th>${pcSortHeader('Contrato','expiry_asc','expiry_desc')}</th><th>${pcSortHeader('Sueldo','salary_asc','salary_desc')}</th><th>${pcSortHeader('Confianza','trust_asc','trust_desc')}</th><th>Acción</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="muted">No hay jugadores en el plantel.</td></tr>'}</tbody></table></div>`;
    if(typeof prependFirstTeamTabs==='function') prependFirstTeamTabs('contracts');
    document.querySelectorAll('[data-renew-player]').forEach(btn=>btn.addEventListener('click',()=>pcOpenNegotiation(Number(btn.dataset.renewPlayer))));
    document.querySelectorAll('[data-player-contract-sort]').forEach(btn=>btn.addEventListener('click',()=>{playerContractsSort=btn.dataset.playerContractSort||'expiry_asc';renderPlayerContracts();}));
  }
  window.renderPlayerContracts=renderPlayerContracts;

  function pcGroupLabel(group){ return {starter:'Titulares',rotation:'Rotación',substitute:'Suplentes',youth:'Juveniles',referent:'Referentes'}[group]||group; }
  function pcGroupPlayerCard(player,entry){
    const tags=[]; if(entry?.tags?.includes('captain')) tags.push('Capitán'); if(entry?.tags?.includes('referent')) tags.push('Referente');
    return `<button class="tactic-group-player" data-player-id="${player.id}">${typeof faceImg==='function'?faceImg(player,'drag-face'):''}<span><strong>${escapeHtml(playerLastName(player.name||''))}</strong><small>${escapeHtml(player.position||'')} · ${Number(player.age||0)} años · Media ${typeof visibleOverall==='function'?visibleOverall(player):player.overall||0} · Conf. ${Math.round(Number(entry?.value||50))}</small>${tags.length?`<em>${escapeHtml(tags.join(' · '))}</em>`:''}</span></button>`;
  }
  function renderTacticGroups(){
    if(typeof ensureAllPlayerContracts==='function') ensureAllPlayerContracts();
    const stint=typeof managerDressingRoomState==='function'?managerDressingRoomState():null;
    const entries=stint?.playerTrust||{};
    const squad=pcPlayers(game.selectedClubId);
    const groups={referent:[],starter:[],rotation:[],substitute:[],youth:[]};
    squad.forEach(player=>{
      const entry=entries[Number(player.id)]||{primaryGroup:'substitute',tags:[],value:50};
      if(entry.tags?.includes('referent')) groups.referent.push({player,entry});
      const key=['starter','rotation','substitute','youth'].includes(entry.primaryGroup)?entry.primaryGroup:'substitute';
      groups[key].push({player,entry});
    });
    Object.values(groups).forEach(list=>list.sort((a,b)=>Number(b.entry.influence||0)-Number(a.entry.influence||0)||(typeof visibleOverall==='function'?visibleOverall(b.player)-visibleOverall(a.player):0)||String(a.player.name).localeCompare(String(b.player.name),'es')));
    const cards=['referent','starter','rotation','substitute','youth'].map(key=>`<section class="card tactic-group-card"><div class="row"><div><p class="label">${pcGroupLabel(key)}</p><h3>${groups[key].length} jugador(es)</h3></div><span class="pill">Conf. ${Math.round(Number(stint?.groupTrust?.[key]?.value||0))}</span></div><div class="tactic-group-list">${groups[key].map(item=>pcGroupPlayerCard(item.player,item.entry)).join('')||'<p class="muted small">Sin jugadores en este grupo.</p>'}</div></section>`).join('');
    view.innerHTML=`<div class="section-title"><h2>Grupos del plantel</h2><p class="tagline">Vista táctica de referentes, titulares, rotación, suplentes y juveniles. Los grupos se actualizan según convocatoria, minutos, edad e influencia.</p></div><div class="tactic-groups-grid">${cards}</div>`;
    if(typeof prependFirstTeamTabs==='function') prependFirstTeamTabs('groups');
  }
  window.renderTacticGroups=renderTacticGroups;

  function pcAutoRenewBotPlayer(player,previousSeason){
    const min=Math.max(1,Math.round(Number(pcCfg('renovacionBotAniosMin',1))));
    const max=Math.max(min,Math.round(Number(pcCfg('renovacionBotAniosMax',4))));
    const age=Number(player.age||24);
    let cap=age>=37?1:age>=34?2:max;
    const years=Math.min(cap,min+pcHash(`bot-renew-${game?.saveCode||''}-${previousSeason}-${player.id}`,max-min+1));
    // El salario de los bots ya se ajusta una vez por temporada según rendimiento
    // en applySeasonSalaryAdjustments(). La renovación sólo extiende la vigencia.
    player.contractStartSeason=previousSeason+1;
    player.contractEndSeason=previousSeason+years;
    player.contractSignedDate=String(game?.currentDate||'');
    player.contractSource='bot_auto_renewal';
    player.contractRenewalAttempts=0; player.contractRejectedUntil=''; player.contractNextDemandFactor=1;
    if(typeof refreshPlayerClause==='function') refreshPlayerClause(player);
  }
  function pcReleaseExpiredPlayer(player,previousSeason){
    const previousClubId=Number(player?.clubId||0);
    if(typeof cleanTacticPlayerReferences==='function') cleanTacticPlayerReferences(game.tactic,player.id);
    if(typeof setPlayerClubId==='function') setPlayerClubId(player,0); else player.clubId=0;
    player.freeAgent=true; player.youthFreeAgent=false; player.transferListed=false; player.intransferible=false; player.sold=false;
    player.contractStartSeason=0; player.contractEndSeason=0; player.contractSignedDate=''; player.contractSource='expired';
    player.contractRenewalAttempts=0; player.contractRejectedUntil=''; player.contractNextDemandFactor=1;
    game.marketPlayers=Array.isArray(game.marketPlayers)?game.marketPlayers:[];
    if(!game.marketPlayers.some(item=>Number(item.id)===Number(player.id))) game.marketPlayers.push(player);
    if(game.playerCondition) game.playerCondition[player.id]=5;
    if(game.playerMorale) game.playerMorale[player.id]=5;
    if(typeof recordTransferHistory==='function') recordTransferHistory(player,{fromClubId:previousClubId,toClubId:0,amount:0,kind:'contract_expiry',source:'expired_contract',season:Number(game?.seasonNumber||previousSeason+1)});
    return player;
  }
  function processPlayerContractSeasonTransition(previousSeason,options={}){
    const expiringIds=new Set((seed?.players||[]).filter(player=>player&&!player.retired&&!player.sold&&Number(player.clubId||0)>0&&Number(player.contractEndSeason||0)<=Number(previousSeason)).map(player=>Number(player.id)));
    if(options.skipEnsure!==true) ensureAllPlayerContracts();
    const managerClub=Number(game?.selectedClubId||0);
    const released=[]; let botsRenewed=0;
    (seed?.players||[]).forEach(player=>{
      if(!player||!expiringIds.has(Number(player.id))||player.retired||player.sold||Number(player.clubId||0)<=0) return;
      if(Number(player.clubId)===managerClub) released.push(pcReleaseExpiredPlayer(player,previousSeason));
      else { pcAutoRenewBotPlayer(player,previousSeason); botsRenewed++; }
    });
    if(released.length&&typeof pushGameMessage==='function'){
      const names=released.slice(0,5).map(p=>playerLastName(p.name)).join(', ');
      const extra=released.length>5?` y ${released.length-5} más`:'';
      pushGameMessage({type:'deportivo',priority:'high',title:'Contratos finalizados',body:`${names}${extra} dejaron el club al vencer sus contratos sin renovación.`,id:`expired-player-contracts-${previousSeason}-${managerClub}`});
    }
    return {released,botsRenewed};
  }
  window.processPlayerContractSeasonTransition=processPlayerContractSeasonTransition;

  function pcDismissForRosterShortage(issues,day){
    if(!game||game.gameOver?.active) return false;
    const clubId=Number(game.selectedClubId||0);
    if(typeof managerFinalizeClubLegacyContribution==='function') managerFinalizeClubLegacyContribution('dismissal',{reason:'roster_shortage',day,issues});
    game.gameOver={active:true,type:'dismissal',reason:'La directiva rescindió el contrato por no presentar un plantel reglamentario.',triggeredAt:new Date().toISOString(),snapshot:typeof gameOverSnapshot==='function'?gameOverSnapshot():null};
    game.mustReviewTactics=false;
    if(typeof stopAdvanceAutoClicker==='function') stopAdvanceAutoClicker('falta de jugadores');
    if(typeof archiveManagerPlayerStatsClub==='function') archiveManagerPlayerStatsClub(clubId,{final:true});
    if(typeof clearScoutedSigningChances==='function') clearScoutedSigningChances();
    if(typeof prepareManagerWithoutClubUi==='function') prepareManagerWithoutClubUi('dismissal');
    if(typeof recordDismissedCareerStep==='function') recordDismissedCareerStep();
    if(typeof archiveManagerJobContract==='function') archiveManagerJobContract('despido',game);
    if(typeof resetOutgoingClubStateAfterManagerExit==='function') resetOutgoingClubStateAfterManagerExit(clubId,'dismissal');
    if(typeof pushGameMessage==='function') pushGameMessage({type:'directiva',priority:'high',title:'Despido por plantel incompleto',body:`La directiva te despidió en el día ${day} porque el club no alcanzó la cantidad y distribución mínima de jugadores para iniciar la competición.`,id:`roster-dismissal-${pcSeason()}-${clubId}`});
    if(typeof queueAutomaticRankingSubmission==='function') queueAutomaticRankingSubmission('dismissal');
    if(typeof saveLocal==='function') saveLocal(true);
    if(typeof renderAll==='function') renderAll();
    return true;
  }
  function processManagerRosterComplianceDaily(){
    if(!game||game.gameOver?.active||game.founderMode||game.challenge) return {active:false};
    const day=pcDay();
    const warnDay=Math.max(1,Math.round(Number(pcCfg('avisoPlantelDesdeDia',10))));
    const dismissalDay=Math.max(warnDay+1,Math.round(Number(pcCfg('despidoPlantelDia',29))));
    const currentStint=game?.managerStats?.currentSeason?.careerStintId||'';
    const baseline=game?.managerCareerBaselines?.[currentStint]||(typeof ensureManagerCareerBaseline==='function'?ensureManagerCareerBaseline():null);
    const joinedDay=Math.max(1,Math.round(Number(baseline?.joinedDay||1)));
    // El control pertenece a la preparación inicial. Un mánager contratado con la temporada avanzada no hereda este despido.
    if(joinedDay>warnDay) return {active:false,day,reason:'joined_after_start_control'};
    if(day<warnDay) return {active:false,day};
    const issues=typeof clubRequirementIssues==='function'?clubRequirementIssues(game.selectedClubId):[];
    if(!issues.length) return {active:false,day,compliant:true};
    if(day>=dismissalDay){ return {active:true,day,issues,dismissed:pcDismissForRosterShortage(issues,day)}; }
    if(typeof pushGameMessage==='function') pushGameMessage({type:'directiva',priority:'high',title:'Plantel insuficiente',body:`Día ${day}: ${issues.join('; ')}. Debés completar el plantel antes del día ${dismissalDay}; de lo contrario serás despedido.`,id:`roster-warning-${pcSeason()}-${game.selectedClubId}-${day}`});
    return {active:true,day,issues,dismissed:false};
  }
  window.processManagerRosterComplianceDaily=processManagerRosterComplianceDaily;

  function pcInstallHooks(){
    if(typeof normalizeGame==='function'){
      const original=normalizeGame;
      normalizeGame=function(saved){ const normalized=original(saved); ensureAllPlayerContracts(normalized); return normalized; };
    }
    if(typeof newGame==='function'){
      const original=newGame;
      newGame=function(...args){ const result=original.apply(this,args); ensureAllPlayerContracts(game); if(typeof saveLocal==='function') saveLocal(true); return result; };
    }
    if(typeof startNextSeason==='function'){
      const original=startNextSeason;
      startNextSeason=function(...args){
        const previous=pcSeason();
        const shouldTransition=Boolean(game?.seasonFinalized);
        const result=original.apply(this,args);
        const transitioned=Boolean(shouldTransition&&game&&pcSeason()===previous+1);
        if(transitioned) processPlayerContractSeasonTransition(previous,{skipEnsure:true});
        ensureAllPlayerContracts(game);
        if(transitioned&&typeof saveLocal==='function') saveLocal(true);
        if(transitioned&&typeof renderAll==='function') renderAll();
        return result;
      };
    }
    if(typeof processDailyCalendarState==='function'){
      const original=processDailyCalendarState;
      processDailyCalendarState=function(dateAfter='',options={}){ const result=original(dateAfter,options)||{}; ensureAllPlayerContracts(game); result.rosterCompliance=processManagerRosterComplianceDaily(); return result; };
    }
    if(typeof firstTeamTabsMarkup==='function'){
      const original=firstTeamTabsMarkup;
      firstTeamTabsMarkup=function(current){
        let html=original(current);
        const groups=`<button class="${current==='groups'?'active':''}" data-first-team-tab="groups">Grupos</button>`;
        const contracts=`<button class="${current==='contracts'?'active':''}" data-first-team-tab="contracts">Contratos</button>`;
        html=html.replace(/(<button[^>]*data-first-team-tab="tactics"[^>]*>Táctica<\/button>)/,`$1${groups}`);
        return html.replace('</div></div>',`${contracts}</div></div>`);
      };
    }
    if(typeof renderFirstTeam==='function'){
      const original=renderFirstTeam;
      renderFirstTeam=function(){ if(firstTeamTab==='groups') return renderTacticGroups(); if(firstTeamTab==='contracts') return renderPlayerContracts(); return original(); };
    }
    if(typeof showPlayerModal==='function'){
      const original=showPlayerModal;
      showPlayerModal=function(playerId){
        const result=original(playerId);
        const player=typeof playerById==='function'?playerById(playerId):null;
        if(!player||Number(player.clubId)!==Number(game?.selectedClubId)) return result;
        pcNormalizeContract(player);
        const disposition=pcTrustDisposition(player);
        const windowInfo=pcNegotiationWindow(player);
        const blocked=pcContractBlocked(player);
        const metrics=document.querySelector('.player-modal-landscape .player-profile-metrics');
        if(metrics&&!metrics.querySelector('.player-contract-metric')){
          const salaryMetric=[...metrics.children].find(node=>String(node.querySelector('span')?.textContent||'').trim().toLowerCase()==='salario');
          const target=salaryMetric||metrics.lastElementChild;
          if(target){
            const remaining=pcContractYearsRemaining(player);
            target.classList.add('player-contract-metric');
            target.insertAdjacentHTML('beforeend',`<small>Contrato hasta T${Number(player.contractEndSeason||pcSeason())} · ${remaining===0?'vence al cierre':`${remaining} temp. futura(s)`} · ${escapeHtml(disposition.label)}</small>`);
          }
        }
        const actionCard=document.querySelector('.player-modal-landscape .player-action-card');
        const actions=actionCard?.querySelector('.message-actions');
        if(actions&&!actions.querySelector('[data-modal-renew-player]')&&!actions.querySelector('[data-modal-renew-disabled]')){
          let label='Negociar renovación';
          let title=`Contrato hasta T${Number(player.contractEndSeason||pcSeason())}. ${disposition.label}.`;
          let disabled=false;
          if(blocked){
            label=`Retomar ${player.contractRejectedUntil}`;
            title=`La propuesta anterior fue rechazada. Podés retomar la negociación el ${player.contractRejectedUntil}.`;
            disabled=true;
          }else if(!windowInfo.available){
            disabled=true;
            if(windowInfo.reason==='too_early'){
              label='Contrato aún vigente';
              title='La renovación se habilita cuando resten dos temporadas o menos.';
            }else{
              label='Mejorar confianza';
              title='La confianza actual no permite ofrecer una extensión superior a la vigencia existente.';
            }
          }
          actions.insertAdjacentHTML('beforeend',`<button class="${disabled?'ghost':'primary'}" type="button" ${disabled?'disabled data-modal-renew-disabled="1"':`data-modal-renew-player="${player.id}"`} title="${escapeHtml(title)}">${escapeHtml(label)}</button>`);
          actions.querySelector('[data-modal-renew-player]')?.addEventListener('click',event=>{
            event.stopPropagation();
            closeModal();
            pcOpenNegotiation(player.id);
          });
        }
        return result;
      };
    }
  }

  pcInstallHooks();
  const playerContractsApi={ensure:ensureAllPlayerContracts,render:renderPlayerContracts,groups:renderTacticGroups,negotiate:negotiatePlayerContract,openNegotiation:pcOpenNegotiation,transition:processPlayerContractSeasonTransition,rosterCheck:processManagerRosterComplianceDaily};
  window.PLAYER_CONTRACTS_V875=playerContractsApi;
  window.PLAYER_CONTRACTS_V877=playerContractsApi;
})();
