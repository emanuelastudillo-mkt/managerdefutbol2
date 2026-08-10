/* V8.86 · Auditoría determinista del calendario actual.
   Reconstruye partidos de liga faltantes, reconcilia resultados con el historial,
   elimina duplicados y reprograma encuentros atrasados en martes sin cruces de club. */

(function(){
  const CALENDAR_INTEGRITY_VERSION = 6;
  const MAX_LOG_ENTRIES = 30;
  const MAX_SEARCH_WEEKS = 120;
  let ciDailyTransactionDepth = 0;
  const ciCanonicalCache = new WeakMap();

  function ciState(target=game){ return target && typeof target === 'object' ? target : null; }
  function ciNumber(value, fallback=0){ const n=Number(value); return Number.isFinite(n) ? n : fallback; }
  function ciClone(value){
    if(value == null) return value;
    if(typeof structuredClone === 'function'){
      try{ return structuredClone(value); }catch(_error){}
    }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_error){ return value; }
  }
  function ciValidDate(value){ return typeof validIsoDate === 'function' ? validIsoDate(value) : /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
  function ciUtc(iso){
    if(!ciValidDate(iso)) return null;
    const [year,month,day]=String(iso).slice(0,10).split('-').map(Number);
    return new Date(Date.UTC(year, month-1, day));
  }
  function ciIso(date){ return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0,10) : ''; }
  function ciAddDays(iso, days){
    if(typeof addDaysToIsoDate === 'function') return addDaysToIsoDate(iso, days);
    const date=ciUtc(iso);
    if(!date) return '';
    date.setUTCDate(date.getUTCDate()+Math.round(ciNumber(days,0)));
    return ciIso(date);
  }
  function ciCompareDates(left,right){
    const a=ciUtc(left), b=ciUtc(right);
    if(!a || !b) return 0;
    return a.getTime()-b.getTime();
  }
  function ciBefore(left,right){ return ciCompareDates(left,right)<0; }
  function ciNextTuesday(fromIso, includeToday=true){
    const date=ciUtc(fromIso);
    if(!date) return '';
    let add=(2-date.getUTCDay()+7)%7;
    if(add===0 && !includeToday) add=7;
    date.setUTCDate(date.getUTCDate()+add);
    return ciIso(date);
  }
  function ciMatchDate(match, round){
    if(ciValidDate(match?.date)) return String(match.date).slice(0,10);
    if(ciValidDate(match?.roundDate)) return String(match.roundDate).slice(0,10);
    if(ciValidDate(round?.date)) return String(round.date).slice(0,10);
    if(ciValidDate(round?.startDate)) return String(round.startDate).slice(0,10);
    return '';
  }
  function ciIsSpecialRound(round){
    if(typeof fixtureRoundIsPersistentCompetition === 'function') return fixtureRoundIsPersistentCompetition(round);
    return Boolean(
      round?.playoffRound || round?.clubWorldCupRound || round?.nationalCupRound || round?.libertadoresRound || round?.championsLeagueRound ||
      (round?.matches || []).some(match => match?.playoff || match?.clubWorldCup || match?.nationalCup || match?.libertadores || match?.championsLeague || match?.friendly)
    );
  }
  function ciIsRegularMatch(match, round){
    return Boolean(match && !match.friendly && !match.playoff && !match.clubWorldCup && !match.nationalCup && !match.libertadores && !match.championsLeague && !ciIsSpecialRound(round));
  }
  function ciPairKey(match){
    if(!match) return '';
    return `${String(match.divisionId || '')}|${ciNumber(match.homeId)}|${ciNumber(match.awayId)}`;
  }
  function ciMatchKey(match){ return String(match?.id || '').trim() || ciPairKey(match); }
  function ciLeagueRoundNumber(match){
    const id=String(match?.id || '');
    const found=id.match(/-j(\d+)-/i);
    return found ? Math.max(0, Math.round(Number(found[1] || 0))) : 0;
  }
  function ciHistoryMaps(state){
    const byId=new Map();
    const byPair=new Map();
    (Array.isArray(state?.matchHistory) ? state.matchHistory : []).forEach(record => {
      if(!record?.played) return;
      const id=String(record.id || '').trim();
      const pair=ciPairKey(record);
      if(id && !byId.has(id)) byId.set(id, record);
      if(pair && !byPair.has(pair)) byPair.set(pair, record);
    });
    return { byId, byPair };
  }
  function ciPlayedEvidence(match, historyMaps){
    const id=String(match?.id || '').trim();
    return (id && historyMaps.byId.get(id)) || historyMaps.byPair.get(ciPairKey(match)) || null;
  }
  function ciRestorePlayedFixture(match, history){
    if(!match || !history?.played) return false;
    const keep={
      id:match.id,
      matchday:match.matchday,
      divisionId:match.divisionId,
      divisionName:match.divisionName,
      homeId:match.homeId,
      awayId:match.awayId,
      date:match.date || history.date,
      roundDate:match.roundDate || history.roundDate
    };
    Object.assign(match, ciClone(history), keep, {
      played:true,
      calendarIntegrityRestored:true,
      calendarIntegrityRestoredFrom:'matchHistory'
    });
    return true;
  }
  function ciFixtureRegistry(state){
    const byId=new Map();
    const byPair=new Map();
    const locations=[];
    (state.fixtures || []).forEach((round, roundIndex) => {
      (round?.matches || []).forEach((match, matchIndex) => {
        const location={ round, roundIndex, match, matchIndex };
        locations.push(location);
        const id=String(match?.id || '').trim();
        const pair=ciPairKey(match);
        if(id){
          if(!byId.has(id)) byId.set(id, []);
          byId.get(id).push(location);
        }
        if(pair){
          if(!byPair.has(pair)) byPair.set(pair, []);
          byPair.get(pair).push(location);
        }
      });
    });
    return { byId, byPair, locations };
  }
  function ciMatchQuality(match){
    let score=0;
    if(match?.played) score+=1000;
    if(Number.isFinite(Number(match?.homeGoals)) && Number.isFinite(Number(match?.awayGoals))) score+=200;
    if(Array.isArray(match?.goals) && match.goals.length) score+=50;
    if(match?.matchStats) score+=30;
    if(ciValidDate(match?.date)) score+=10;
    if(match?.calendarIntegrityRestored) score-=1;
    return score;
  }
  function ciRemoveDuplicateFixtures(state, historyMaps){
    const registry=ciFixtureRegistry(state);
    const removals=new Map();
    let duplicatesRemoved=0;
    let historyRestored=0;
    registry.byId.forEach((locations,id) => {
      if(locations.length<2) return;
      locations.sort((a,b)=>ciMatchQuality(b.match)-ciMatchQuality(a.match) || a.roundIndex-b.roundIndex || a.matchIndex-b.matchIndex);
      const keeper=locations[0];
      const evidence=historyMaps.byId.get(id);
      if(!keeper.match.played && evidence?.played && ciRestorePlayedFixture(keeper.match,evidence)) historyRestored+=1;
      locations.slice(1).forEach(location => {
        if(!removals.has(location.round)) removals.set(location.round,new Set());
        removals.get(location.round).add(location.match);
        duplicatesRemoved+=1;
      });
    });
    removals.forEach((matches,round) => { round.matches=(round.matches || []).filter(match => !matches.has(match)); });
    state.fixtures=state.fixtures.filter(round => (round?.matches || []).length || !round?.calendarRecoveryRound);
    return { duplicatesRemoved, historyRestored };
  }
  function ciCanonicalRegular(state){
    if(state?.challenge?.active && state.challenge.completed !== true) return [];
    if(typeof generateFixturesForDivisions !== 'function' || !seed?.clubs?.length) return [];
    const season=Math.max(1,Math.round(ciNumber(state?.seasonNumber,1)));
    const year=Math.round(ciNumber(state?.seasonYear,0)) || (typeof seasonYearForNumber === 'function' ? seasonYearForNumber(season) : new Date().getUTCFullYear());
    const fixtureSeedIndex=typeof normalizeLeagueFixtureSeedIndex === 'function' ? normalizeLeagueFixtureSeedIndex(state?.leagueFixtureSeedIndex) : null;
    const cached=ciCanonicalCache.get(state);
    if(cached && Number(cached.season)===season && Number(cached.year)===year && cached.fixtureSeedIndex===fixtureSeedIndex && Array.isArray(cached.rounds)) return ciClone(cached.rounds);
    const divisions=typeof divisionOrderList === 'function' ? divisionOrderList() : (seed?.divisions || []);
    try{
      const generated=generateFixturesForDivisions(seed.clubs, divisions, { seasonYear:year, fixtureSeedIndex }) || [];
      ciCanonicalCache.set(state,{season,year,fixtureSeedIndex,rounds:ciClone(generated)});
      return generated;
    }catch(error){
      console.error('V8.85: no se pudo generar el calendario canónico de la temporada actual', error);
      return [];
    }
  }
  function ciCanonicalMaps(rounds){
    const byId=new Map();
    const byPair=new Map();
    (rounds || []).forEach((round,roundIndex) => (round.matches || []).forEach(match => {
      const item={ round, roundIndex, match, expectedDate:ciMatchDate(match,round) };
      if(match.id) byId.set(String(match.id),item);
      byPair.set(ciPairKey(match),item);
    }));
    return { byId, byPair };
  }
  function ciExistingRegularMaps(state){
    const byId=new Map();
    const byPair=new Map();
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(match => {
      if(!ciIsRegularMatch(match,round)) return;
      if(match.id && !byId.has(String(match.id))) byId.set(String(match.id),{match,round});
      const pair=ciPairKey(match);
      if(pair && !byPair.has(pair)) byPair.set(pair,{match,round});
    }));
    return {byId,byPair};
  }
  function ciFindOrCreateRound(state,date,options={}){
    const id=String(options.id || `calendar-recovery-${state.seasonNumber || 1}-${date}`);
    let round=(state.fixtures || []).find(item => String(item?.id || '')===id);
    if(round) return round;
    round={
      id,
      matchday:(state.fixtures || []).length+1,
      date,
      startDate:date,
      endDate:date,
      roundDate:date,
      title:String(options.title || 'Partidos recuperados'),
      calendarRecoveryRound:true,
      calendarIntegrityVersion:CALENDAR_INTEGRITY_VERSION,
      nationalCupRound:Boolean(options.nationalCupRound),
      nationalCupId:options.nationalCupId || undefined,
      nationalCupStage:options.nationalCupStage || undefined,
      nationalSupercup:Boolean(options.nationalSupercup),
      matches:[]
    };
    state.fixtures.push(round);
    return round;
  }
  function ciRestoreMissingRegularMatches(state,canonicalRounds,historyMaps,referenceDate){
    const existing=ciExistingRegularMaps(state);
    const specialRounds=(state.fixtures || []).filter(round => !((round?.matches || []).some(match => ciIsRegularMatch(match,round))));
    const rebuilt=[];
    const restored=[];
    let restoredPlayed=0;
    let restoredCount=0;
    let resetFutureDates=0;

    (canonicalRounds || []).forEach((canonicalRound,roundIndex) => {
      const expectedRoundDate=ciMatchDate(null,canonicalRound);
      const matches=[];
      (canonicalRound?.matches || []).forEach(canonicalMatch => {
        const id=String(canonicalMatch?.id || '');
        const pair=ciPairKey(canonicalMatch);
        const present=existing.byId.get(id) || existing.byPair.get(pair);
        const evidence=(id && historyMaps.byId.get(id)) || historyMaps.byPair.get(pair);
        const expectedDate=ciMatchDate(canonicalMatch,canonicalRound) || expectedRoundDate;
        let match=present?.match || ciClone(canonicalMatch);
        const wasMissing=!present;
        if(wasMissing){
          restoredCount+=1;
          match.calendarIntegrityRestored=true;
          match.calendarIntegrityRestoredFrom='canonical_blueprint';
        }
        if(!match || typeof match !== 'object') match=ciClone(canonicalMatch);
        match.id=canonicalMatch.id;
        match.homeId=canonicalMatch.homeId;
        match.awayId=canonicalMatch.awayId;
        match.divisionId=canonicalMatch.divisionId;
        match.divisionName=canonicalMatch.divisionName;
        match.leg=canonicalMatch.leg;
        match.matchday=roundIndex+1;
        match.calendarIntegrityCanonicalId=id;
        match.calendarIntegrityExpectedDate=expectedDate;
        match.calendarIntegrityLeagueRound=roundIndex+1;

        if(!match.played && evidence?.played && ciRestorePlayedFixture(match,evidence)) restoredPlayed+=1;

        if(match.played){
          if(!ciValidDate(match.date)) match.date=ciValidDate(evidence?.date) ? evidence.date : expectedDate;
          if(!ciValidDate(match.roundDate)) match.roundDate=expectedDate;
        }else{
          const actualDate=ciMatchDate(match,present?.round);
          const isOldRecovery=Boolean(match.recoveredSchedule && Number(match.calendarIntegrityVersion || 0) < CALENDAR_INTEGRITY_VERSION);
          const validCurrentRecovery=Boolean(
            match.recoveredSchedule &&
            Number(match.calendarIntegrityVersion || 0)===CALENDAR_INTEGRITY_VERSION &&
            ciValidDate(actualDate) &&
            !ciBefore(actualDate,referenceDate) &&
            ciValidDate(expectedDate) &&
            ciBefore(expectedDate,referenceDate)
          );
          if(validCurrentRecovery){
            match.date=actualDate;
            match.roundDate=actualDate;
          }else{
            if(ciValidDate(actualDate) && actualDate!==expectedDate && (!ciBefore(expectedDate,referenceDate) || isOldRecovery)) resetFutureDates+=1;
            match.date=expectedDate;
            match.roundDate=expectedDate;
            delete match.recoveredSchedule;
            delete match.recoveredScheduleReason;
            delete match.recoveredScheduleAt;
            delete match.recoveryBatchId;
          }
        }
        match.calendarIntegrityVersion=CALENDAR_INTEGRITY_VERSION;
        matches.push(match);
        if(wasMissing) restored.push({match,expectedDate,missing:true});
      });
      rebuilt.push({
        id:`league-s${state.seasonNumber || 1}-j${roundIndex+1}`,
        matchday:roundIndex+1,
        leagueRoundNumber:roundIndex+1,
        calendarCanonicalRound:true,
        calendarIntegrityVersion:CALENDAR_INTEGRITY_VERSION,
        calendarIntegrityExpectedDate:expectedRoundDate,
        date:expectedRoundDate,
        startDate:canonicalRound.startDate || expectedRoundDate,
        endDate:canonicalRound.endDate || expectedRoundDate,
        roundDate:expectedRoundDate,
        title:`Liga · Fecha ${roundIndex+1}`,
        matches
      });
    });

    state.fixtures=[...rebuilt,...specialRounds];
    return {
      restored,
      restoredCount,
      restoredPlayed,
      resetFutureDates,
      canonicalCount:(canonicalRounds || []).reduce((total,round)=>total+(round?.matches || []).length,0),
      canonicalRounds:rebuilt.length
    };
  }
  function ciNationalCupIdParts(id){
    const found=String(id || '').match(/-(\d+)-(\d+)-(\d+)$/);
    return found ? { index:Number(found[1]), homeId:Number(found[2]), awayId:Number(found[3]) } : null;
  }
  function ciNationalCupFixtureFromState(state,config,stage,stageState,id,options={}){
    const parts=ciNationalCupIdParts(id);
    if(!parts) return null;
    const date=ciValidDate(stageState?.date) ? stageState.date : (typeof nationalCupStageDate === 'function' ? nationalCupStageDate(config,stage.id,state.seasonYear) : '');
    let fixture=null;
    if(state===game && typeof nationalCupCreateMatch === 'function'){
      try{
        fixture=nationalCupCreateMatch(config,stage,parts.homeId,parts.awayId,parts.index,{
          date,
          supercup:Boolean(options.supercup),
          largestVenue:Boolean(options.supercup),
          ticketPrice:options.supercup ? 1000 : stage.ticketPrice,
          competitionId:options.competitionId || config.id,
          competitionName:options.competitionName || config.name
        });
      }catch(_error){ fixture=null; }
    }
    if(!fixture){
      fixture={
        id,
        divisionId:String(options.competitionId || config.id),
        divisionName:String(options.competitionName || config.name),
        homeId:parts.homeId,
        awayId:parts.awayId,
        played:false,
        date,
        roundDate:date,
        neutral:true,
        neutralVenue:true,
        knockout:true,
        requiresWinner:true,
        tieBreakMode:'penalties',
        nationalCup:true,
        nationalCupId:config.id,
        nationalCupStage:stage.id,
        nationalCupStageLabel:stage.label,
        nationalCupCountry:config.country,
        nationalSupercup:Boolean(options.supercup),
        ticketPrice:Math.max(0,Math.round(ciNumber(options.supercup ? 1000 : stage.ticketPrice,0))),
        competitionRules:{requiresWinner:true,tieBreakMode:'penalties',neutralVenue:true}
      };
    }
    fixture.id=id;
    fixture.calendarIntegrityRestored=true;
    fixture.calendarIntegrityExpectedDate=date;
    return fixture;
  }
  function ciRestoreNationalCupStateMatches(state,historyMaps){
    if(!state?.nationalCups || typeof NATIONAL_CUP_CONFIGS === 'undefined') return { restored:[], restoredPlayed:0 };
    const registry=ciFixtureRegistry(state);
    const restored=[];
    let restoredPlayed=0;
    const addFixture=(fixture,roundOptions,history) => {
      if(!fixture) return;
      if(history?.played){ ciRestorePlayedFixture(fixture,history); restoredPlayed+=1; }
      const round=ciFindOrCreateRound(state,fixture.date,roundOptions);
      if(!(round.matches || []).some(match => String(match.id)===String(fixture.id))) round.matches.push(fixture);
      restored.push({match:fixture,round,expectedDate:fixture.calendarIntegrityExpectedDate,missing:true});
      registry.byId.set(String(fixture.id),[{match:fixture,round}]);
    };
    (NATIONAL_CUP_CONFIGS || []).forEach(config => {
      const edition=state.nationalCups?.editions?.[config.id];
      if(!edition?.drawn || ['skipped'].includes(String(edition.status || ''))) return;
      (config.stages || []).forEach(stage => {
        const stageState=edition.stages?.[stage.id];
        if(!stageState || !['scheduled','completed'].includes(String(stageState.status || ''))) return;
        (stageState.matchIds || []).forEach(id => {
          if(registry.byId.has(String(id))) return;
          const history=historyMaps.byId.get(String(id));
          const fixture=ciNationalCupFixtureFromState(state,config,stage,stageState,id);
          addFixture(fixture,{
            id:stageState.roundId || `national-cup-${state.seasonNumber}-${config.id}-${stage.id}`,
            title:`${config.name} · ${stage.label}`,
            nationalCupRound:true,
            nationalCupId:config.id,
            nationalCupStage:stage.id
          },history);
        });
      });
    });
    if(typeof NATIONAL_CUP_COUNTRIES !== 'undefined'){
      (NATIONAL_CUP_COUNTRIES || []).forEach(country => {
        const key=typeof nationalCupCountryKey === 'function' ? nationalCupCountryKey(country) : String(country).toLowerCase();
        const supercup=state.nationalCups?.supercups?.[key];
        if(!supercup || !['scheduled','completed'].includes(String(supercup.status || '')) || !supercup.matchId) return;
        if(registry.byId.has(String(supercup.matchId))) return;
        const config=typeof nationalCupConfigForCountry === 'function' ? nationalCupConfigForCountry(country) : (NATIONAL_CUP_CONFIGS || []).find(item=>item.country===country);
        if(!config) return;
        const stage={id:'supercup',label:'Final',ticketPrice:1000};
        const stageState={date:supercup.date};
        const history=historyMaps.byId.get(String(supercup.matchId));
        const fixture=ciNationalCupFixtureFromState(state,config,stage,stageState,supercup.matchId,{
          supercup:true,
          competitionId:supercup.id,
          competitionName:supercup.name
        });
        addFixture(fixture,{
          id:`national-supercup-${state.seasonNumber}-${key}`,
          title:supercup.name,
          nationalCupRound:true,
          nationalCupId:config.id,
          nationalCupStage:'supercup',
          nationalSupercup:true
        },history);
      });
    }
    return { restored, restoredPlayed };
  }
  function ciReconcileAllPlayedFlags(state,historyMaps){
    let restored=0;
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(match => {
      if(match?.played) return;
      const evidence=ciPlayedEvidence(match,historyMaps);
      if(evidence?.played && ciRestorePlayedFixture(match,evidence)) restored+=1;
    }));
    return restored;
  }
  function ciPlayedFrontier(state,historyMaps){
    const maxByDivision=new Map();
    const visit=match => {
      if(!match?.played || match?.nationalCup || match?.clubWorldCup || match?.libertadores || match?.championsLeague || match?.playoff || match?.friendly) return;
      const round=ciLeagueRoundNumber(match);
      const division=String(match.divisionId || '');
      if(round>0) maxByDivision.set(division,Math.max(round,maxByDivision.get(division)||0));
    };
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(visit));
    historyMaps.byId.forEach(visit);
    return maxByDivision;
  }
  function ciCollectRecoveryCandidates(state,canonicalMaps,historyMaps,referenceDate,restoredItems=[]){
    const candidates=[];
    const seen=new Set();
    const add=(match,round,reason,expectedDate='') => {
      if(!match || match.played) return;
      const key=ciMatchKey(match);
      if(seen.has(key)) return;
      seen.add(key);
      candidates.push({match,round,reason,expectedDate:expectedDate || ciMatchDate(match,round)});
    };
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(match => {
      if(match?.played || match?.friendly) return;
      const scheduled=ciMatchDate(match,round);
      const canonical=canonicalMaps.byId.get(String(match.id || '')) || canonicalMaps.byPair.get(ciPairKey(match));
      const expected=canonical?.expectedDate || match?.calendarIntegrityExpectedDate || scheduled;
      const regular=ciIsRegularMatch(match,round);
      if(!ciValidDate(scheduled)){
        add(match,round,'fecha_invalida',expected);
        return;
      }
      if(regular){
        // Sólo se recuperan fechas de liga cuyo día original ya pasó. Las fechas
        // actuales y futuras permanecen en su programación canónica.
        if(ciValidDate(expected) && ciBefore(expected,referenceDate)){
          const alreadyRecovered=Boolean(
            match.recoveredSchedule &&
            Number(match.calendarIntegrityVersion || 0)===CALENDAR_INTEGRITY_VERSION &&
            !ciBefore(scheduled,referenceDate)
          );
          if(!alreadyRecovered) add(match,round,'liga_atrasada',expected);
        }
        return;
      }
      if(ciBefore(scheduled,referenceDate)) add(match,round,'competencia_atrasada',expected);
    }));
    (restoredItems || []).forEach(item => {
      if(!item?.match?.played && ciValidDate(item.expectedDate) && ciBefore(item.expectedDate,referenceDate)){
        add(item.match,item.round || null,'fixture_faltante',item.expectedDate);
      }
    });
    candidates.sort((a,b)=>ciCompareDates(a.expectedDate || '9999-12-31',b.expectedDate || '9999-12-31') || ciLeagueRoundNumber(a.match)-ciLeagueRoundNumber(b.match) || String(ciMatchKey(a.match)).localeCompare(String(ciMatchKey(b.match))));
    return candidates;
  }
  function ciOccupiedDates(state,candidateSet){
    const occupied=new Map();
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(match => {
      if(match?.played || candidateSet.has(match)) return;
      const date=ciMatchDate(match,round);
      if(!ciValidDate(date)) return;
      [ciNumber(match.homeId),ciNumber(match.awayId)].filter(Boolean).forEach(clubId => {
        if(!occupied.has(clubId)) occupied.set(clubId,new Set());
        occupied.get(clubId).add(date);
      });
    }));
    return occupied;
  }
  function ciScheduleCandidatesOnTuesdays(state,candidates,referenceDate){
    if(!candidates.length) return { rescheduled:0, dates:[], rounds:0 };
    const candidateSet=new Set(candidates.map(item=>item.match));
    const occupied=ciOccupiedDates(state,candidateSet);
    const grouped=[];
    const byKey=new Map();
    candidates.forEach(item => {
      const roundNumber=ciLeagueRoundNumber(item.match) || ciNumber(item.match?.calendarIntegrityLeagueRound,0);
      const regular=ciIsRegularMatch(item.match,item.round);
      const key=regular
        ? `league:${roundNumber || item.expectedDate}`
        : `special:${String(item.round?.id || ciMatchKey(item.match))}`;
      if(!byKey.has(key)){
        const group={key,regular,roundNumber,expectedDate:item.expectedDate || ciMatchDate(item.match,item.round),items:[]};
        byKey.set(key,group);
        grouped.push(group);
      }
      byKey.get(key).items.push(item);
    });
    grouped.sort((a,b)=>ciCompareDates(a.expectedDate || '9999-12-31',b.expectedDate || '9999-12-31') || ciNumber(a.roundNumber)-ciNumber(b.roundNumber) || a.key.localeCompare(b.key));

    const dates=[];
    let rescheduled=0;
    grouped.forEach((group,groupIndex) => {
      const clubs=[...new Set(group.items.flatMap(item=>[ciNumber(item.match.homeId),ciNumber(item.match.awayId)]).filter(Boolean))];
      let slot=ciNextTuesday(referenceDate,true);
      let guard=0;
      while(guard<MAX_SEARCH_WEEKS && clubs.some(clubId => occupied.get(clubId)?.has(slot))){
        slot=ciAddDays(slot,7);
        guard+=1;
      }
      if(!ciValidDate(slot)) return;
      const batchId=`calendar-recovery-s${state.seasonNumber || 1}-${group.regular ? `j${group.roundNumber || groupIndex+1}` : groupIndex+1}-${slot}`;
      group.items.forEach(item => {
        const oldDate=ciMatchDate(item.match,item.round);
        if(!item.match.originalScheduledDate && ciValidDate(item.expectedDate || oldDate)) item.match.originalScheduledDate=item.expectedDate || oldDate;
        item.match.calendarIntegrityExpectedDate=item.expectedDate || item.match.calendarIntegrityExpectedDate || oldDate;
        item.match.date=slot;
        item.match.roundDate=slot;
        item.match.recoveredSchedule=true;
        item.match.recoveredScheduleReason=`calendar_integrity_v885:${item.reason}`;
        item.match.recoveredScheduleAt=referenceDate;
        item.match.recoveryBatchId=batchId;
        item.match.calendarIntegrityVersion=CALENDAR_INTEGRITY_VERSION;
        rescheduled+=1;
      });
      clubs.forEach(clubId => {
        if(!occupied.has(clubId)) occupied.set(clubId,new Set());
        occupied.get(clubId).add(slot);
      });
      dates.push(slot);
    });
    return {rescheduled,dates:[...new Set(dates)].sort(),rounds:grouped.length};
  }
  function ciRefreshRoundDates(state){
    (state.fixtures || []).forEach(round => {
      const pendingDates=(round.matches || []).filter(match=>!match?.played).map(match=>ciMatchDate(match,null)).filter(ciValidDate).sort();
      const allDates=(round.matches || []).map(match=>ciMatchDate(match,null)).filter(ciValidDate).sort();
      const dates=pendingDates.length ? pendingDates : allDates;
      if(!dates.length) return;
      round.startDate=dates[0];
      round.endDate=dates[dates.length-1];
      round.date=dates[0];
      round.roundDate=dates[0];
    });
  }
  function ciSortAndRepairCursor(state,reason){
    if(state===game && typeof sortFixturesAfterNationalCupChange === 'function') sortFixturesAfterNationalCupChange();
    else{
      state.fixtures.sort((a,b)=>ciCompareDates(ciMatchDate(null,a)||'9999-12-31',ciMatchDate(null,b)||'9999-12-31') || ciNumber(a.matchday)-ciNumber(b.matchday));
      state.fixtures.forEach((round,index)=>{
        round.matchday=index+1;
        (round.matches || []).forEach(match=>{ match.matchday=index+1; });
      });
    }
    if(typeof repairFixtureCursorForState === 'function') repairFixtureCursorForState(state,{reason});
    else{
      const index=state.fixtures.findIndex(round => (round.matches || []).some(match=>!match.played));
      state.matchdayIndex=index>=0?index:state.fixtures.length;
    }
  }
  function ciEarliestPendingMatch(state,clubId=0){
    const cleanClubId=ciNumber(clubId,0);
    let best=null;
    (state?.fixtures || []).forEach((round,roundIndex) => (round?.matches || []).forEach((match,matchIndex) => {
      if(match?.played) return;
      if(cleanClubId && ciNumber(match.homeId)!==cleanClubId && ciNumber(match.awayId)!==cleanClubId) return;
      const date=ciMatchDate(match,round);
      if(!ciValidDate(date)) return;
      const item={roundIndex,matchIndex,round,match,date};
      if(!best || ciCompareDates(date,best.date)<0 || (date===best.date && ciNumber(match.calendarIntegrityLeagueRound || ciLeagueRoundNumber(match),999)-ciNumber(best.match.calendarIntegrityLeagueRound || ciLeagueRoundNumber(best.match),999)<0)) best=item;
    }));
    return best;
  }
  function ciLeagueProgressForClub(state,clubId){
    const cleanClubId=ciNumber(clubId,0);
    if(!state || !cleanClubId) return {played:0,total:0,next:0,pending:0};
    const seen=new Set();
    let played=0,total=0;
    (state.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
      if(!ciIsRegularMatch(match,round)) return;
      if(ciNumber(match.homeId)!==cleanClubId && ciNumber(match.awayId)!==cleanClubId) return;
      const key=ciMatchKey(match);
      if(seen.has(key)) return;
      seen.add(key);
      total+=1;
      if(match.played) played+=1;
    }));
    return {played,total,next:total ? Math.min(total,played+1) : 0,pending:Math.max(0,total-played)};
  }

  function ciQuickAuditState(target=game,options={}){
    const state=ciState(target);
    const referenceDate=ciValidDate(options.referenceDate) ? options.referenceDate : (ciValidDate(state?.currentDate) ? state.currentDate : '');
    const summary={ran:false,quick:true,version:CALENDAR_INTEGRITY_VERSION,referenceDate,invalidDates:0,pastDue:0,duplicateIds:0,needsFull:false};
    if(!state || !Array.isArray(state.fixtures) || !referenceDate) return summary;
    const seen=new Set();
    (state.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
      const key=String(match?.id || '').trim();
      if(key){
        if(seen.has(key)) summary.duplicateIds+=1;
        else seen.add(key);
      }
      if(match?.played || match?.friendly) return;
      const date=ciMatchDate(match,round);
      if(!ciValidDate(date)){ summary.invalidDates+=1; return; }
      if(ciBefore(date,referenceDate)) summary.pastDue+=1;
    }));
    summary.needsFull=Boolean(summary.invalidDates||summary.pastDue||summary.duplicateIds);
    return summary;
  }

  function ciAuditState(target=game,options={}){
    const state=ciState(target);
    const empty={ran:false,version:CALENDAR_INTEGRITY_VERSION,restoredMissing:0,restoredPlayed:0,duplicatesRemoved:0,rescheduled:0,dates:[],remainingPastDue:0,resetFutureDates:0};
    if(!state || !Array.isArray(state.fixtures)) return empty;
    const referenceDate=ciValidDate(options.referenceDate) ? options.referenceDate : (ciValidDate(state.currentDate) ? state.currentDate : '');
    if(!referenceDate) return empty;
    state.matchHistory=Array.isArray(state.matchHistory)?state.matchHistory:[];
    const historyMaps=ciHistoryMaps(state);
    const duplicate=ciRemoveDuplicateFixtures(state,historyMaps);
    const reconciled=ciReconcileAllPlayedFlags(state,historyMaps);
    const canonicalRounds=ciCanonicalRegular(state);
    const canonicalMaps=ciCanonicalMaps(canonicalRounds);
    const regularRepair=ciRestoreMissingRegularMatches(state,canonicalRounds,historyMaps,referenceDate);
    let nationalCupVerification=null;
    if(state===game && typeof verifyNationalCupCheckpoints === 'function'){
      try{
        nationalCupVerification=verifyNationalCupCheckpoints({ silent:true, source:'calendar_integrity_v966' });
        if(typeof advanceNationalCupsIfNeeded === 'function' && advanceNationalCupsIfNeeded()){
          nationalCupVerification.phaseChange=verifyNationalCupCheckpoints({ silent:true, source:'calendar_integrity_phase_change_v966' });
        }
      }catch(error){ console.warn('V9.66: verificación de copas nacionales omitida',error); }
    }
    const cupRepair=ciRestoreNationalCupStateMatches(state,historyMaps);
    if(state===game && typeof ensureClubWorldCupCurrentSeason === 'function'){
      try{ ensureClubWorldCupCurrentSeason({source:'calendar_integrity_v885'}); }catch(error){ console.warn('V8.85: revisión Mundial de Clubes omitida',error); }
    }
    const restoredItems=[...(regularRepair.restored || []),...(cupRepair.restored || [])];
    const candidates=ciCollectRecoveryCandidates(state,canonicalMaps,historyMaps,referenceDate,restoredItems);
    const scheduled=ciScheduleCandidatesOnTuesdays(state,candidates,referenceDate);
    ciRefreshRoundDates(state);
    ciSortAndRepairCursor(state,options.reason || 'calendar_integrity_v885');

    // Segunda pasada: una auditoría válida no puede dejar partidos con fecha vencida.
    const remaining=[];
    (state.fixtures || []).forEach(round => (round.matches || []).forEach(match => {
      if(match?.played || match?.friendly) return;
      const date=ciMatchDate(match,round);
      if(!ciValidDate(date) || ciBefore(date,referenceDate)) remaining.push({match,round});
    }));
    if(remaining.length){
      const retry=remaining.map(item=>({match:item.match,round:item.round,reason:'segunda_pasada',expectedDate:ciMatchDate(item.match,item.round)}));
      const extra=ciScheduleCandidatesOnTuesdays(state,retry,referenceDate);
      scheduled.rescheduled+=extra.rescheduled;
      scheduled.dates=[...new Set(scheduled.dates.concat(extra.dates))].sort();
      ciRefreshRoundDates(state);
      ciSortAndRepairCursor(state,'calendar_integrity_v885_second_pass');
    }
    const remainingPastDue=(state.fixtures || []).reduce((total,round)=>total+(round.matches || []).filter(match=>!match?.played && !match?.friendly && (!ciValidDate(ciMatchDate(match,round)) || ciBefore(ciMatchDate(match,round),referenceDate))).length,0);
    const summary={
      ran:true,
      version:CALENDAR_INTEGRITY_VERSION,
      reason:String(options.reason || 'calendar_integrity_v885'),
      season:ciNumber(state.seasonNumber,1),
      referenceDate,
      canonicalLeagueMatches:regularRepair.canonicalCount,
      canonicalLeagueRounds:regularRepair.canonicalRounds,
      resetFutureDates:regularRepair.resetFutureDates || 0,
      nationalCupCheckpoints:Number(nationalCupVerification?.ran || 0),
      nationalCupRepairs:Number(nationalCupVerification?.repaired || 0),
      restoredMissing:regularRepair.restoredCount+(cupRepair.restored || []).length,
      restoredPlayed:duplicate.historyRestored+reconciled+regularRepair.restoredPlayed+cupRepair.restoredPlayed,
      duplicatesRemoved:duplicate.duplicatesRemoved,
      rescheduled:scheduled.rescheduled,
      dates:scheduled.dates,
      remainingPastDue,
      checkedAt:new Date().toISOString()
    };
    const changed=summary.restoredMissing||summary.restoredPlayed||summary.duplicatesRemoved||summary.rescheduled||summary.resetFutureDates||summary.nationalCupRepairs;
    state.calendarIntegrityState=state.calendarIntegrityState && typeof state.calendarIntegrityState==='object' ? state.calendarIntegrityState : {};
    state.calendarIntegrityState.version=CALENDAR_INTEGRITY_VERSION;
    state.calendarIntegrityState.lastCheckDate=referenceDate;
    state.calendarIntegrityState.lastFullCheckDate=referenceDate;
    state.calendarIntegrityState.lastSummary=summary;
    state.calendarIntegrityLog=Array.isArray(state.calendarIntegrityLog)?state.calendarIntegrityLog.slice(-(MAX_LOG_ENTRIES-1)):[];
    if(changed || options.logAlways) state.calendarIntegrityLog.push(summary);
    if(changed){ state._needsAutosave=true; state._calendarIntegrityPendingNotice=summary; }
    return summary;
  }

  function ciFormatRecoveryDate(value){
    if(!ciValidDate(value)) return String(value || '');
    const date=ciUtc(value);
    if(!date) return String(value || '');
    try{
      return new Intl.DateTimeFormat('es-AR',{ weekday:'long', day:'numeric', month:'long', timeZone:'UTC' }).format(date);
    }catch(_error){ return String(value || ''); }
  }
  function ciFederationSender(){
    const selectedClub=(seed?.clubs || []).find(club => Number(club.id) === Number(game?.selectedClubId || 0));
    const country=selectedClub && typeof clubCountry === 'function' ? clubCountry(selectedClub) : (game?.selectedCountry || '');
    const name=typeof transferTaxFederationByCountry === 'function' ? transferTaxFederationByCountry(country) : 'Federación';
    return String(name || 'Federación').trim() || 'Federación';
  }
  function ciRecoveryIncident(summary){
    const incidents=[
      { key:'tormenta', singular:'Partido reprogramado por tormenta', plural:'Partidos reprogramados por tormenta', cause:'una tormenta intensa, acompañada por actividad eléctrica y dificultades en los accesos al estadio' },
      { key:'seguridad', singular:'Partido reprogramado por seguridad', plural:'Partidos reprogramados por seguridad', cause:'la falta de efectivos suficientes para garantizar el operativo de seguridad' },
      { key:'amenaza', singular:'Partido suspendido por una amenaza', plural:'Partidos suspendidos por amenazas', cause:'una amenaza recibida antes del encuentro y la posterior inspección preventiva del estadio' },
      { key:'energia', singular:'Corte de luz obliga a reprogramar', plural:'Cortes de luz obligan a reprogramar', cause:'un corte general de energía que afectó al estadio y a varios sectores de la ciudad' },
      { key:'incendio', singular:'Partido reprogramado por un incendio', plural:'Partidos reprogramados por incendios', cause:'un principio de incendio en una instalación próxima al estadio y el trabajo posterior de los servicios de emergencia' },
      { key:'alerta', singular:'Alerta meteorológica cambia la fecha', plural:'Alerta meteorológica cambia las fechas', cause:'una alerta meteorológica por fuertes vientos y riesgo para jugadores e hinchas' }
    ];
    const salt=`${summary?.season || 1}-${summary?.referenceDate || ''}-${summary?.rescheduled || 0}-${(summary?.dates || []).join('|')}`;
    const index=typeof hashNumber === 'function' ? hashNumber(`calendar-incident-${salt}`,incidents.length) : [...salt].reduce((total,char)=>total+char.charCodeAt(0),0)%incidents.length;
    return incidents[Math.max(0,Math.min(incidents.length-1,index))];
  }
  function ciNotify(summary){
    const count=Math.max(0,Math.round(ciNumber(summary?.rescheduled,0)));
    if(!summary || count <= 0) return;
    const singular=count === 1;
    const incident=ciRecoveryIncident(summary);
    const federation=ciFederationSender();
    const sender=federation.toLowerCase() === 'federación' ? 'La federación' : `La ${federation}`;
    const dateLabels=(summary.dates || []).slice(0,3).map(ciFormatRecoveryDate).filter(Boolean);
    const datesText=dateLabels.length
      ? (singular ? `La nueva fecha será el ${dateLabels[0]}.` : `Las primeras nuevas fechas serán ${dateLabels.join(', ')}.`)
      : 'Las nuevas fechas fueron incorporadas al calendario oficial.';
    const matchText=singular ? 'un encuentro pendiente debió ser postergado' : `${count} encuentros pendientes debieron ser postergados`;
    const apology=incident.key === 'seguridad' || incident.key === 'amenaza'
      ? `${sender} agradeció la colaboración de los clubes y pidió disculpas por las molestias ocasionadas.`
      : `${sender} presentó disculpas a los clubes y a los hinchas por los inconvenientes.`;
    const body=`${sender} informó que ${matchText} por ${incident.cause}. ${datesText} ${apology}`;
    if(typeof pushGameMessage === 'function'){
      pushGameMessage({
        id:`calendar-integrity-v885-s${summary.season}-${summary.referenceDate}`,
        type:'federación',priority:'high',title:singular ? incident.singular : incident.plural,body
      });
    }
    if(typeof showNotice === 'function') showNotice(`${singular ? 'El partido fue reprogramado' : 'Los partidos fueron reprogramados'} para el primer martes disponible.`,false);
  }

  window.runCalendarIntegrityAudit=ciAuditState;
  window.recoverBrokenCalendarOnTuesdays=ciAuditState;
  window.recoverOverdueMatchesOnTuesdays=ciAuditState;
  window.calendarEarliestPendingMatch=ciEarliestPendingMatch;
  window.calendarLeagueProgressForClub=ciLeagueProgressForClub;

  if(typeof normalizeGame === 'function'){
    const originalNormalizeGame=normalizeGame;
    normalizeGame=function(saved){
      const normalized=originalNormalizeGame.call(this,saved);
      ciAuditState(normalized,{referenceDate:normalized.currentDate || '',reason:'save_migration_v885'});
      return normalized;
    };
  }
  if(typeof loadLocal === 'function' && !loadLocal.__nationalCupCheckpointV966){
    const originalLoadLocalV966=loadLocal;
    const wrappedLoadLocalV966=async function(...args){
      const loaded=await originalLoadLocalV966.apply(this,args);
      if(!loaded || !game || typeof verifyNationalCupCheckpoints !== 'function') return loaded;
      try{
        const verification=verifyNationalCupCheckpoints({ silent:false, source:'load_local_v966' });
        const phaseChanged=typeof advanceNationalCupsIfNeeded === 'function' ? advanceNationalCupsIfNeeded() : false;
        const phaseVerification=phaseChanged ? verifyNationalCupCheckpoints({ silent:true, source:'load_local_phase_change_v966' }) : null;
        const changed=Boolean(verification?.repaired || verification?.results?.some(item=>item?.created) || phaseChanged || phaseVerification?.repaired);
        if(changed){
          game._needsAutosave=true;
          if(typeof renderAll === 'function') renderAll();
          if(typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(error=>console.warn('V9.66: no se pudo guardar la reparación de copas nacionales.',error));
        }
      }catch(error){ console.warn('V9.66: verificación de copas al cargar omitida',error); }
      return loaded;
    };
    wrappedLoadLocalV966.__nationalCupCheckpointV966=true;
    loadLocal=wrappedLoadLocalV966;
  }
  if(typeof processDailyCalendarState === 'function'){
    const originalProcessDailyCalendarState=processDailyCalendarState;
    processDailyCalendarState=function(dateAfter='',options={}){
      const beforeDate=ciValidDate(dateAfter)?dateAfter:(ciValidDate(game?.currentDate)?game.currentDate:'');
      ciDailyTransactionDepth+=1;
      let before=ciQuickAuditState(game,{referenceDate:beforeDate});
      let result={};
      try{
        if(before.needsFull || options.forceCalendarIntegrity===true){
          before=ciAuditState(game,{referenceDate:beforeDate,reason:'before_daily_advance_v913'});
        }
        result=originalProcessDailyCalendarState.call(this,dateAfter,options)||{};
      }finally{
        ciDailyTransactionDepth=Math.max(0,ciDailyTransactionDepth-1);
      }
      const afterDate=game?.currentDate || beforeDate;
      let after=ciQuickAuditState(game,{referenceDate:afterDate});
      if(after.needsFull || options.forceCalendarIntegrity===true){
        after=ciAuditState(game,{referenceDate:afterDate,reason:'after_daily_advance_v913'});
      }
      result.calendarIntegrity={before,after};
      const pending=game?._calendarIntegrityPendingNotice;
      if(pending){ ciNotify(pending); delete game._calendarIntegrityPendingNotice; }
      return result;
    };
  }
  if(typeof runScheduledSeasonGameVerifier === 'function'){
    const originalRunScheduledSeasonGameVerifier=runScheduledSeasonGameVerifier;
    runScheduledSeasonGameVerifier=function(options={}){
      if(ciDailyTransactionDepth>0){
        const result=originalRunScheduledSeasonGameVerifier.call(this,options)||{};
        result.calendarIntegrity={ran:false,deferredToDailyTransaction:true,version:CALENDAR_INTEGRITY_VERSION};
        return result;
      }
      // El verificador legado puede reconstruir o reordenar fixtures. La auditoría
      // unificada debe ejecutarse al final para que ninguna reparación posterior la pise.
      const result=originalRunScheduledSeasonGameVerifier.call(this,options)||{};
      const audit=ciAuditState(game,{referenceDate:game?.currentDate || '',reason:options.reason || 'scheduled_verifier_v886'});
      result.calendarIntegrity=audit;
      result.repaired=Boolean(result.repaired||audit.restoredMissing||audit.restoredPlayed||audit.duplicatesRemoved||audit.rescheduled||audit.resetFutureDates);
      return result;
    };
  }
  if(typeof finalizeSeasonIfNeeded === 'function'){
    const originalFinalizeSeasonIfNeeded=finalizeSeasonIfNeeded;
    finalizeSeasonIfNeeded=function(...args){
      ciAuditState(game,{referenceDate:game?.currentDate || '',reason:'before_season_finalize_v885'});
      return originalFinalizeSeasonIfNeeded.apply(this,args);
    };
  }
  if(typeof startNextSeason === 'function'){
    const originalStartNextSeason=startNextSeason;
    startNextSeason=function(...args){
      const result=originalStartNextSeason.apply(this,args);
      ciAuditState(game,{referenceDate:game?.currentDate || '',reason:'after_next_season_v885'});
      return result;
    };
  }
})();
