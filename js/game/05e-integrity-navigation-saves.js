/* V8.08 · Integridad, navegación y tácticas/entrenamientos guardados. Extraído de 05-state-season.js sin alterar el orden lógico original. */

function integrityCountryKey(value){
  return normalizeScheduleText(String(value || '').trim() || 'argentina');
}
function divisionCountryKey(division){
  return integrityCountryKey(division?.country || division?.pais || '');
}
function clubCountryKeyForIntegrity(club){
  return integrityCountryKey(typeof clubCountry === 'function' ? clubCountry(club) : (club?.country || club?.pais || 'Argentina'));
}
function isSpecialCompetitionOnlyClub(club){
  return Boolean(club?.specialCompetitionOnly || club?.clubWorldCupInvite || club?.clubWorldCupExternal || String(club?.divisionId || '') === String(CLUB_WORLD_CUP_CONFIG?.invitedDivisionId || 'club-world-cup-invitados'));
}
function integrityNormalClubs(){
  return (seed?.clubs || []).filter(club => !isSpecialCompetitionOnlyClub(club));
}
function integrityDivisionById(){
  return Object.fromEntries((seed?.divisions || []).map(division => [String(division.id || 'default'), division]));
}
function integrityDivisionsForClubCountry(club){
  const country = clubCountryKeyForIntegrity(club);
  const direct = (seed?.divisions || []).filter(division => divisionCountryKey(division) === country);
  if(direct.length) return direct.slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
  const inferredIds = new Set(integrityNormalClubs()
    .filter(item => item && Number(item.id) !== Number(club?.id) && clubCountryKeyForIntegrity(item) === country)
    .map(item => String(item.divisionId || 'default')));
  return (seed?.divisions || [])
    .filter(division => inferredIds.has(String(division.id || 'default')))
    .sort((a,b)=>(a.order || 0)-(b.order || 0));
}
function safeTargetDivisionForClub(club, currentDivision=null){
  const candidates = integrityDivisionsForClubCountry(club);
  if(!candidates.length) return null;
  const currentOrder = Number(currentDivision?.order || club?.divisionOrder || 1);
  return candidates.find(division => Number(division.order || 0) === currentOrder) || candidates[0];
}
function baseClubDivisionIntegrityMap(){
  if(typeof window !== 'undefined' && window.__BASE_CLUB_DIVISION_INTEGRITY_MAP__) return window.__BASE_CLUB_DIVISION_INTEGRITY_MAP__;
  return null;
}
function baseClubDivisionEntry(club){
  const map = baseClubDivisionIntegrityMap();
  if(!map || !club) return null;
  const byId = map.byId?.[String(club.id || '')];
  if(byId) return byId;
  const key = `${integrityCountryKey(club.country || club.pais || '')}::${normalizeScheduleText(club.name || '')}`;
  return map.byName?.[key] || null;
}
function nativeTargetDivisionForClub(club, currentDivision=null){
  const divisionsById = integrityDivisionById();
  const native = baseClubDivisionEntry(club);
  if(native?.divisionId){
    const target = divisionsById[String(native.divisionId || '')];
    if(target && divisionCountryKey(target) === clubCountryKeyForIntegrity(club)) return target;
  }
  return safeTargetDivisionForClub(club, currentDivision);
}
function expectedDivisionTeamCount(division){
  const base = baseClubDivisionIntegrityMap();
  const fromBase = Number(base?.divisionCounts?.[String(division?.id || 'default')]);
  if(Number.isFinite(fromBase) && fromBase > 0) return Math.round(fromBase);
  const explicit = Number(division?.expectedTeams || division?.teamCount || division?.teamsCount || division?.cantidadEquipos);
  if(Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  return 18;
}
function setClubIntegrityDivision(club, target){
  if(!club || !target) return false;
  const changed = String(club.divisionId || '') !== String(target.id || '');
  club.divisionId = target.id;
  club.divisionName = target.name;
  club.divisionOrder = target.order;
  club.prizeMultiplier = target.prizeMultiplier ?? divisionPrizeMultiplier(target.name, (target.order || 1)-1);
  return changed;
}

function fixtureDefinesRegularLeagueDivision(match, round=null){
  if(!match) return false;
  if(match.friendly || match.nationalCup || match.clubWorldCup || match.libertadores || match.championsLeague || match.playoff || match.promotionPlayoff || match.playoffTieId) return false;
  if(round?.friendlyRound || round?.nationalCupRound || round?.clubWorldCupRound || round?.libertadoresRound || round?.championsLeagueRound || round?.playoffRound) return false;
  const divisionId = String(match.divisionId || round?.divisionId || '');
  if(!divisionId) return false;
  return Boolean(integrityDivisionById()[divisionId]);
}
function seasonFixtureDivisionAssignments(state=game){
  const evidence = new Map();
  (state?.fixtures || []).forEach(round => {
    (round?.matches || []).forEach(match => {
      if(!fixtureDefinesRegularLeagueDivision(match, round)) return;
      const divisionId = String(match.divisionId || round?.divisionId || '');
      [match.homeId, match.awayId].forEach(rawClubId => {
        const clubId = Number(rawClubId || 0);
        if(!clubId) return;
        if(!evidence.has(clubId)) evidence.set(clubId, new Map());
        const counts = evidence.get(clubId);
        counts.set(divisionId, Number(counts.get(divisionId) || 0) + 1);
      });
    });
  });
  const assignments = new Map();
  evidence.forEach((counts, clubId) => {
    const ranked = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1] || String(a[0]).localeCompare(String(b[0])));
    const [divisionId, appearances] = ranked[0] || [];
    const total = ranked.reduce((sum,item)=>sum+Number(item[1] || 0),0);
    if(!divisionId || appearances < 2 || appearances / Math.max(1,total) < 0.75) return;
    assignments.set(Number(clubId), { divisionId:String(divisionId), appearances:Number(appearances), total:Number(total) });
  });
  return assignments;
}
function restoreClubDivisionsFromSeasonFixtures(state=game, options={}){
  if(!state || !Array.isArray(state.fixtures) || !state.fixtures.length || !seed?.clubs?.length) return { repaired:0, selectedClubRepaired:false, assignments:0 };
  const divisionsById = integrityDivisionById();
  const assignments = seasonFixtureDivisionAssignments(state);
  let repaired = 0;
  let selectedClubRepaired = false;
  const repairedClubs = [];
  assignments.forEach((entry, clubId) => {
    const club = (seed.clubs || []).find(item => Number(item.id) === Number(clubId));
    const target = divisionsById[String(entry.divisionId || '')];
    if(!club || !target || isSpecialCompetitionOnlyClub(club)) return;
    if(divisionCountryKey(target) !== clubCountryKeyForIntegrity(club)) return;
    if(setClubIntegrityDivision(club, target)){
      repaired += 1;
      repairedClubs.push({ clubId:Number(club.id), clubName:String(club.name || ''), divisionId:String(target.id || ''), divisionName:String(target.name || '') });
      if(Number(club.id) === Number(state.selectedClubId || 0)) selectedClubRepaired = true;
    }
  });
  if(repaired > 0){
    state.clubDivisionOverrides = snapshotClubDivisionOverrides();
    const selectedClub = (seed.clubs || []).find(club => Number(club.id) === Number(state.selectedClubId || 0));
    if(selectedClub) state.selectedLeagueId = selectedClub.divisionId || state.selectedLeagueId || 'default';
    state.divisionFixtureRepairV964 = {
      version:1,
      season:Number(state.seasonNumber || 1),
      date:String(state.currentDate || ''),
      reason:String(options.reason || 'fixture_authority'),
      repaired,
      clubs:repairedClubs.slice(0,24)
    };
    state._needsAutosave = true;
    if(selectedClubRepaired && options.message !== false){
      state.messages = Array.isArray(state.messages) ? state.messages : [];
      const messageId = `division-fixture-repair-v964-s${Number(state.seasonNumber || 1)}-${Number(state.selectedClubId || 0)}`;
      if(!state.messages.some(item => String(item?.id || '') === messageId)){
        state.messages.unshift({
          id:messageId,
          type:'federación',
          title:'División corregida',
          body:`La división de ${selectedClub?.name || 'tu club'} fue restaurada según el calendario oficial de la temporada. Los resultados y rivales ya disputados se mantienen.`,
          priority:'high',
          read:false,
          createdAt:new Date().toISOString()
        });
      }
    }
  }else{
    const selectedClub = (seed.clubs || []).find(club => Number(club.id) === Number(state.selectedClubId || 0));
    if(selectedClub) state.selectedLeagueId = selectedClub.divisionId || state.selectedLeagueId || 'default';
  }
  return { repaired, selectedClubRepaired, assignments:assignments.size, clubs:repairedClubs };
}

function fixtureMatchCountryIssue(match, divisionsById=integrityDivisionById()){
  if(!match) return null;
  const home = (seed?.clubs || []).find(club => Number(club.id) === Number(match.homeId));
  const away = (seed?.clubs || []).find(club => Number(club.id) === Number(match.awayId));
  if(!home || !away) return { matchId:match.id, issue:'club_inexistente', homeId:match.homeId, awayId:match.awayId, played:Boolean(match.played) };
  const division = divisionsById[String(match.divisionId || home.divisionId || '')];
  if(!division) return null;
  const divCountry = divisionCountryKey(division);
  if(divCountry && (clubCountryKeyForIntegrity(home) !== divCountry || clubCountryKeyForIntegrity(away) !== divCountry)){
    return { matchId:match.id, issue:'fixture_pais_cruzado', division:division.name, home:home.name, away:away.name, played:Boolean(match.played) };
  }
  return null;
}
function fixtureCountryIssues(){
  const divisionsById = integrityDivisionById();
  const issues = [];
  (game?.fixtures || []).forEach((round, roundIndex) => {
    (round.matches || []).forEach(match => {
      const issue = fixtureMatchCountryIssue(match, divisionsById);
      if(issue) issues.push({ ...issue, roundIndex, matchday:round.matchday || roundIndex + 1, roundTitle:round.title || '' });
    });
  });
  return issues;
}
function repairCrossCountryClubAssignments(options={}){
  if(!seed?.clubs?.length || !seed?.divisions?.length) return { repaired:0 };
  const restoreNativeIfNeeded = options.restoreNativeIfNeeded !== false;
  const divisionsById = integrityDivisionById();
  let repaired = 0;
  (seed.clubs || []).forEach(club => {
    if(isSpecialCompetitionOnlyClub(club)) return;
    const currentDivision = divisionsById[String(club.divisionId || 'default')];
    const countryMismatch = currentDivision && clubCountryKeyForIntegrity(club) !== divisionCountryKey(currentDivision);
    const invalidDivision = !currentDivision;
    if(!invalidDivision && !countryMismatch && !restoreNativeIfNeeded) return;
    if(!invalidDivision && !countryMismatch && restoreNativeIfNeeded){
      const native = baseClubDivisionEntry(club);
      if(!native?.divisionId || String(native.divisionId) === String(club.divisionId || '')) return;
      const nativeDivision = divisionsById[String(native.divisionId || '')];
      if(!nativeDivision || divisionCountryKey(nativeDivision) !== clubCountryKeyForIntegrity(club)) return;
      if(setClubIntegrityDivision(club, nativeDivision)) repaired += 1;
      return;
    }
    const target = nativeTargetDivisionForClub(club, currentDivision);
    if(!target) return;
    if(setClubIntegrityDivision(club, target)) repaired += 1;
  });
  return { repaired };
}
function rebuildSafeSeasonFixturesAfterStructureRepair(){
  if(!game || !Array.isArray(game.fixtures)) return { rebuilt:false, reason:'sin_calendario', blockedPlayedCross:0 };
  const issues = fixtureCountryIssues();
  const playedCross = issues.filter(item => item.played);
  if(playedCross.length) return { rebuilt:false, reason:'hay_partidos_cruzados_jugados', blockedPlayedCross:playedCross.length, issues };
  if(!issues.length) return { rebuilt:false, reason:'sin_partidos_cruzados', blockedPlayedCross:0, issues };
  if(typeof generateFixturesForDivisions !== 'function') return { rebuilt:false, reason:'generador_no_disponible', blockedPlayedCross:0, issues };
  const nextRegular = generateFixturesForDivisions(seed.clubs || [], divisionOrderList(), { seasonYear:game.seasonYear || seasonYearForNumber(game.seasonNumber || 1), fixtureSeedIndex:game.leagueFixtureSeedIndex });
  const isPersistentCompetition = round => Boolean(isPromotionPlayoffRound(round) || round?.clubWorldCupRound || round?.nationalCupRound || round?.libertadoresRound || round?.championsLeagueRound || (round?.matches || []).some(match => match?.clubWorldCup || match?.nationalCup || match?.libertadores || match?.championsLeague));
  const previousRegular = (game.fixtures || []).filter(round => !isPersistentCompetition(round));
  const previousPlayoffs = (game.fixtures || []).filter(isPersistentCompetition);
  const mergedRegular = typeof mergePlayedFixturesIntoCalendar === 'function'
    ? mergePlayedFixturesIntoCalendar(nextRegular, previousRegular)
    : nextRegular;
  game.fixtures = mergedRegular.concat(previousPlayoffs);
  if(typeof sortFixturesAfterNationalCupChange === 'function') sortFixturesAfterNationalCupChange();
  game.calendarVersion = `${SEASON_CALENDAR_VERSION}-country-safe`;
  return { rebuilt:true, reason:'calendario_regenerado', fixed:issues.length, blockedPlayedCross:0, issues };
}
function divisionCountIntegrityRows(){
  return (seed?.divisions || []).map(division => {
    const expected = expectedDivisionTeamCount(division);
    const count = integrityNormalClubs().filter(club => String(club.divisionId || 'default') === String(division.id || 'default')).length;
    return { id:division.id, name:division.name, country:division.country || '', order:division.order || 1, expected, count, delta:count - expected };
  });
}
function buildDivisionCountRepairPlan(){
  const divisions = (seed?.divisions || []).slice();
  const byId = Object.fromEntries(divisions.map(division => [String(division.id || 'default'), division]));
  const normalClubs = integrityNormalClubs();
  const assignments = new Map(normalClubs.map(club => [Number(club.id), String(club.divisionId || 'default')]));
  const plan = [];
  const countries = Array.from(new Set(divisions.map(division => divisionCountryKey(division)).filter(Boolean)));
  countries.forEach(country => {
    const countryDivisions = divisions
      .filter(division => divisionCountryKey(division) === country)
      .sort((a,b)=>(a.order || 0)-(b.order || 0));
    const expectedById = Object.fromEntries(countryDivisions.map(division => [String(division.id || 'default'), expectedDivisionTeamCount(division)]));
    const countFor = divisionId => Array.from(assignments.values()).filter(value => String(value) === String(divisionId)).length;
    const countryClubIds = normalClubs
      .filter(club => clubCountryKeyForIntegrity(club) === country)
      .map(club => Number(club.id));
    countryDivisions.forEach(targetDivision => {
      let need = Math.max(0, expectedById[String(targetDivision.id || 'default')] - countFor(targetDivision.id));
      while(need > 0){
        const overflowDivisions = countryDivisions
          .filter(division => countFor(division.id) > expectedById[String(division.id || 'default')])
          .sort((a,b)=>Math.abs((a.order || 1) - (targetDivision.order || 1)) - Math.abs((b.order || 1) - (targetDivision.order || 1)));
        if(!overflowDivisions.length) break;
        let chosenClub = null;
        let fromDivision = null;
        overflowDivisions.some(sourceDivision => {
          const fixtureAssignments = seasonFixtureDivisionAssignments(game);
          const candidates = countryClubIds
            .filter(clubId => String(assignments.get(clubId)) === String(sourceDivision.id || 'default'))
            .filter(clubId => !fixtureAssignments.has(Number(clubId)))
            .map(clubId => (seed?.clubs || []).find(club => Number(club.id) === Number(clubId)))
            .filter(Boolean)
            .sort((a,b) => {
              const nativeA = baseClubDivisionEntry(a);
              const nativeB = baseClubDivisionEntry(b);
              const targetId = String(targetDivision.id || 'default');
              const nativeScoreA = String(nativeA?.divisionId || '') === targetId ? 0 : 10;
              const nativeScoreB = String(nativeB?.divisionId || '') === targetId ? 0 : 10;
              const selectedScoreA = Number(a.id) === Number(game?.selectedClubId || 0) ? 5 : 0;
              const selectedScoreB = Number(b.id) === Number(game?.selectedClubId || 0) ? 5 : 0;
              const foundedScoreA = typeof isFoundedClubId === 'function' && isFoundedClubId(a.id) ? 5 : 0;
              const foundedScoreB = typeof isFoundedClubId === 'function' && isFoundedClubId(b.id) ? 5 : 0;
              return (nativeScoreA + selectedScoreA + foundedScoreA) - (nativeScoreB + selectedScoreB + foundedScoreB);
            });
          if(candidates.length){
            chosenClub = candidates[0];
            fromDivision = sourceDivision;
            return true;
          }
          return false;
        });
        if(!chosenClub || !fromDivision) break;
        assignments.set(Number(chosenClub.id), String(targetDivision.id || 'default'));
        plan.push({
          clubId:chosenClub.id,
          clubName:chosenClub.name,
          fromDivisionId:fromDivision.id,
          fromDivisionName:fromDivision.name,
          toDivisionId:targetDivision.id,
          toDivisionName:targetDivision.name,
          country:targetDivision.country || country
        });
        need -= 1;
      }
    });
  });
  return plan.filter(item => byId[String(item.fromDivisionId || '')] && byId[String(item.toDivisionId || '')]);
}

function matchHasMinimumBotStats(match){
  if(!match || !match.played) return true;
  if(typeof ownClubInMatch === 'function' && ownClubInMatch(match)) return true;
  const goals = Array.isArray(match.goals) ? match.goals : [];
  const cards = Array.isArray(match.cards) ? match.cards : [];
  const injuries = Array.isArray(match.injuries) ? match.injuries : [];
  const keySaves = Array.isArray(match.keySaves) ? match.keySaves : [];
  const errors = Array.isArray(match.errors) ? match.errors : [];
  const stats = match.matchStats || {};
  const homeStats = stats.home || {};
  const awayStats = stats.away || {};
  const goalsOk = Number(match.homeGoals || 0) + Number(match.awayGoals || 0) === goals.length && goals.every(g => Number.isFinite(Number(g.playerId)) && Number(g.playerId) > 0 && (Number(match.homeGoals || 0) + Number(match.awayGoals || 0) <= 0 || g.clubId));
  const assistsOk = goals.every(g => g.assistId === null || g.assistId === undefined || Number(g.assistId) > 0);
  const cardsOk = Array.isArray(cards) && cards.every(c => Number(c.playerId || 0) > 0 && ['yellow','red','secondYellowRed'].includes(String(c.type || '')));
  const injuriesOk = Array.isArray(injuries) && injuries.every(i => Number(i.playerId || 0) > 0 && String(i.injuryLabel || i.name || '').trim());
  const savesOk = Array.isArray(keySaves) && keySaves.every(k => Number(k.playerId || 0) > 0);
  const errorsOk = Array.isArray(errors) && errors.every(e => Number(e.playerId || 0) > 0);
  const statsOk = ['attacks','chances','possession','fouls','keySaves','errors','goalErrors'].every(key => Number.isFinite(Number(homeStats[key] ?? 0)) && Number.isFinite(Number(awayStats[key] ?? 0)));
  const playedIdsOk = Array.isArray(match.playedIdsHome) && match.playedIdsHome.length > 0 && Array.isArray(match.playedIdsAway) && match.playedIdsAway.length > 0;
  return Boolean(goalsOk && assistsOk && cardsOk && injuriesOk && savesOk && errorsOk && statsOk && playedIdsOk);
}
function botMatchStatsIntegrityIssues(){
  if(!game?.fixtures?.length) return [];
  const issues = [];
  (game.fixtures || []).forEach((round, roundIndex) => {
    (round.matches || []).forEach(match => {
      if(!match?.played) return;
      if(typeof ownClubInMatch === 'function' && ownClubInMatch(match)) return;
      if(matchHasMinimumBotStats(match)) return;
      issues.push({
        matchId:match.id,
        roundIndex,
        matchday:round.matchday || roundIndex + 1,
        divisionId:match.divisionId || round.divisionId || '',
        home:clubName(match.homeId),
        away:clubName(match.awayId),
        engine:match.engine || 'sin motor',
        goals:Array.isArray(match.goals) ? match.goals.length : 'faltan',
        cards:Array.isArray(match.cards) ? match.cards.length : 'faltan',
        injuries:Array.isArray(match.injuries) ? match.injuries.length : 'faltan',
        keySaves:Array.isArray(match.keySaves) ? match.keySaves.length : 'faltan',
        errors:Array.isArray(match.errors) ? match.errors.length : 'faltan'
      });
    });
  });
  return issues;
}

function integrityClonePlain(value){
  try{ return JSON.parse(JSON.stringify(value ?? null)); }
  catch(_){ return value ?? null; }
}
function integrityMatchFiniteScore(match){
  const homeGoals = Number(match?.homeGoals);
  const awayGoals = Number(match?.awayGoals);
  if(!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;
  return { homeGoals:Math.max(0, Math.round(homeGoals)), awayGoals:Math.max(0, Math.round(awayGoals)) };
}
function integrityMatchComparableDate(match, round){
  const direct = String(match?.date || '').slice(0,10);
  if(validIsoDate(direct)) return direct;
  if(typeof scheduledDateForMatch === 'function') return scheduledDateForMatch(match, round);
  return String(round?.date || '').slice(0,10);
}
function integritySameScheduledMatch(record, match, round){
  if(!record || !match) return false;
  if(match.id && record.id && String(record.id) === String(match.id)) return true;
  const date = integrityMatchComparableDate(match, round);
  const recordDate = String(record.date || '').slice(0,10);
  return Number(record.homeId) === Number(match.homeId)
    && Number(record.awayId) === Number(match.awayId)
    && String(record.divisionId || '') === String(match.divisionId || round?.divisionId || '')
    && (!validIsoDate(date) || !validIsoDate(recordDate) || date === recordDate);
}
function integrityHistoryRecordForFixture(match, round, requireValid=false){
  const history = Array.isArray(game?.matchHistory) ? game.matchHistory : [];
  return history.find(record => {
    if(!record?.played) return false;
    if(!integritySameScheduledMatch(record, match, round)) return false;
    if(requireValid && !matchHasMinimumBotStats(record)) return false;
    return true;
  }) || null;
}
function integrityBotLineupForRepair(clubId){
  if(typeof quickBotLineup === 'function'){
    const lineup = quickBotLineup(clubId);
    if(Array.isArray(lineup) && lineup.length) return lineup;
  }
  const squad = typeof playersByClub === 'function' ? playersByClub(clubId) : [];
  return (squad || [])
    .filter(player => !player?.id || typeof isUnavailable !== 'function' || !isUnavailable(player.id))
    .sort((a,b) => Number((typeof effectiveOverall === 'function' ? effectiveOverall(b) : b?.overall) || 0) - Number((typeof effectiveOverall === 'function' ? effectiveOverall(a) : a?.overall) || 0))
    .slice(0, 11);
}
function integrityPickRepairPlayer(lineup=[], role='goal'){
  const list = (lineup || []).filter(player => Number(player?.id || 0) > 0);
  if(!list.length) return null;
  const posScore = player => {
    const pos = String(player?.position || '').toUpperCase();
    if(role === 'assist') return ['MCO','MC','MD','MI','ED','EI'].includes(pos) ? 6 : ['LD','LI','MCD'].includes(pos) ? 3 : 1;
    if(role === 'save') return pos === 'POR' ? 20 : 1;
    if(pos === 'DC') return 9;
    if(['ED','EI','MCO'].includes(pos)) return 6;
    if(['MC','MD','MI'].includes(pos)) return 3;
    if(['DFC','LD','LI','MCD'].includes(pos)) return 1.5;
    return 0.7;
  };
  const weighted = list.map(player => ({ player, weight:Math.max(1, Number(posScore(player)) || 1) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for(const item of weighted){
    roll -= item.weight;
    if(roll <= 0) return item.player;
  }
  return weighted[0].player;
}
function integrityBuildRepairGoals(clubId, lineup, count){
  const goals = [];
  const total = Math.max(0, Math.round(Number(count || 0)));
  for(let i=0; i<total; i++){
    const scorer = integrityPickRepairPlayer(lineup, 'goal');
    if(!scorer) return null;
    const assistants = (lineup || []).filter(player => Number(player?.id) !== Number(scorer.id));
    const assister = assistants.length && Math.random() < 0.70 ? integrityPickRepairPlayer(assistants, 'assist') : null;
    goals.push({
      clubId:Number(clubId),
      playerId:Number(scorer.id),
      assistId:assister ? Number(assister.id) : null,
      minute:Math.max(1, Math.min(90, Math.round(8 + Math.random() * 80))),
      integrityRepair:true
    });
  }
  return goals.sort((a,b) => a.minute - b.minute);
}
function integrityBuildRepairStats(match, score){
  const homeRating = typeof quickClubRating === 'function' ? quickClubRating(match.homeId) : 55;
  const awayRating = typeof quickClubRating === 'function' ? quickClubRating(match.awayId) : 55;
  const homeChances = Math.max(score.homeGoals, Math.round(4 + score.homeGoals * 2 + Math.random() * 6));
  const awayChances = Math.max(score.awayGoals, Math.round(4 + score.awayGoals * 2 + Math.random() * 6));
  const homePoss = Math.max(35, Math.min(65, Math.round(50 + (homeRating - awayRating) * 0.25 + Math.random() * 10 - 5)));
  const awayPoss = 100 - homePoss;
  return {
    home:{ attacks:Math.max(12, Math.round(24 + homeChances * 3)), chances:homeChances, possession:homePoss, fouls:Math.round(6 + Math.random() * 11), passScore:Math.round(homeRating), xg:Number(Math.max(0.2, score.homeGoals * 0.75 + homeChances * 0.11).toFixed(2)), keySaves:0, errors:0, goalErrors:0 },
    away:{ attacks:Math.max(12, Math.round(22 + awayChances * 3)), chances:awayChances, possession:awayPoss, fouls:Math.round(6 + Math.random() * 11), passScore:Math.round(awayRating), xg:Number(Math.max(0.2, score.awayGoals * 0.75 + awayChances * 0.11).toFixed(2)), keySaves:0, errors:0, goalErrors:0 }
  };
}
function integrityGenerateBotFixtureDetails(match, round){
  const score = integrityMatchFiniteScore(match);
  if(!score) return null;
  const homeLineup = integrityBotLineupForRepair(match.homeId);
  const awayLineup = integrityBotLineupForRepair(match.awayId);
  if(!homeLineup.length || !awayLineup.length) return null;
  const homeGoals = integrityBuildRepairGoals(match.homeId, homeLineup, score.homeGoals);
  const awayGoals = integrityBuildRepairGoals(match.awayId, awayLineup, score.awayGoals);
  if(!homeGoals || !awayGoals) return null;
  const starterIdsHome = homeLineup.map(player => Number(player.id)).filter(Number.isFinite);
  const starterIdsAway = awayLineup.map(player => Number(player.id)).filter(Number.isFinite);
  const date = integrityMatchComparableDate(match, round);
  return {
    ...integrityClonePlain(match),
    played:true,
    date:validIsoDate(date) ? date : match.date,
    homeGoals:score.homeGoals,
    awayGoals:score.awayGoals,
    goals:homeGoals.concat(awayGoals).sort((a,b) => a.minute - b.minute),
    cards:Array.isArray(match.cards) ? match.cards : [],
    injuries:Array.isArray(match.injuries) ? match.injuries : [],
    substitutions:Array.isArray(match.substitutions) ? match.substitutions : [],
    keySaves:Array.isArray(match.keySaves) ? match.keySaves : [],
    errors:Array.isArray(match.errors) ? match.errors : [],
    matchStats:integrityBuildRepairStats(match, score),
    matchContext:match.matchContext || { weather:'Normal', pitch:'Normal', integrityRepair:true },
    starterIdsHome,
    starterIdsAway,
    playedIdsHome:starterIdsHome,
    playedIdsAway:starterIdsAway,
    instructionConditionDeltas:match.instructionConditionDeltas || {},
    engine:match.engine || 'bot-integrity-repair-v5.33',
    integrityRepair:true
  };
}
function integrityCopyBotMatchDetails(target, source){
  if(!target || !source) return false;
  const fields = [
    'played','homeGoals','awayGoals','goals','cards','injuries','substitutions','keySaves','errors',
    'matchStats','matchContext','starterIdsHome','starterIdsAway','playedIdsHome','playedIdsAway',
    'instructionConditionDeltas','botOverexertionEvents','engine','suspended','defaultWin','defaultLoss','suspensionReason','integrityRepair'
  ];
  fields.forEach(field => {
    if(Object.prototype.hasOwnProperty.call(source, field)) target[field] = integrityClonePlain(source[field]);
  });
  target.played = true;
  if(source.date) target.date = source.date;
  return true;
}
function integrityRecentRoundCandidates(today, options={}){
  const fixtures = Array.isArray(game?.fixtures) ? game.fixtures : [];
  if(Boolean(options.force)) return fixtures;
  const currentIndex = Math.max(0, Number(game?.matchdayIndex || 0));
  const recentFrom = validIsoDate(today) && typeof addDaysToIsoDate === 'function' ? addDaysToIsoDate(today, -3) : '';
  return fixtures.filter((round, roundIndex) => {
    if(Math.abs(roundIndex - currentIndex) <= 2) return true;
    return (round?.matches || []).some(match => {
      if(!match?.played || matchHasMinimumBotStats(match)) return false;
      const date = String(match.date || match.roundDate || round?.date || round?.roundDate || '').slice(0,10);
      if(!validIsoDate(date) || !validIsoDate(today)) return false;
      return (!recentFrom || date >= recentFrom) && date <= today;
    });
  });
}
function runDailyMatchStatsIntegrityRepair(options={}){
  const summary = { checked:0, fixed:0, fixedFromHistory:0, fixedGenerated:0, skipped:0, remaining:0, scope:Boolean(options.force) ? 'full' : 'recent', scannedRounds:0 };
  if(!game?.fixtures?.length) return summary;
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  const force = Boolean(options.force);
  if(!force && game.lastMatchStatsIntegrityRepairDate === today) return game.lastMatchStatsIntegrityRepairSummary || summary;
  const rounds = integrityRecentRoundCandidates(today, options);
  summary.scannedRounds = rounds.length;
  const unresolved = [];
  rounds.forEach((round) => {
    (round.matches || []).forEach(match => {
      if(!match?.played) return;
      if(typeof ownClubInMatch === 'function' && ownClubInMatch(match)) return;
      if(matchHasMinimumBotStats(match)) return;
      summary.checked += 1;
      const validHistory = integrityHistoryRecordForFixture(match, round, true);
      const existingHistory = integrityHistoryRecordForFixture(match, round, false);
      if(validHistory){
        integrityCopyBotMatchDetails(match, validHistory);
        summary.fixed += 1;
        summary.fixedFromHistory += 1;
        return;
      }
      const generated = integrityGenerateBotFixtureDetails(match, round);
      if(generated && matchHasMinimumBotStats(generated)){
        integrityCopyBotMatchDetails(match, generated);
        if(existingHistory) integrityCopyBotMatchDetails(existingHistory, generated);
        else {
          game.matchHistory = Array.isArray(game.matchHistory) ? game.matchHistory : [];
          game.matchHistory.push(integrityClonePlain(generated));
        }
        summary.fixed += 1;
        summary.fixedGenerated += 1;
        return;
      }
      summary.skipped += 1;
      unresolved.push(match);
    });
  });
  summary.remaining = force ? botMatchStatsIntegrityIssues().length : unresolved.length;
  game.lastMatchStatsIntegrityRepairDate = today;
  game.lastMatchStatsIntegrityRepairSummary = { ...summary, reason:options.reason || 'daily', checkedAt:new Date().toISOString() };
  if(summary.fixed > 0){
    game.matchIntegrityRepairLog = Array.isArray(game.matchIntegrityRepairLog) ? game.matchIntegrityRepairLog.slice(-20) : [];
    game.matchIntegrityRepairLog.push({ ...game.lastMatchStatsIntegrityRepairSummary });
  }
  if(summary.fixed > 0 && !options.silent && typeof showNotice === 'function'){
    showNotice(`Se repararon ${summary.fixed} partido(s) bot con estadísticas mínimas faltantes.`, false);
  }
  return summary;
}

function currentFreeAgentIntegrityCount(){
  const ids = new Set();
  (game?.marketPlayers || []).forEach(player => { if(Number(player?.clubId || 0) === 0) ids.add(Number(player.id)); });
  (seed?.players || []).forEach(player => { if(Number(player?.clubId || 0) === 0) ids.add(Number(player.id)); });
  return Array.from(ids).filter(Number.isFinite).length;
}
function inspectGameIntegrity(){
  const result = {
    ok:true,
    checkedAt:new Date().toISOString(),
    issues:[],
    warnings:[],
    repairables:[],
    stats:{ clubs:Number(seed?.clubs?.length || 0), divisions:Number(seed?.divisions?.length || 0), players:Number(seed?.players?.length || 0), freeAgents:currentFreeAgentIntegrityCount(), fixtures:Number(game?.fixtures?.length || 0) },
    canRepair:false
  };
  if(!seed?.clubs?.length || !seed?.divisions?.length){
    result.ok = false;
    result.issues.push({ type:'base_missing', severity:'high', title:'Base incompleta', detail:'No se cargaron clubes o divisiones suficientes para verificar.' });
    return result;
  }
  if(!game){
    result.warnings.push({ type:'no_game', severity:'low', title:'Sin partida activa', detail:'La base cargó bien, pero no hay partida guardada/activa para verificar estado interno.' });
    return result;
  }
  const divisionsById = integrityDivisionById();
  const validClubIds = new Set((seed.clubs || []).map(club => Number(club.id)));
  const duplicateClubIds = [];
  const seenClubIds = new Set();
  (seed.clubs || []).forEach(club => {
    const id = Number(club.id);
    if(seenClubIds.has(id)) duplicateClubIds.push(id);
    seenClubIds.add(id);
  });
  if(duplicateClubIds.length){
    result.ok = false;
    result.issues.push({ type:'duplicate_club_ids', severity:'high', title:'IDs de clubes duplicados', detail:`Hay ${duplicateClubIds.length} IDs repetidos. Esto requiere revisión manual.`, samples:duplicateClubIds.slice(0,8) });
  }
  const crossCountryClubs = [];
  const invalidDivisionClubs = [];
  integrityNormalClubs().forEach(club => {
    const divisionId = String(club.divisionId || 'default');
    const division = divisionsById[divisionId];
    if(!division){
      const target = nativeTargetDivisionForClub(club, null);
      invalidDivisionClubs.push({ clubId:club.id, clubName:club.name, divisionId, targetDivisionId:target?.id || '', targetDivisionName:target?.name || '' });
      return;
    }
    const clubCountry = clubCountryKeyForIntegrity(club);
    const divCountry = divisionCountryKey(division);
    if(clubCountry && divCountry && clubCountry !== divCountry){
      const target = nativeTargetDivisionForClub(club, division);
      crossCountryClubs.push({
        clubId:club.id,
        clubName:club.name,
        clubCountry:club.country || club.pais || clubCountry,
        currentDivisionId:division.id,
        currentDivisionName:division.name,
        currentDivisionCountry:division.country || divCountry,
        targetDivisionId:target?.id || '',
        targetDivisionName:target?.name || ''
      });
    }
  });
  if(invalidDivisionClubs.length){
    result.ok = false;
    result.issues.push({ type:'invalid_club_division', severity:'high', title:'Clubes con división inexistente', detail:`Hay ${invalidDivisionClubs.length} clubes apuntando a divisiones que no existen.`, samples:invalidDivisionClubs.slice(0,8) });
    result.repairables.push({ type:'invalid_club_division', title:'Reasignar clubes con división inexistente a una división válida de su país', count:invalidDivisionClubs.filter(item => item.targetDivisionId).length, items:invalidDivisionClubs });
  }
  if(crossCountryClubs.length){
    result.ok = false;
    result.issues.push({ type:'cross_country_clubs', severity:'high', title:'Clubes en ligas de otro país', detail:`Hay ${crossCountryClubs.length} clubes ubicados en una división de otro país.`, samples:crossCountryClubs.slice(0,8) });
    result.repairables.push({ type:'cross_country_clubs', title:'Reasignar clubes a una división válida de su país', count:crossCountryClubs.filter(item => item.targetDivisionId).length, items:crossCountryClubs });
  }
  const overrides = game?.clubDivisionOverrides || {};
  const invalidOverrides = [];
  Object.entries(overrides).forEach(([clubId, override]) => {
    const club = (seed.clubs || []).find(item => Number(item.id) === Number(clubId));
    if(club && isSpecialCompetitionOnlyClub(club)) return;
    const division = divisionsById[String(override?.divisionId || '')];
    if(!club || !division){
      invalidOverrides.push({ clubId, clubName:club?.name || 'Club inexistente', divisionId:override?.divisionId || '' });
      return;
    }
    const clubCountry = clubCountryKeyForIntegrity(club);
    const divCountry = divisionCountryKey(division);
    if(clubCountry && divCountry && clubCountry !== divCountry){
      invalidOverrides.push({ clubId, clubName:club.name, divisionId:division.id, divisionName:division.name, clubCountry:club.country || clubCountry, divisionCountry:division.country || divCountry });
    }
  });
  if(invalidOverrides.length){
    result.ok = false;
    result.issues.push({ type:'invalid_division_overrides', severity:'medium', title:'Overrides de división inconsistentes', detail:`Hay ${invalidOverrides.length} asignaciones guardadas con división inválida o de otro país.`, samples:invalidOverrides.slice(0,8) });
    result.repairables.push({ type:'invalid_division_overrides', title:'Regenerar overrides desde la estructura actual reparada', count:invalidOverrides.length, items:invalidOverrides });
  }
  const invalidPlayers = (seed.players || []).filter(player => Number(player.clubId || 0) > 0 && !validClubIds.has(Number(player.clubId)));
  if(invalidPlayers.length){
    result.ok = false;
    result.issues.push({ type:'invalid_player_clubs', severity:'medium', title:'Jugadores con club inexistente', detail:`Hay ${invalidPlayers.length} jugadores asignados a clubes que no existen.`, samples:invalidPlayers.slice(0,8).map(p => ({ id:p.id, name:p.name, clubId:p.clubId })) });
  }
  if(game?.selectedClubId && !validClubIds.has(Number(game.selectedClubId))){
    result.ok = false;
    result.issues.push({ type:'invalid_selected_club', severity:'high', title:'Club del manager inexistente', detail:`El club seleccionado (${game.selectedClubId}) no existe en la base actual.` });
  }
  const invalidStandingIds = Object.keys(game?.standings || {}).filter(id => !validClubIds.has(Number(id)));
  if(invalidStandingIds.length){
    result.ok = false;
    result.issues.push({ type:'invalid_standings', severity:'medium', title:'Tabla con clubes inexistentes', detail:`Hay ${invalidStandingIds.length} entradas de tabla de clubes inexistentes.`, samples:invalidStandingIds.slice(0,8) });
  }
  const fixtureIssues = fixtureCountryIssues();
  if(fixtureIssues.length){
    const playedFixtureIssues = fixtureIssues.filter(item => item.played);
    const unplayedFixtureIssues = fixtureIssues.filter(item => !item.played);
    result.ok = false;
    const detail = playedFixtureIssues.length
      ? `Hay ${fixtureIssues.length} partidos cuyo país no coincide con la división del fixture. ${playedFixtureIssues.length} ya fueron jugados y no se reconstruyen automáticamente para no borrar resultados.`
      : `Hay ${fixtureIssues.length} partidos cuyo país no coincide con la división del fixture. Como no están jugados, pueden regenerarse de forma segura.`;
    result.warnings.push({ type:'fixture_cross_country', severity:'medium', title:'Calendario con partidos cruzados', detail, samples:fixtureIssues.slice(0,8) });
    if(unplayedFixtureIssues.length && !playedFixtureIssues.length){
      result.repairables.push({ type:'rebuild_cross_country_fixtures', title:'Regenerar calendario no jugado para quitar partidos cruzados', count:unplayedFixtureIssues.length, items:unplayedFixtureIssues });
    }
  }
  const botStatsIssues = botMatchStatsIntegrityIssues();
  result.stats.botMatchesWithMissingStats = botStatsIssues.length;
  if(botStatsIssues.length){
    result.ok = false;
    result.warnings.push({ type:'bot_match_min_stats_missing', severity:'medium', title:'Partidos bot sin estadísticas mínimas', detail:`Hay ${botStatsIssues.length} partido(s) bot jugados sin datos mínimos de goleadores, asistentes, tarjetas, lesiones, tapadas o errores. Se pueden completar copiando el historial válido o agregando datos conservadores sin alterar marcador ni tabla.`, samples:botStatsIssues.slice(0,8) });
    result.repairables.push({ type:'bot_match_min_stats_missing', title:'Completar estadísticas mínimas faltantes en partidos bot ya jugados', count:botStatsIssues.length, items:botStatsIssues });
  }
  const freeCap = Number(typeof MARKET_FREE_AGENT_HARD_MAX !== 'undefined' ? MARKET_FREE_AGENT_HARD_MAX : 300);
  if(result.stats.freeAgents > freeCap){
    result.ok = false;
    result.warnings.push({ type:'free_agents_over_cap', severity:'low', title:'Mercado libre excedido', detail:`Hay ${result.stats.freeAgents} libres y el máximo configurado es ${freeCap}. La limpieza automática de mercado debería recortarlo en carga/temporada.` });
  }
  const divisionCounts = divisionCountIntegrityRows();
  result.stats.divisionCounts = divisionCounts;
  const countMismatches = divisionCounts.filter(item => Number(item.count || 0) !== Number(item.expected || 0));
  if(countMismatches.length){
    result.ok = false;
    const repairPlan = buildDivisionCountRepairPlan();
    result.warnings.push({ type:'division_team_count_mismatch', severity:'medium', title:'Ligas con cantidad incorrecta de clubes', detail:`Hay ${countMismatches.length} división(es) que no tienen su cantidad esperada de clubes.`, samples:countMismatches.slice(0,8) });
    if(repairPlan.length){
      result.repairables.push({ type:'division_team_count_mismatch', title:'Completar ligas moviendo únicamente clubes sin división confirmada por el calendario vigente', count:repairPlan.length, items:repairPlan });
    }
  }
  result.canRepair = result.repairables.some(item => Number(item.count || 0) > 0);
  return result;
}
function integritySeverityLabel(severity){
  if(severity === 'high') return 'grave';
  if(severity === 'medium') return 'medio';
  return 'leve';
}
function integrityIssueMarkup(item){
  const samples = Array.isArray(item.samples) && item.samples.length
    ? `<details class="integrity-samples"><summary>Ver ejemplos</summary><pre>${escapeHtml(JSON.stringify(item.samples, null, 2))}</pre></details>`
    : '';
  return `<li class="integrity-item integrity-${escapeHtml(item.severity || 'low')}"><strong>${escapeHtml(item.title || 'Aviso')}</strong><span>${escapeHtml(integritySeverityLabel(item.severity || 'low'))}</span><p>${escapeHtml(item.detail || '')}</p>${samples}</li>`;
}
function showGameIntegrityModal(result=inspectGameIntegrity(), repaired=false){
  const issueItems = (result.issues || []).map(integrityIssueMarkup).join('');
  const warningItems = (result.warnings || []).map(integrityIssueMarkup).join('');
  const divisionRows = (result.stats?.divisionCounts || []).map(item => { const bad = Number(item.count || 0) !== Number(item.expected || item.count || 0); return `<tr class="${bad ? 'integrity-row-warn' : ''}"><td>${escapeHtml(item.country || '—')}</td><td>${escapeHtml(item.name || item.id)}</td><td>${Number(item.count || 0)} / ${Number(item.expected || item.count || 0)}</td></tr>`; }).join('');
  const repairRows = (result.repairables || []).filter(item => Number(item.count || 0) > 0).map(item => `<li><strong>${escapeHtml(item.title)}</strong><span>${Number(item.count || 0)} caso(s)</span></li>`).join('');
  const stateLabel = result.ok ? 'Todo correcto' : (result.canRepair ? 'Hay reparaciones seguras disponibles' : 'Hay avisos para revisar');
  const body = `<div class="integrity-modal">
    <p class="eyebrow">Verificador de estructura</p>
    <h2>${escapeHtml(stateLabel)}</h2>
    <p class="muted">Este chequeo no reinicia la partida y no borra resultados. La reparación segura reasigna clubes que quedaron en una liga de otro país, completa divisiones con cupos incorrectos, regenera el mapa de divisiones guardado, puede reconstruir calendarios cruzados no jugados y completa estadísticas mínimas de partidos bot ya jugados sin alterar marcador ni tabla.</p>
    ${repaired ? '<div class="notice-inline good">Reparación segura aplicada y partida guardada.</div>' : ''}
    <div class="integrity-summary-grid">
      <div><span>Clubes</span><strong>${Number(result.stats?.clubs || 0)}</strong></div>
      <div><span>Divisiones</span><strong>${Number(result.stats?.divisions || 0)}</strong></div>
      <div><span>Jugadores</span><strong>${Number(result.stats?.players || 0)}</strong></div>
      <div><span>Libres</span><strong>${Number(result.stats?.freeAgents || 0)}</strong></div>
    </div>
    ${issueItems ? `<h3>Problemas detectados</h3><ul class="integrity-list">${issueItems}</ul>` : '<div class="notice-inline good">No se detectaron problemas graves de estructura.</div>'}
    ${warningItems ? `<h3>Advertencias</h3><ul class="integrity-list">${warningItems}</ul>` : ''}
    ${repairRows ? `<h3>Reparaciones seguras</h3><ul class="integrity-repair-list">${repairRows}</ul><div class="row message-actions"><button class="primary" data-apply-integrity-repair>Aplicar reparaciones seguras</button></div>` : ''}
    <h3>Clubes por división actual</h3>
    <div class="table-wrap compact-table"><table><thead><tr><th>País</th><th>División</th><th>Clubes / esperado</th></tr></thead><tbody>${divisionRows}</tbody></table></div>
  </div>`;
  if(typeof openModal === 'function'){
    openModal(body);
    document.querySelector('[data-apply-integrity-repair]')?.addEventListener('click', async () => {
      const next = await applySafeGameIntegrityRepairs();
      showGameIntegrityModal(next, true);
    });
  }else{
    showNotice(result.ok ? 'Verificación correcta.' : 'Verificación completada con avisos.', true);
  }
}
function applySafeGameIntegrityRepairsCore(options={}){
  const before = inspectGameIntegrity();
  const divisionsById = integrityDivisionById();
  let repaired = 0;
  let fixturesRebuilt = 0;
  let statsFixed = 0;
  const fixtureAuthorityRepair = restoreClubDivisionsFromSeasonFixtures(game, { reason:options.reason || 'integrity_repair', message:options.message !== false });
  repaired += Number(fixtureAuthorityRepair.repaired || 0);
  const countryRepair = repairCrossCountryClubAssignments({ restoreNativeIfNeeded:false });
  repaired += Number(countryRepair.repaired || 0);

  if(options.allowDivisionCountRepair === true){
    let countPlan = buildDivisionCountRepairPlan();
    let guard = 0;
    while(countPlan.length && guard < 6){
      countPlan.forEach(item => {
        const club = (seed?.clubs || []).find(club => Number(club.id) === Number(item.clubId));
        const target = divisionsById[String(item.toDivisionId || '')];
        if(!club || !target) return;
        if(divisionCountryKey(target) !== clubCountryKeyForIntegrity(club)) return;
        if(setClubIntegrityDivision(club, target)) repaired += 1;
      });
      const nextPlan = buildDivisionCountRepairPlan();
      if(!nextPlan.length || nextPlan.length === countPlan.length) break;
      countPlan = nextPlan;
      guard += 1;
    }
  }

  const fixtureRepair = rebuildSafeSeasonFixturesAfterStructureRepair();
  if(fixtureRepair.rebuilt) fixturesRebuilt = Number(fixtureRepair.fixed || 0);

  if(typeof runDailyMatchStatsIntegrityRepair === 'function'){
    const statsRepair = runDailyMatchStatsIntegrityRepair({ reason:options.reason || 'manual_integrity_repair', force:true, silent:true });
    statsFixed = Number(statsRepair.fixed || 0);
  }

  if(game){
    game.clubDivisionOverrides = snapshotClubDivisionOverrides();
    const selectedClub = seed.clubs.find(club => Number(club.id) === Number(game.selectedClubId));
    if(selectedClub) game.selectedLeagueId = selectedClub.divisionId || game.selectedLeagueId;
  }
  const after = inspectGameIntegrity();
  after.repairedCount = repaired;
  after.fixturesRebuiltCount = fixturesRebuilt;
  after.botStatsRepairedCount = statsFixed;
  after.previousIssues = before.issues || [];
  after.changed = Boolean(repaired > 0 || fixturesRebuilt > 0 || statsFixed > 0);
  return after;
}

async function applySafeGameIntegrityRepairs(options={}){
  const after = applySafeGameIntegrityRepairsCore({ reason:options.reason || 'manual_integrity_repair', allowDivisionCountRepair:true, message:true });
  const changed = Boolean(after.changed);
  if(changed && options.save !== false && typeof saveLocal === 'function') await saveLocal(true);
  if(changed && options.render !== false && typeof renderAll === 'function') renderAll();
  if(options.silent !== true){
    if(changed){
      const parts = [];
      if(after.repairedCount > 0) parts.push(`${after.repairedCount} movimiento(s) de estructura`);
      if(after.fixturesRebuiltCount > 0) parts.push(`${after.fixturesRebuiltCount} partido(s) de calendario regenerados`);
      if(after.botStatsRepairedCount > 0) parts.push(`${after.botStatsRepairedCount} partido(s) con estadísticas completadas`);
      showNotice(`Verificación: ${parts.join(' y ')} aplicados.`, false);
    }else{
      showNotice('Verificación completada. No había reparaciones seguras para aplicar.', false);
    }
  }
  return after;
}

const SIDEBAR_GROUP_STORAGE_KEY = 'fm-sidebar-open-group-v7';
function sidebarNavigationModeForTab(tab){
  const key = String(tab || '');
  if(key === 'stadium'){ const mode = String(stadiumViewMode || 'main'); return ['sponsors','fans'].includes(mode) ? mode : 'main'; }
  if(key === 'finance') return String(financeViewMode || 'main');
  if(key === 'fixture') return String(fixtureViewMode || 'mine') === 'clubWorldCup' ? 'clubWorldCup' : 'mine';
  if(key === 'standings'){
    const mode = String(selectedCompetitionView || 'league');
    if(['standings','stats','league','league-stats'].includes(mode)) return 'league';
    if(['national-cups','national-cup','national-cup-stats'].includes(mode)) return 'national-cup';
    if(['libertadores','champions-league','continental','continental-qualifiers','continental-stats'].includes(mode)) return 'continental';
    if(['club-world-cup','club-world-cup-qualifiers','club-world-cup-stats'].includes(mode)) return 'club-world-cup';
    if(['rankings','rankings-clubs','rankings-players','rankings-palmares','club-ranking','player-ranking','player-palmares','champions'].includes(mode)) return 'rankings';
    return 'league';
  }
  if(key === 'mystats') return String(managerStatsViewMode || 'profile');
  return '';
}
function sidebarGroupForTab(tab){
  const key = String(tab || '');
  if(key === 'special') return 'special';
  if(['firstTeam','scouting','market'].includes(key)) return 'team';
  if(['employees','stadium'].includes(key)) return 'club';
  if(['fixture','standings','stats'].includes(key)) return 'competition';
  if(['academy','careerImprovements','mystats','philosophy','careerJobs','finance'].includes(key)) return key === 'finance' && String(financeViewMode || 'main') === 'main' ? 'club' : 'career';
  if(['ranking','challenges'].includes(key)) return 'online';
  return '';
}
function setSidebarOpenGroup(groupName='', { persist=true }={}){
  sidebarOpenGroup = String(groupName || '');
  document.querySelectorAll('.sidebar-nav .nav-group').forEach(group => {
    const open = Boolean(sidebarOpenGroup && group.dataset.navGroup === sidebarOpenGroup);
    group.classList.toggle('is-open', open);
    group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  if(persist){
    try{ localStorage.setItem(SIDEBAR_GROUP_STORAGE_KEY, sidebarOpenGroup); }catch(_err){}
  }
}
function prepareSidebarNavigation(tab, mode=''){
  const key = String(tab || 'home');
  const selectedMode = String(mode || '');
  if(key === 'stadium') stadiumViewMode = selectedMode || 'main';
  if(key === 'finance') financeViewMode = selectedMode || 'main';
  if(key === 'fixture') fixtureViewMode = selectedMode || 'mine';
  if(key === 'standings') selectedCompetitionView = selectedMode || 'standings';
  if(key === 'mystats') managerStatsViewMode = selectedMode || 'profile';
  const group = sidebarGroupForTab(key);
  if(group) setSidebarOpenGroup(group);
}
function sidebarLeafIsActive(button){
  if(!button?.dataset?.tab || String(button.dataset.tab) !== String(activeTab || '')) return false;
  const requestedMode = String(button.dataset.navMode || '');
  return !requestedMode || requestedMode === sidebarNavigationModeForTab(activeTab);
}
function syncSidebarNavigationState(){
  let activeGroup = '';
  document.querySelectorAll('.sidebar-nav [data-tab]').forEach(button => {
    const active = sidebarLeafIsActive(button);
    button.classList.toggle('active', active);
    if(active) activeGroup = button.closest('.nav-group')?.dataset.navGroup || '';
  });
  document.querySelectorAll('.sidebar-nav .nav-group').forEach(group => {
    group.classList.toggle('has-active', group.dataset.navGroup === activeGroup);
  });
  if(!sidebarOpenGroup){
    try{ sidebarOpenGroup = localStorage.getItem(SIDEBAR_GROUP_STORAGE_KEY) || activeGroup || ''; }catch(_err){ sidebarOpenGroup = activeGroup || ''; }
  }
  setSidebarOpenGroup(sidebarOpenGroup, { persist:false });
}
function bindSidebarGroupToggles(){
  document.querySelectorAll('.sidebar-nav .nav-group-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const group = toggle.closest('.nav-group')?.dataset.navGroup || '';
      setSidebarOpenGroup(sidebarOpenGroup === group ? '' : group);
    });
  });
}

function bindEvents(){
  $('btnOpenNewGame')?.addEventListener('click', () => { if(typeof goToSaveSlotsMenu === 'function') goToSaveSlotsMenu({ saveCurrent:true, reloadSeed:true, notice:'Menú de partida.' }); else openNewGameModal(); });
  $('btnNewGame')?.addEventListener('click', ()=> newGame(Number($('clubSelect')?.value || 0), { managerName:storedManagerName() }));
  $('btnManagerCourses')?.addEventListener('click', () => { if(typeof openManagerCoursesModal === 'function') openManagerCoursesModal(); });
  $('btnLogin')?.addEventListener('click', () => { if(typeof openRankingLoginModal === 'function') openRankingLoginModal(); });
  $('btnOnlineChallengeAvailable')?.addEventListener('click', () => { if(typeof challengeOpenMatchingAvailable === 'function') challengeOpenMatchingAvailable(); });
  $('btnHelp')?.addEventListener('click', () => { if(typeof openGameHelpModal === 'function') openGameHelpModal(); });
  $('btnAssistantMessagesToggle')?.addEventListener('click', () => {
    if(!game) return;
    game.assistantMessagesEnabled = game.assistantMessagesEnabled === false;
    saveLocal(true);
    if(typeof updateAssistantMessagesToggle === 'function') updateAssistantMessagesToggle();
    showNotice(game.assistantMessagesEnabled === false ? 'Mensajes del ayudante desactivados.' : 'Mensajes del ayudante activados.');
  });
  $('btnSave')?.addEventListener('click', () => {
    Promise.resolve(saveLocal(false)).catch(() => undefined);
  });
  $('btnLoad').addEventListener('click', () => { if(typeof goToSaveSlotsMenu === 'function') goToSaveSlotsMenu({ saveCurrent:true, reloadSeed:true, notice:'Menú de partida.' }); else loadLocal(false); });
  $('topResignClubBtn')?.addEventListener('click', resignCurrentClub);
  document.querySelectorAll('.tabs [data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const targetTab = btn.dataset.tab;
      prepareSidebarNavigation(targetTab, btn.dataset.navMode || '');
      if(typeof isManagerWithoutClubBlockedTab === 'function' && isManagerWithoutClubBlockedTab(targetTab)){
        activeTab = 'home';
        if(typeof managerWithoutClubBlockedNotice === 'function') showNotice(managerWithoutClubBlockedNotice(targetTab));
        renderAll();
        return;
      }
      activeTab = targetTab;
      if(typeof resetManagerDivisionFilterForTab === 'function') resetManagerDivisionFilterForTab(activeTab);
      renderAll();
    });
  });
  bindSidebarGroupToggles();
  syncSidebarNavigationState();
  if(typeof rankingUpdateTopLoginButton === 'function') rankingUpdateTopLoginButton();
  if(typeof syncPrivateManagerToolsNavigation === 'function') syncPrivateManagerToolsNavigation();
  document.addEventListener('click', (event)=>{
    const playerBtn = event.target.closest('[data-player-id]');
    if(playerBtn){ showPlayerModal(Number(playerBtn.dataset.playerId)); return; }
    const clubBtn = event.target.closest('[data-club-id]');
    if(clubBtn){ showClubModal(Number(clubBtn.dataset.clubId)); return; }
    const matchBtn = event.target.closest('[data-match-id]');
    if(matchBtn){ showMatchModal(matchBtn.dataset.matchId); return; }
    if(event.target.closest('[data-open-manager-achievements]')){
      if(typeof openManagerAchievementsFromMessage === 'function') openManagerAchievementsFromMessage();
      return;
    }
    if(event.target.closest('[data-open-employees]')){
      if(typeof openEmployeesFromMessage === 'function') openEmployeesFromMessage();
      return;
    }
    if(event.target.closest('[data-open-messages]')){ activeTab='messages'; renderAll(); return; }
    const mentalityBtn = event.target.closest('[data-toggle-mentality]');
    if(mentalityBtn){
      const playerId = Number(mentalityBtn.dataset.toggleMentality);
      if(game?.tactic?.starters?.includes(playerId)){
        game.tactic = applyStarterMentalities(game.tactic);
        setPlayerMentality(playerId, nextMentality(playerMentality(playerId)), game.tactic);
        saveLocal(true);
        renderTactics();
      }
      return;
    }
    const close = event.target.closest('[data-close-modal]');
    if(close || event.target.classList.contains('modal-backdrop')){
      if(typeof completedChallengeResultModalActive === 'function' && completedChallengeResultModalActive()) closeCompletedChallengeResultScreen();
      else closeModal();
    }
  });
  document.addEventListener('keydown', (event)=>{
    if(event.key !== 'Escape') return;
    if(typeof completedChallengeResultModalActive === 'function' && completedChallengeResultModalActive()) closeCompletedChallengeResultScreen();
    else closeModal();
  });
}

function startUiTicker(){
  clearInterval(uiTicker);
  let tick = 0;
  uiTicker = setInterval(()=>{
    if(typeof document !== 'undefined' && document.hidden) return;
    tick += 1;
    if(!game || activeTab !== 'home') return;
    const lockLeft = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs() : Math.max(0, Number(game.advanceLockedUntil || 0) - Date.now());
    // Durante el cooldown se actualiza cada segundo. Fuera de él alcanza con una revisión cada 5 segundos.
    if(lockLeft > 0 || tick % 5 === 0) updateAdvanceButtonState();
  }, 1000);
}
function generateSaveCode(){
  const raw = `${Date.now()}-${Math.random()}-${navigator.userAgent || ''}`;
  return `FM-${Date.now().toString(36).toUpperCase()}-${hashNumber(raw, 1000000).toString().padStart(6,'0')}`;
}

function normalizeSectorStyleValue(value){
  const clean = String(value || '').trim();
  const aliases = { presion:'presion_alta', presionAlta:'presion_alta', presion_alta:'presion_alta', rotacion:'rotacion', rotación:'rotacion', posicional:'posicional', repliegue:'repliegue' };
  const normalized = aliases[clean] || clean;
  const valid = new Set((typeof TACTIC_SECTOR_STYLE_OPTIONS !== 'undefined' ? TACTIC_SECTOR_STYLE_OPTIONS : []).map(opt => opt.value));
  return valid.has(normalized) ? normalized : 'posicional';
}
function normalizeSectorStyles(styles){
  const base = typeof DEFAULT_TACTIC_SECTOR_STYLES !== 'undefined' ? DEFAULT_TACTIC_SECTOR_STYLES : { defense:'posicional', midfield:'posicional', attack:'posicional' };
  const src = styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {};
  return {
    defense: normalizeSectorStyleValue(src.defense || src.defensa || base.defense),
    midfield: normalizeSectorStyleValue(src.midfield || src.medios || src.medio || base.midfield),
    attack: normalizeSectorStyleValue(src.attack || src.delanteros || src.delantera || base.attack)
  };
}
function normalizeSavedCustomAssignments(raw, fallbackStarters=[]){
  const source = raw && typeof raw === 'object' ? raw : {};
  const legacyStarters = Array.isArray(fallbackStarters) ? fallbackStarters.slice(0,11).map(id => Number(id) || 0) : [];
  const legacySlots = typeof normalizeCustomTacticSlots === 'function'
    ? normalizeCustomTacticSlots(source.customSlots, source)
    : (Array.isArray(source.customSlots) ? source.customSlots.slice(0,11).map(String) : []);
  const incoming = Array.isArray(source.customAssignments) ? source.customAssignments : [];
  const assignments = [];
  const usedCells = new Set();
  const usedPlayers = new Set();
  const add = (cellId, playerId=0) => {
    const cell = String(cellId || '');
    if(!cell || usedCells.has(cell)) return;
    if(typeof customTacticCell === 'function' && !customTacticCell(cell)) return;
    let player = Number(playerId || 0);
    if(player && usedPlayers.has(player)) player = 0;
    usedCells.add(cell);
    if(player) usedPlayers.add(player);
    assignments.push({ cellId:cell, playerId:player });
  };
  incoming.forEach(item => add(item?.cellId || item?.cell || item?.slotId, item?.playerId ?? item?.id));
  legacySlots.forEach((cellId,index) => add(cellId, legacyStarters[index] || 0));
  const normalizedCells = typeof normalizeCustomTacticSlots === 'function'
    ? normalizeCustomTacticSlots(assignments.map(item => item.cellId), source)
    : assignments.map(item => item.cellId);
  normalizedCells.forEach(cellId => add(cellId, 0));
  return assignments.slice(0,11);
}
function normalizeSavedTacticsState(src){
  const maxSlots = Number.isFinite(Number(typeof TACTIC_SAVE_SLOT_COUNT !== 'undefined' ? TACTIC_SAVE_SLOT_COUNT : 3)) ? Number(TACTIC_SAVE_SLOT_COUNT) : 3;
  const rawSlots = src && typeof src === 'object' && !Array.isArray(src) ? (src.slots || src) : {};
  const slots = {};
  for(let i=1; i<=maxSlots; i++){
    const raw = rawSlots[i] || rawSlots[String(i)] || null;
    if(!raw || typeof raw !== 'object') continue;
    const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(raw.layoutMode || raw.mode || raw.type) : 'preset';
    const rawStarters = Array.isArray(raw.starters) ? raw.starters.slice(0,11).map(id => Number(id) || 0) : [];
    const customAssignments = layoutMode === 'custom' ? normalizeSavedCustomAssignments(raw, rawStarters) : [];
    const starters = layoutMode === 'custom'
      ? customAssignments.map(item => Number(item.playerId || 0))
      : rawStarters.slice(0,11);
    while(starters.length < 11) starters.push(0);
    const customSlots = layoutMode === 'custom'
      ? customAssignments.map(item => item.cellId)
      : (typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(raw.customSlots, raw) : []);
    const bench = Array.isArray(raw.bench) ? raw.bench.slice(0,10).map(id => Number(id) || 0).filter(Boolean) : [];
    const playerMentalities = (raw.playerMentalities && typeof raw.playerMentalities === 'object' && !Array.isArray(raw.playerMentalities)) ? raw.playerMentalities : {};
    const cleanMentalities = {};
    Object.entries(playerMentalities).forEach(([id, mode]) => {
      const cleanId = Number(id || 0);
      if(cleanId) cleanMentalities[cleanId] = normalizeMentality(mode);
    });
    slots[i] = {
      slot:i,
      name:String(raw.name || `Táctica ${i}`),
      savedAt:String(raw.savedAt || ''),
      clubId:Number(raw.clubId || 0),
      clubName:String(raw.clubName || ''),
      formation:FORMATIONS[raw.formation] ? raw.formation : DEFAULT_TACTIC.formation,
      layoutMode,
      customSlots,
      customAssignments:customSlots.map((cellId,index) => ({ cellId, playerId:Number(starters[index] || 0) })),
      captainId:starters.includes(Number(raw.captainId || 0)) ? Number(raw.captainId || 0) : Number(preferredCaptainForStarterIds(starters, Number(raw.clubId || game?.selectedClubId || 0))?.id || 0),
      captainSelectionMode:typeof normalizeCaptainSelectionMode === 'function' ? normalizeCaptainSelectionMode(raw.captainSelectionMode) : 'automatic',
      starters,
      bench,
      autoSubs:Array.isArray(raw.autoSubs) ? raw.autoSubs.slice(0,5).map(rule => ({ outId:Number(rule?.outId || 0), inId:Number(rule?.inId || 0), trigger:String(rule?.trigger || 'tired') })) : [],
      playerMentalities:cleanMentalities,
      matchInstructions: window.Simulator20?.normalizeMatchInstructions ? window.Simulator20.normalizeMatchInstructions(raw.matchInstructions) : (raw.matchInstructions || DEFAULT_TACTIC.matchInstructions),
      sectorStyles: normalizeSectorStyles(raw.sectorStyles)
    };
  }
  return { slots };
}
function savedTacticSlot(slot){
  game.savedTactics = normalizeSavedTacticsState(game?.savedTactics || {});
  return game.savedTactics.slots?.[Number(slot || 0)] || null;
}
function tacticSlotStatus(slot){
  const saved = savedTacticSlot(slot);
  if(!saved) return { exists:false, label:'Vacía', details:'Sin táctica guardada.' };
  const validStarters = (saved.starters || []).filter(Boolean).length;
  const clubText = saved.clubName ? ` · ${saved.clubName}` : '';
  const captain = playerById(saved.captainId);
  const captainText = captain ? ` · Capitán ${playerLastName(captain.name)}` : '';
  const tacticLabel = typeof isCustomTactic === 'function' && isCustomTactic(saved) ? 'Personalizada' : saved.formation;
  return { exists:true, label:`${tacticLabel}${clubText}`, details:`${validStarters}/11 titulares guardados${captainText}` };
}
function snapshotCurrentTacticForSlot(slot){
  const current = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic || DEFAULT_TACTIC));
  const starters = current.starters.slice(0,11).map(id => Number(id) || 0);
  while(starters.length < 11) starters.push(0);
  const bench = (current.bench || []).slice(0,10).map(id => Number(id) || 0).filter(Boolean);
  const mentalities = {};
  starters.filter(Boolean).forEach(id => { mentalities[id] = playerMentality(id, current); });
  const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(current.layoutMode) : 'preset';
  const customSlots = layoutMode === 'custom' && typeof normalizeCustomTacticSlots === 'function'
    ? normalizeCustomTacticSlots(current.customSlots, current)
    : [];
  return {
    slot:Number(slot || 0),
    name:`Táctica ${Number(slot || 0)}`,
    savedAt:new Date().toISOString(),
    clubId:Number(game.selectedClubId || 0),
    clubName:clubName(game.selectedClubId),
    formation:current.formation || DEFAULT_TACTIC.formation,
    layoutMode,
    customSlots,
    customAssignments:customSlots.map((cellId,index) => ({ cellId, playerId:Number(starters[index] || 0) })),
    captainId:normalizedCaptainIdForTactic(game.selectedClubId, current),
    captainSelectionMode:typeof normalizeCaptainSelectionMode === 'function' ? normalizeCaptainSelectionMode(current.captainSelectionMode) : 'automatic',
    starters,
    bench,
    autoSubs:(current.autoSubs || []).slice(0,5).map(rule => ({ outId:Number(rule.outId || 0), inId:Number(rule.inId || 0), trigger:String(rule.trigger || 'tired') })),
    playerMentalities:mentalities,
    matchInstructions:current.matchInstructions || DEFAULT_TACTIC.matchInstructions,
    sectorStyles:normalizeSectorStyles(current.sectorStyles)
  };
}
function saveCurrentTacticSlot(slot){
  if(!game) return false;
  const cleanSlot = Math.max(1, Math.min(Number(typeof TACTIC_SAVE_SLOT_COUNT !== 'undefined' ? TACTIC_SAVE_SLOT_COUNT : 3), Math.round(Number(slot || 1))));
  game.savedTactics = normalizeSavedTacticsState(game.savedTactics || {});
  game.savedTactics.slots[cleanSlot] = snapshotCurrentTacticForSlot(cleanSlot);
  saveLocal(true);
  showNotice(`Táctica ${cleanSlot} guardada.`);
  if(typeof renderTactics === 'function') renderTactics();
  return true;
}
function sanitizeSavedTacticForCurrentClub(saved){
  const squad = playersByClub(game.selectedClubId);
  const squadIds = new Set(squad.map(p => Number(p.id)));
  const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(saved.layoutMode) : 'preset';
  const paired = layoutMode === 'custom' ? normalizeSavedCustomAssignments(saved, saved.starters || []) : [];
  const sourceStarters = layoutMode === 'custom' ? paired.map(item => Number(item.playerId || 0)) : (saved.starters || []).slice(0,11).map(Number);
  const seenStarters = new Set();
  const starters = sourceStarters.slice(0,11).map(id => {
    const cleanId = Number(id || 0);
    if(!cleanId || !squadIds.has(cleanId) || seenStarters.has(cleanId)) return 0;
    seenStarters.add(cleanId);
    return cleanId;
  });
  while(starters.length < 11) starters.push(0);
  const customSlots = layoutMode === 'custom'
    ? paired.map(item => item.cellId).slice(0,11)
    : (typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(saved.customSlots, saved) : []);
  const taken = new Set(starters.filter(Boolean));
  const bench = [];
  (saved.bench || []).map(Number).forEach(id => {
    if(id && squadIds.has(id) && !taken.has(id) && !bench.includes(id) && bench.length < 10) bench.push(id);
  });
  const mentalities = {};
  starters.filter(Boolean).forEach(id => {
    mentalities[id] = normalizeMentality(saved.playerMentalities?.[id] || saved.playerMentalities?.[String(id)] || 'normal');
  });
  const autoSubs = (saved.autoSubs || []).slice(0,5).map(rule => ({
    outId: starters.includes(Number(rule.outId || 0)) ? Number(rule.outId || 0) : 0,
    inId: bench.includes(Number(rule.inId || 0)) ? Number(rule.inId || 0) : 0,
    trigger: SUB_TRIGGERS.some(t => t.value === rule.trigger) ? rule.trigger : 'tired'
  }));
  while(autoSubs.length < 5) autoSubs.push({ outId:0, inId:0, trigger:'tired' });
  if(game){
    const store = ensurePlayerMentalitiesStore(game);
    Object.entries(mentalities).forEach(([id, mode]) => { store[Number(id)] = normalizeMentality(mode); });
  }
  const clean = applyStarterMentalities({
    ...DEFAULT_TACTIC,
    formation:FORMATIONS[saved.formation] ? saved.formation : DEFAULT_TACTIC.formation,
    layoutMode,
    customSlots,
    customAssignments:customSlots.map((cellId,index) => ({ cellId, playerId:Number(starters[index] || 0) })),
    captainId:starters.includes(Number(saved.captainId || 0)) ? Number(saved.captainId || 0) : Number(preferredCaptainForStarterIds(starters, game.selectedClubId)?.id || 0),
    captainSelectionMode:typeof normalizeCaptainSelectionMode === 'function' ? normalizeCaptainSelectionMode(saved.captainSelectionMode) : 'automatic',
    starters,
    bench,
    autoSubs,
    playerMentalities:{ ...(game.playerMentalities || {}), ...mentalities },
    matchInstructions:window.Simulator20?.normalizeMatchInstructions ? window.Simulator20.normalizeMatchInstructions(saved.matchInstructions) : (saved.matchInstructions || DEFAULT_TACTIC.matchInstructions),
    sectorStyles:normalizeSectorStyles(saved.sectorStyles)
  });
  clean._savedTacticUnavailableCount = starters.filter(id => id && isUnavailable(id)).length;
  clean._savedTacticMissingCount = starters.filter(id => !id).length;
  return clean;
}
function loadSavedTacticSlot(slot){
  if(!game) return false;
  const saved = savedTacticSlot(slot);
  if(!saved){ showNotice(`No hay táctica guardada en el espacio ${slot}.`); return false; }
  const clean = sanitizeSavedTacticForCurrentClub(saved);
  const missing = Number(clean._savedTacticMissingCount || clean.starters.filter(id => !id).length);
  const unavailable = Number(clean._savedTacticUnavailableCount || 0);
  delete clean._savedTacticMissingCount;
  delete clean._savedTacticUnavailableCount;
  game.tactic = ensureTacticCaptain(applyStarterMentalities(clean), game.selectedClubId);
  game.playerMentalities = { ...(game.playerMentalities || {}), ...(game.tactic.playerMentalities || {}) };
  saveLocal(true);
  const details = [];
  if(missing) details.push(`${missing} hueco(s) por jugadores que ya no pertenecen al club`);
  if(unavailable) details.push(`${unavailable} titular(es) actualmente no disponible(s)`);
  showNotice(details.length ? `Táctica ${slot} cargada: ${details.join(' y ')}.` : `Táctica ${slot} cargada correctamente.`);
  if(typeof renderTactics === 'function') renderTactics();
  return true;
}


function maxTrainingSaveSlots(){
  const raw = Number(typeof TRAINING_SAVE_SLOT_COUNT !== 'undefined' ? TRAINING_SAVE_SLOT_COUNT : 3);
  return Number.isFinite(raw) && raw > 0 ? Math.min(6, Math.round(raw)) : 3;
}
function safeTrainingTypeForSavedPlan(value){
  try{
    return typeof safeTrainingType === 'function' ? safeTrainingType(value) : (value || 'regenerative');
  }catch(_err){
    return 'regenerative';
  }
}
function safeIndividualTrainingTypeForSavedPlan(value){
  try{
    return typeof safeIndividualTrainingType === 'function' ? safeIndividualTrainingType(value) : (value || 'balanced');
  }catch(_err){
    return 'balanced';
  }
}
function normalizeTrainingScheduleForSavedPlan(schedule){
  try{
    if(typeof normalizeTrainingSchedule === 'function') return normalizeTrainingSchedule(schedule);
  }catch(_err){}
  const labels = Array.isArray(typeof TRAINING_DAY_LABELS !== 'undefined' ? TRAINING_DAY_LABELS : null) ? TRAINING_DAY_LABELS : ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const slots = Array.isArray(typeof TRAINING_DAY_SLOTS !== 'undefined' ? TRAINING_DAY_SLOTS : null) ? TRAINING_DAY_SLOTS : [{key:'morning'},{key:'midday'},{key:'afternoon'},{key:'evening'}];
  const normalized = {};
  labels.forEach((_, dayIndex) => {
    const sourceDay = schedule?.[dayIndex] || schedule?.[String(dayIndex)] || {};
    normalized[dayIndex] = {};
    slots.forEach(slot => { normalized[dayIndex][slot.key] = safeTrainingTypeForSavedPlan(sourceDay?.[slot.key]); });
  });
  return normalized;
}
function normalizeSavedTrainingPlansState(src){
  const maxSlots = maxTrainingSaveSlots();
  const source = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
  const rawSlots = source.slots && typeof source.slots === 'object' && !Array.isArray(source.slots) ? source.slots : source;
  const slots = {};
  for(let i=1; i<=maxSlots; i++){
    try{
      const raw = rawSlots[i] || rawSlots[String(i)] || null;
      if(!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const rawPlan = (raw.trainingPlan && typeof raw.trainingPlan === 'object' && !Array.isArray(raw.trainingPlan)) ? raw.trainingPlan : {};
      const plan = {};
      Object.entries(rawPlan).forEach(([id, value]) => {
        const cleanId = Number(id || 0);
        if(cleanId) plan[cleanId] = safeIndividualTrainingTypeForSavedPlan(value);
      });
      slots[i] = {
        slot:i,
        name:String(raw.name || `Entrenamiento ${i}`).trim().slice(0,40) || `Entrenamiento ${i}`,
        savedAt:String(raw.savedAt || ''),
        clubId:Number(raw.clubId || 0),
        clubName:String(raw.clubName || ''),
        trainingSchedule:normalizeTrainingScheduleForSavedPlan(raw.trainingSchedule),
        trainingPlan:plan
      };
    }catch(err){
      console.warn('Plan de entrenamiento guardado omitido por datos inválidos', i, err);
    }
  }
  return { slots };
}
function resetSavedTrainingPlans(){
  if(!game) return false;
  game.savedTrainingPlans = normalizeSavedTrainingPlansState({});
  saveLocal(true).catch?.(()=>{});
  showNotice('Entrenamientos guardados reiniciados.');
  if(typeof renderTraining === 'function') renderTraining();
  return true;
}
function savedTrainingPlanSlot(slot){
  if(!game) return null;
  game.savedTrainingPlans = normalizeSavedTrainingPlansState(game.savedTrainingPlans || {});
  return game.savedTrainingPlans.slots?.[Number(slot || 0)] || null;
}
function trainingPlanSlotStatus(slot){
  try{
    const saved = savedTrainingPlanSlot(slot);
    if(!saved) return { exists:false, label:'Vacío', details:'Sin plan semanal guardado.' };
    const schedule = normalizeTrainingScheduleForSavedPlan(saved.trainingSchedule);
    const counts = {};
    Object.values(schedule || {}).forEach(day => Object.values(day || {}).forEach(value => { const key = safeTrainingTypeForSavedPlan(value); counts[key] = Number(counts[key] || 0) + 1; }));
    const summary = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([key,count]) => {
      const label = (typeof trainingOptionByValue === 'function' ? trainingOptionByValue(key)?.label : null) || key;
      return `${label}: ${count}`;
    }).join(' · ');
    const individualCount = Object.keys(saved.trainingPlan || {}).length;
    return { exists:true, label:saved.name || `Entrenamiento ${slot}`, details:`${summary || 'Plan semanal'} · ${individualCount} individuales` };
  }catch(err){
    console.warn('No se pudo leer el espacio de entrenamiento', slot, err);
    return { exists:false, label:'Error de lectura', details:'Espacio inválido. Reiniciá los entrenamientos guardados.' };
  }
}
function snapshotCurrentTrainingPlanForSlot(slot, name){
  const schedule = normalizeTrainingScheduleForSavedPlan(game.trainingSchedule);
  const squadIds = new Set(playersByClub(game.selectedClubId).map(p => Number(p.id)));
  const plan = {};
  Object.entries(game.trainingPlan || {}).forEach(([id, value]) => {
    const cleanId = Number(id || 0);
    if(cleanId && squadIds.has(cleanId)) plan[cleanId] = safeIndividualTrainingTypeForSavedPlan(value);
  });
  return {
    slot:Number(slot || 0),
    name:String(name || `Entrenamiento ${Number(slot || 0)}`).trim().slice(0,40) || `Entrenamiento ${Number(slot || 0)}`,
    savedAt:new Date().toISOString(),
    clubId:Number(game.selectedClubId || 0),
    clubName:clubName(game.selectedClubId),
    trainingSchedule:schedule,
    trainingPlan:plan
  };
}
function saveCurrentTrainingPlanSlot(slot){
  if(!game) return false;
  try{
    const cleanSlot = Math.max(1, Math.min(maxTrainingSaveSlots(), Math.round(Number(slot || 1))));
    const previous = savedTrainingPlanSlot(cleanSlot);
    const suggested = previous?.name || `Entrenamiento ${cleanSlot}`;
    const name = window.prompt ? window.prompt('Nombre del plan de entrenamiento:', suggested) : suggested;
    if(name === null) return false;
    const cleanName = String(name || suggested).trim().slice(0,40) || suggested;
    game.savedTrainingPlans = normalizeSavedTrainingPlansState(game.savedTrainingPlans || {});
    game.savedTrainingPlans.slots[cleanSlot] = snapshotCurrentTrainingPlanForSlot(cleanSlot, cleanName);
    saveLocal(true).catch(err => console.warn('No se pudo guardar el plan de entrenamiento en disco', err));
    showNotice(`${cleanName} guardado.`);
    if(typeof renderTraining === 'function') renderTraining();
    return true;
  }catch(err){
    console.error('Error guardando entrenamiento', err);
    showNotice('No se pudo guardar el entrenamiento. Se conservará la partida.');
    return false;
  }
}
function loadSavedTrainingPlanSlot(slot){
  if(!game) return false;
  try{
    const saved = savedTrainingPlanSlot(slot);
    if(!saved){ showNotice(`No hay plan guardado en el espacio ${slot}.`); return false; }
    game.trainingSchedule = normalizeTrainingScheduleForSavedPlan(saved.trainingSchedule);
    game.trainingPlan = typeof normalizeIndividualTrainingPlan === 'function' ? normalizeIndividualTrainingPlan(game.trainingPlan || {}) : (game.trainingPlan || {});
    const squadIds = new Set(playersByClub(game.selectedClubId).map(p => Number(p.id)));
    let applied = 0;
    Object.entries(saved.trainingPlan || {}).forEach(([id, value]) => {
      const cleanId = Number(id || 0);
      if(cleanId && squadIds.has(cleanId)){
        game.trainingPlan[cleanId] = safeIndividualTrainingTypeForSavedPlan(value);
        applied += 1;
      }
    });
    saveLocal(true).catch(err => console.warn('No se pudo guardar la carga del plan de entrenamiento', err));
    showNotice(`${saved.name || `Entrenamiento ${slot}`} cargado. Individuales aplicados: ${applied}.`);
    if(typeof renderTraining === 'function') renderTraining();
    return true;
  }catch(err){
    console.error('Error cargando entrenamiento', err);
    showNotice('No se pudo cargar ese entrenamiento. Probá reiniciar los entrenamientos guardados.');
    return false;
  }
}
