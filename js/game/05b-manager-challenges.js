/* V8.08 · Prestigio, desafíos y recompensas del manager. Extraído de 05-state-season.js sin alterar el orden lógico original. */

/* Eventos, carrera, ranking automático y limpieza de estado al cambiar de club. */

function clubPrestigeValue(clubOrId){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(c => Number(c.id) === Number(clubOrId));
  const value = Number(club?.managerPrestige ?? club?.reputation ?? club?.prestigio ?? club?.prestige ?? 0);
  return clamp(Math.round(Number.isFinite(value) ? value : 0), 1, 99);
}
function divisionOrderFromName(name=''){
  const clean = String(name || '').toLowerCase();
  if(clean.includes('profesional') || clean.includes('primera divisi')) return 1;
  if(clean.includes('nacional') || clean.includes('segunda')) return 2;
  return 3;
}
function championPrestigeRewardByDivisionOrder(order){
  const value = Math.round(Number(order || 3));
  if(value <= 1) return 20;
  if(value === 2) return 10;
  return 5;
}
function managerPrestigeBreakdown(stats=game?.managerStats){
  const src = stats || {};
  const totals = src.totals || {};
  const seasons = Array.isArray(src.seasons) ? src.seasons : [];
  const career = Array.isArray(src.careerHistory) ? src.careerHistory : [];
  const adjustments = Array.isArray(src.prestigeAdjustments) ? src.prestigeAdjustments.reduce((sum, item) => sum + Number(item.points || 0), 0) : 0;
  const experience = Math.max(0, Math.round(Number(src.experience || 0)));
  const wins = Math.max(0, Math.round(Number(totals.won || 0)));
  const experiencePrestige = experience * Number(MANAGER_XP_TO_PRESTIGE_RATE || 0.001);
  const winPrestige = Math.floor(wins / Math.max(1, Number(MANAGER_PRESTIGE_WINS_STEP || 10)));
  const objectivePrestige = seasons.reduce((sum, item) => {
    if(Number.isFinite(Number(item.managerPrestigeObjectiveReward))) return sum + Number(item.managerPrestigeObjectiveReward);
    return sum + (Boolean(item.objectiveAchieved) ? Number(MANAGER_PRESTIGE_OBJECTIVE_REWARD || 5) : 0);
  }, 0);
  const championPrestige = seasons.reduce((sum, item) => {
    if(!(item.title || item.position === 1)) return sum;
    return sum + championPrestigeRewardByDivisionOrder(item.divisionOrder || divisionOrderFromName(item.divisionName));
  }, 0);
  const badSeasonPenalty = seasons.reduce((sum, item) => sum + Math.max(0, Number(item.managerPrestigeBadSeasonPenalty || item.prestigePenalty || 0)), 0);
  const dismissalPenalty = career.filter(item => item.type === 'dismissal').length * Number(MANAGER_PRESTIGE_DISMISSAL_PENALTY || 2);
  const totalRaw = adjustments + experiencePrestige + winPrestige + objectivePrestige + championPrestige - badSeasonPenalty - dismissalPenalty;
  const legacyTotal = clamp(totalRaw, 0, 99);
  const careerPrestige = Number(src?.careerProfile?.prestige);
  const total = Number.isFinite(careerPrestige)
    ? clamp(typeof managerCareerPrestigeToClubScale === 'function' ? managerCareerPrestigeToClubScale(careerPrestige) : Math.round(careerPrestige / 10), 0, 99)
    : legacyTotal;
  return { total, legacyTotal, careerPrestige:Number.isFinite(careerPrestige) ? careerPrestige : null, adjustments, experience, experiencePrestige, wins, winPrestige, objectivePrestige, championPrestige, badSeasonPenalty, dismissalPenalty };
}
function formatManagerPrestige(value=currentManagerPrestige()){
  const n = Math.max(0, Math.floor(Number(value || 0)));
  return n.toLocaleString('es-AR', { maximumFractionDigits:0 });
}
function managerClubAccessPrestige(value=currentManagerPrestige()){
  const n = Number(value || 0);
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}
function currentManagerPrestige(){
  // V8.73: el acceso a clubes usa el prestigio acumulativo de carrera como única fuente activa.
  // La escala 0-1000 se convierte a la escala 0-99 de los clubes para conservar compatibilidad.
  const careerPrestige = Number(game?.managerStats?.careerProfile?.prestige);
  if(Number.isFinite(careerPrestige)){
    if(typeof managerCareerPrestigeToClubScale === 'function') return clamp(managerCareerPrestigeToClubScale(careerPrestige), 0, 99);
    return clamp(Math.round(careerPrestige / 10), 0, 99);
  }
  if(game?.managerStats) return managerPrestigeBreakdown(game.managerStats).legacyTotal ?? managerPrestigeBreakdown(game.managerStats).total;
  return clamp(Number(MANAGER_PRESTIGE_INITIAL || 0), 0, 99);
}
function currentManagerExperience(){
  const localExperience = game?.managerStats ? Math.max(0, Math.round(Number(game.managerStats.experience || 0))) : 0;
  const sharedExperience = game?.managerSharedProfile ? Math.max(0, Math.round(Number(game.managerSharedProfile.experience || 0))) : 0;
  if(game?.managerStats) return Math.max(localExperience, sharedExperience);
  if(typeof readManagerGlobalProfileState === 'function'){
    const profile = readManagerGlobalProfileState();
    if(profile && !profile.empty && profile.managerStats) return Math.max(0, Math.round(Number(profile.managerStats.experience || 0)));
  }
  return 0;
}
function managerClubRehireBlockInfo(clubOrId){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(c => Number(c.id) === Number(clubOrId));
  const clubId = Number(club?.id || clubOrId || 0);
  if(!clubId || !game?.gameOver?.active || MANAGER_REHIRE_BLOCK_SEASONS <= 0) return { blocked:false };
  const currentSeason = Math.max(1, Number(game?.seasonNumber || 1));
  const history = Array.isArray(game?.managerStats?.careerHistory) ? game.managerStats.careerHistory : [];
  const leaves = history
    .filter(item => Number(item.clubId || 0) === clubId && ['dismissal','resignation'].includes(String(item.type || '')))
    .map(item => ({
      type:String(item.type || ''),
      season:Math.max(1, Number(item.season || 1)),
      clubName:String(item.clubName || club?.name || 'este club')
    }))
    .sort((a,b) => Number(b.season || 0) - Number(a.season || 0));
  const last = leaves[0];
  if(!last) return { blocked:false };
  const untilSeason = Math.max(1, Number(last.season || 1)) + MANAGER_REHIRE_BLOCK_SEASONS;
  if(currentSeason <= untilSeason){
    return {
      blocked:true,
      clubId,
      clubName:last.clubName,
      type:last.type,
      leftSeason:Number(last.season || 1),
      untilSeason,
      availableSeason:untilSeason + 1
    };
  }
  return { blocked:false };
}
function managerClubRehireBlockLabel(clubOrId){
  const info = managerClubRehireBlockInfo(clubOrId);
  if(!info.blocked) return '';
  const cause = info.type === 'resignation' ? 'renuncia' : 'despido';
  return `Bloqueado por ${cause} hasta temporada ${info.untilSeason}`;
}



function activeManagerChallenge(){
  return game?.challenge && game.challenge.active !== false ? game.challenge : null;
}
function managerChallengeIs(id){
  const challenge = activeManagerChallenge();
  return Boolean(challenge && (!id || String(challenge.id || '') === String(id)));
}
function managerChallengeBlocks(kind=''){
  const challenge = activeManagerChallenge();
  if(!challenge || challenge.completed) return false;
  const blocked = challenge.blocked || {};
  return Boolean(blocked[kind]);
}
function managerChallengeBlockedMessage(kind=''){
  const challenge = activeManagerChallenge();
  const title = challenge?.nombre || challenge?.title || 'Reto activo';
  if(kind === 'fieldMaintenance') return `${title}: no se puede replantar ni reparar el campo.`;
  if(kind === 'staff') return `${title}: no se pueden contratar empleados durante el reto.`;
  if(kind === 'players') return `${title}: no se pueden contratar ni incorporar jugadores durante el reto.`;
  if(kind === 'resultOnly') return `${title}: Ver resultado está bloqueado. Debés dirigir el partido.`;
  return `${title}: acción bloqueada por las reglas del reto.`;
}
function managerChallengePresetById(id=''){
  const key = String(id || '').trim();
  const presets = Array.isArray(managerChallengesDatabase?.retos) ? managerChallengesDatabase.retos : [];
  return presets.find(item => String(item?.id || '') === key && item?.activo !== false) || null;
}
function campoDestruidoChallengeDefinition(){
  return managerChallengePresetById('campo_destruido');
}
function challengeClubNameCandidates(){
  const definition = campoDestruidoChallengeDefinition();
  return Array.isArray(definition?.clubesSeleccionables) ? definition.clubesSeleccionables.filter(Boolean).map(String) : [];
}
function challengeClubKey(name){
  if(typeof lookupNameKey === 'function') return lookupNameKey(name);
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function findClubByChallengeName(name){
  const key = challengeClubKey(name);
  return (seed?.clubs || []).find(club => challengeClubKey(club.name) === key)
    || (seed?.clubs || []).find(club => challengeClubKey(club.name).includes(key) || key.includes(challengeClubKey(club.name)));
}
function campoDestruidoChallengeClubs(){
  return challengeClubNameCandidates().map(name => findClubByChallengeName(name)).filter(Boolean);
}
function campoDestruidoChallengeAvailable(){
  if(typeof CAMPO_DESTRUIDO_OPTION_VISIBLE !== 'undefined' && !CAMPO_DESTRUIDO_OPTION_VISIBLE) return false;
  const definition = campoDestruidoChallengeDefinition();
  if(!definition) return false;
  const clubs = campoDestruidoChallengeClubs();
  const matches = Math.max(1, Math.round(Number(definition?.calendario?.partidos || 0)));
  return clubs.length >= matches + 1;
}
function createChallengeRoundRobin(teamIds=[]){
  const unique = Array.from(new Set((teamIds || []).map(Number).filter(Boolean)));
  if(unique.length < 2) return [];
  const rotation = unique.length % 2 === 0 ? [...unique] : [...unique, 0];
  const rounds = [];
  for(let roundIndex=0; roundIndex<rotation.length - 1; roundIndex++){
    const pairs = [];
    for(let index=0; index<rotation.length / 2; index++){
      const a = Number(rotation[index] || 0);
      const b = Number(rotation[rotation.length - 1 - index] || 0);
      if(a && b) pairs.push([a,b]);
    }
    rounds.push(pairs);
    const last = rotation.pop();
    rotation.splice(1, 0, last);
  }
  return rounds;
}
function createCampoDestruidoChallengeFixtures(selectedClubId, opponentIds=[]){
  const definition = campoDestruidoChallengeDefinition();
  if(!definition) return [];
  const calendar = definition.calendario || {};
  const selected = Number(selectedClubId || 0);
  const division = clubDivision(selected);
  const divisionClubIds = (seed?.clubs || [])
    .filter(club => String(club.divisionId || '') === String(division.id || '') && challengeClubKey(clubCountry(club)) === 'argentina' && !club.specialCompetitionOnly)
    .map(club => Number(club.id))
    .filter(Boolean);
  const year = currentSeasonYear ? currentSeasonYear() : (game?.seasonYear || SEASON_START_YEAR || 2026);
  const month = String(Math.max(1, Math.min(12, Math.round(Number(calendar.mesInicio || 1))))).padStart(2, '0');
  const day = String(Math.max(1, Math.min(31, Math.round(Number(calendar.diaInicio || 1))))).padStart(2, '0');
  const startDate = `${year}-${month}-${day}`;
  const matchesTotal = Math.max(1, Math.round(Number(calendar.partidos || 1)));
  const intervalDays = Math.max(1, Math.round(Number(calendar.diasEntrePartidos || 7)));
  const firstLeagueRound = Math.max(1, Math.round(Number(calendar.fechaLigaInicial || 30)));
  const lastLeagueRound = Math.max(firstLeagueRound, Math.round(Number(calendar.fechaLigaFinal || (firstLeagueRound + matchesTotal - 1))));
  const title = String(calendar.tituloFecha || 'Reto · Fecha');
  const allRounds = createChallengeRoundRobin(divisionClubIds);
  const selectedRounds = (opponentIds || []).slice(0, matchesTotal).map(opponentId => {
    const opponent = Number(opponentId || 0);
    return allRounds.find(pairs => (pairs || []).some(pair => pair.includes(selected) && pair.includes(opponent))) || [];
  });
  const completeSchedule = selectedRounds.length === matchesTotal && selectedRounds.every(pairs => Array.isArray(pairs) && pairs.length >= Math.floor(divisionClubIds.length / 2));
  if(!completeSchedule){
    return (opponentIds || []).slice(0, matchesTotal).map((opponentId, index) => {
      const date = addDaysToIsoDate(startDate, index * intervalDays);
      const leagueRound = firstLeagueRound + index;
      const match = { id:`reto-${definition.id}-${game?.seasonNumber || 1}-${leagueRound}-${selected}-${opponentId}`, matchday:leagueRound, divisionId:division.id, divisionName:division.name, homeId:selected, awayId:Number(opponentId), played:false, homeGoals:0, awayGoals:0, date, roundDate:date, challengeId:definition.id, challengeManagerMatch:true };
      return { matchday:leagueRound, date, endDate:date, title:`${title} ${leagueRound}/${lastLeagueRound}`, challengeRound:true, matches:[match] };
    });
  }
  return selectedRounds.map((pairs, index) => {
    const date = addDaysToIsoDate(startDate, index * intervalDays);
    const leagueRound = firstLeagueRound + index;
    const forcedOpponent = Number(opponentIds[index] || 0);
    const matches = pairs.map((pair, pairIndex) => {
      let [homeId, awayId] = pair.map(Number);
      const managerPair = pair.includes(selected);
      if(managerPair){ homeId = selected; awayId = forcedOpponent; }
      else if((leagueRound + pairIndex) % 2 === 0){ [homeId, awayId] = [awayId, homeId]; }
      return {
        id:`reto-${definition.id}-${game?.seasonNumber || 1}-${leagueRound}-${homeId}-${awayId}`,
        matchday:leagueRound,
        divisionId:division.id,
        divisionName:division.name,
        homeId,
        awayId,
        played:false,
        homeGoals:0,
        awayGoals:0,
        date,
        roundDate:date,
        challengeId:definition.id,
        challengeManagerMatch:managerPair,
        challengeLeagueFinale:true
      };
    });
    return { matchday:leagueRound, date, endDate:date, title:`${title} ${leagueRound}/${lastLeagueRound}`, challengeRound:true, challengeLeagueFinale:true, matches };
  });
}
function ensureCampoDestruidoChallengeFullCalendar(){
  const challenge = game?.challenge;
  if(!challenge || challenge.completed || String(challenge.id || '') !== 'campo_destruido') return false;
  const rounds = Array.isArray(game?.fixtures) ? game.fixtures : [];
  const challengeRounds = rounds.filter(round => (round?.matches || []).some(match => String(match?.challengeId || '') === 'campo_destruido'));
  const challengeMatches = challengeRounds.flatMap(round => (round.matches || []).filter(match => String(match?.challengeId || '') === 'campo_destruido'));
  const expectedRounds = Math.max(1, Math.round(Number(challenge.matchesTotal || campoDestruidoChallengeDefinition()?.calendario?.partidos || 5)));
  const selectedClubId = Number(challenge.selectedClubId || game?.selectedClubId || 0);
  const selectedDivision = clubDivision(selectedClubId);
  const divisionTeamCount = (seed?.clubs || []).filter(club => String(club.divisionId || '') === String(selectedDivision?.id || '') && challengeClubKey(clubCountry(club)) === 'argentina' && !club.specialCompetitionOnly).length;
  const expectedTeams = Math.max(2, Number(divisionTeamCount || challenge.leagueTeams || 18));
  const expectedMatchesPerRound = Math.max(1, Math.floor(expectedTeams / 2));
  const fullCalendarReady = challengeRounds.length === expectedRounds
    && challengeRounds.every(round => (round.matches || []).filter(match => String(match?.challengeId || '') === 'campo_destruido').length >= expectedMatchesPerRound);
  if(fullCalendarReady){
    challenge.leagueTeams = Math.max(expectedTeams, challengeRounds[0]?.matches?.length ? challengeRounds[0].matches.length * 2 : 0);
    challenge.leagueMatchesTotal = challengeMatches.length;
    challenge.fullLeagueCalendar = true;
    return false;
  }
  // Una partida del reto ya iniciada conserva su calendario anterior para no reescribir
  // resultados, estadísticas ni la tabla a mitad de las cinco fechas.
  if(challengeMatches.some(match => match.played)) return false;
  const selected = Number(challenge.selectedClubId || game?.selectedClubId || 0);
  const opponentIds = Array.isArray(challenge.opponentIds) && challenge.opponentIds.length
    ? challenge.opponentIds.map(Number).filter(Boolean)
    : challengeMatches.filter(match => Number(match.homeId) === selected || Number(match.awayId) === selected)
      .map(match => Number(match.homeId) === selected ? Number(match.awayId) : Number(match.homeId)).filter(Boolean);
  const rebuilt = createCampoDestruidoChallengeFixtures(selected, opponentIds);
  const rebuiltMatches = rebuilt.flatMap(round => round.matches || []);
  if(rebuilt.length !== expectedRounds || rebuilt.some(round => (round.matches || []).length < expectedMatchesPerRound)) return false;
  game.fixtures = rebuilt;
  game.matchdayIndex = 0;
  resetChallengeDivisionStandings(selected, opponentIds);
  challenge.matchesPlayed = 0;
  challenge.leagueTeams = rebuilt[0]?.matches?.length ? rebuilt[0].matches.length * 2 : expectedTeams;
  challenge.leagueMatchesTotal = rebuiltMatches.length;
  challenge.fullLeagueCalendar = true;
  challenge.calendarMigratedTo = 'V7.41';
  if(typeof saveLocal === 'function') saveLocal(true);
  return true;
}
function resetChallengeDivisionStandings(selectedClubId, contenderIds=[]){
  if(!game || !seed?.clubs?.length) return;
  const definition = campoDestruidoChallengeDefinition();
  const tableConfig = definition?.condicionesIniciales?.tablaInicial;
  if(!tableConfig) return;
  const division = clubDivision(selectedClubId);
  game.standings = createInitialStandings();
  const selected = Number(selectedClubId);
  const contenders = (contenderIds || []).map(Number).filter(Boolean);
  const chosenTop = contenders.slice(0,2);
  const leaders = Array.isArray(tableConfig.lideres) ? tableConfig.lideres : [];
  const selectedRow = tableConfig.clubSeleccionado || {};
  const contender = tableConfig.contendiente || {};
  const sameDivision = seed.clubs
    .filter(club => String(club.divisionId || '') === String(division.id || ''))
    .sort((a,b) => Number(b.reputation || 0) - Number(a.reputation || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  let restRank = 0;
  sameDivision.forEach(club => {
    const id = Number(club.id);
    let row = null;
    const leaderIndex = chosenTop.indexOf(id);
    if(leaderIndex >= 0 && leaders[leaderIndex]) row = { clubId:id, ...leaders[leaderIndex] };
    else if(id === selected) row = { clubId:id, ...selectedRow };
    else if(contenders.includes(id)){
      const rank = contenders.indexOf(id);
      const variation = Math.min(rank, Math.max(0, Number(contender.variacionMaxima || 0)));
      row = {
        clubId:id,
        pj:Number(contender.pj || 29),
        pg:Number(contender.pgBase || 18) - variation,
        pe:Number(contender.pe || 6),
        pp:Number(contender.ppBase || 5) + variation,
        gf:Number(contender.gfBase || 48) - rank,
        gc:Number(contender.gcBase || 27) + rank
      };
      row.pts = row.pg * 3 + row.pe;
    }else{
      const pj = 29;
      const pg = Math.max(4, 13 - Math.floor(restRank * 0.7));
      const pe = Math.min(10, 5 + (restRank % 5));
      const pp = Math.max(0, pj - pg - pe);
      row = {
        clubId:id,
        pj,
        pg,
        pe,
        pp,
        gf:Math.max(20, 45 - restRank * 2),
        gc:Math.min(58, 30 + restRank * 2),
        pts:pg * 3 + pe
      };
      restRank += 1;
    }
    row.pj = Number(row.pj || 0);
    row.pg = Number(row.pg || 0);
    row.pe = Number(row.pe || 0);
    row.pp = Number(row.pp || 0);
    row.gf = Number(row.gf || 0);
    row.gc = Number(row.gc || 0);
    row.pts = Number.isFinite(Number(row.pts)) ? Number(row.pts) : row.pg * 3 + row.pe;
    row.dg = row.gf - row.gc;
    game.standings[id] = row;
  });
}
function lowerChallengeSquadLevel(selectedClubId, delta=10, exceptIds=[]){
  const except = new Set((exceptIds || []).map(Number));
  playersByClub(selectedClubId).forEach(player => {
    if(except.has(Number(player.id))) return;
    if(!player.challengeOriginalOverall) player.challengeOriginalOverall = Number(player.overall || 50);
    player.overall = clamp(Math.round(Number(player.overall || 50) - Math.max(0, Number(delta || 0))), 1, 99);
    if(player.skills && typeof player.skills === 'object'){
      Object.keys(player.skills).forEach(key => {
        if(['factorSorpresa'].includes(key)) return;
        const value = Number(player.skills[key]);
        if(Number.isFinite(value)) player.skills[key] = clamp(Math.round(value - Math.max(0, Number(delta || 0))), key === 'factorSorpresa' ? 0 : 1, 99);
      });
    }
  });
}
function moveMaradonaToChallengeClub(selectedClubId){
  const special = campoDestruidoChallengeDefinition()?.condicionesIniciales?.jugadorEspecial || {};
  const names = Array.isArray(special.nombresBusqueda) ? special.nombresBusqueda.map(challengeClubKey).filter(Boolean) : [];
  const byName = (seed?.players || []).find(player => names.some(name => challengeClubKey(player.name).includes(name)));
  if(!byName) return null;
  setPlayerClubId(byName, Number(selectedClubId));
  byName.freeAgent = false;
  byName.transferListed = false;
  byName.intransferible = true;
  byName.sold = false;
  byName.retired = false;
  if(Array.isArray(game?.marketPlayers)) game.marketPlayers = game.marketPlayers.filter(player => Number(player.id) !== Number(byName.id));
  return byName;
}
function applyCampoDestruidoChallengePreset(selectedClubId){
  if(!game) return false;
  const definition = campoDestruidoChallengeDefinition();
  if(!definition) return false;
  const calendar = definition.calendario || {};
  const initial = definition.condicionesIniciales || {};
  const ownSquad = initial.plantelPropio || {};
  const rivals = initial.rivales || {};
  const special = initial.jugadorEspecial || {};
  const selected = Number(selectedClubId || game.selectedClubId || 0);
  const challengeClubs = campoDestruidoChallengeClubs();
  const allowedIds = challengeClubs.map(club => Number(club.id));
  if(!allowedIds.includes(selected)) return false;
  const matchesTotal = Math.max(1, Math.round(Number(calendar.partidos || 1)));
  const opponents = challengeClubs.filter(club => Number(club.id) !== selected).slice(0, matchesTotal);
  const opponentIds = opponents.map(club => Number(club.id));
  const maradona = moveMaradonaToChallengeClub(selected);
  const year = game.seasonYear || seasonYearForNumber(game.seasonNumber || 1);
  const month = String(Math.max(1, Math.min(12, Math.round(Number(calendar.mesInicio || 1))))).padStart(2, '0');
  const day = String(Math.max(1, Math.min(31, Math.round(Number(calendar.diaInicio || 1))))).padStart(2, '0');
  game.seasonPhase = 'regular';
  game.phaseTurn = 0;
  game.matchdayIndex = 0;
  game.globalTurn = Math.max(0, Math.round(Number(calendar.turnoGlobalInicial || 0)));
  game.currentDate = `${year}-${month}-${day}`;
  game.lastCalendarDate = game.currentDate;
  game.fixtures = createCampoDestruidoChallengeFixtures(selected, opponentIds);
  game.stadium = createInitialStadiumState();
  game.stadium.fields[selected] = clamp(Math.round(Number(initial.campoPropio || 1)), 0, 100);
  game.stadium.projects[selected] = { replantingTurnsLeft:0, patchingTurnsLeft:0 };
  resetChallengeDivisionStandings(selected, opponentIds);
  if(maradona){
    if(game.playerStats && game.playerStats[maradona.id]) game.playerStats[maradona.id].clubId = selected;
    if(game.playerCareerStats && game.playerCareerStats[maradona.id]) game.playerCareerStats[maradona.id].clubId = selected;
    game.playerStatus[maradona.id] = {
      ...(game.playerStatus[maradona.id] || {}),
      injuredUntilTurn:currentTurnIndex() + Math.max(1, Math.round(Number(special.diasLesion || 1))),
      injuredThrough:Math.max(0, Math.round(Number(special.lesionadoHastaFecha || 0))),
      injuryLabel:String(special.etiquetaLesion || 'Recuperación programada del reto'),
      injuredAtMatchday:0,
      injuredAtTurn:currentTurnIndex(),
      challengeInitialInjury:true
    };
    game.playerCondition[maradona.id] = clamp(Math.round(Number(special.condicionInicial || 80)), 1, 100);
    game.playerMorale[maradona.id] = clamp(Math.round(Number(special.moralInicial || 80)), 1, 100);
  }
  lowerChallengeSquadLevel(selected, Number(initial.reduccionMediaPlantel || 0), maradona ? [maradona.id] : []);
  playersByClub(selected).forEach(player => {
    if(maradona && Number(player.id) === Number(maradona.id)) return;
    game.playerCondition[player.id] = clamp(Math.round(Number(game.playerCondition[player.id] || 60)), Number(ownSquad.condicionMin || 1), Number(ownSquad.condicionMax || 100));
    game.playerMorale[player.id] = clamp(Math.round(Number(game.playerMorale[player.id] || 60)), Number(ownSquad.moralMin || 1), Number(ownSquad.moralMax || 100));
  });
  opponentIds.forEach(id => {
    game.teamCohesion[id] = Math.max(Number(game.teamCohesion[id] || 0), Number(rivals.cohesionMinima || 0));
    playersByClub(id).forEach(player => {
      game.playerCondition[player.id] = Math.max(Number(game.playerCondition[player.id] || 0), Number(rivals.condicionMinima || 0));
      game.playerMorale[player.id] = Math.max(Number(game.playerMorale[player.id] || 0), Number(rivals.moralMinima || 0));
    });
  });
  game.teamCohesion[selected] = clamp(Math.round(Number(initial.cohesionPropia || 50)), 0, 100);
  const fallbackName = String(special.nombreFallback || 'Jugador especial');
  game.challenge = {
    active:true,
    id:definition.id,
    nombre:definition.nombre,
    title:definition.nombre,
    difficulty:definition.dificultad,
    definitionVersion:managerChallengesDatabase?.metadata?.version || APP_VERSION,
    selectedClubId:selected,
    opponentIds,
    maradonaId:maradona ? Number(maradona.id) : 0,
    maradonaName:maradona?.name || fallbackName,
    maradonaRecoveryTurn:maradona ? Number(game.playerStatus[maradona.id]?.injuredUntilTurn || 0) : 0,
    startTurn:currentTurnIndex(),
    startDate:game.currentDate,
    fieldLocked:Boolean(definition?.bloqueos?.fieldMaintenance),
    requiredFieldScore:Number(initial.campoPropio || 0),
    matchesTotal,
    matchesPlayed:0,
    leagueTeams:game.fixtures?.[0]?.matches?.length ? game.fixtures[0].matches.length * 2 : 0,
    leagueMatchesTotal:(game.fixtures || []).reduce((sum, round) => sum + (round.matches || []).length, 0),
    maradonaReinjured:false,
    completed:false,
    success:false,
    objective:String(definition?.objetivo?.descripcion || ''),
    blocked:{ ...(definition.bloqueos || {}) },
    notes:Array.isArray(definition.notas) ? [...definition.notas] : []
  };
  game.tactic = normalizeTactic(selected, DEFAULT_TACTIC);
  game.mustReviewTactics = false;
  if(typeof removeOwnUnavailableFromTactic === 'function') removeOwnUnavailableFromTactic([{ type:'injury', playerId:maradona?.id || 0 }]);
  const lastMatches = Math.max(1, Math.round(Number(special.vuelveParaUltimosPartidos || 1)));
  pushGameMessage({ type:'reto', priority:'high', title:`Reto iniciado: ${definition.nombre}`, body:`Elegiste ${clubName(selected)}. Quedan ${matchesTotal} fechas en tu campo contra ${opponents.map(club => club.name).join(', ')}. En cada jornada también se simulan los otros partidos de la Primera División. Campo ${Number(initial.campoPropio || 0)}/100, mantenimiento bloqueado, mercado/staff bloqueados y ${maradona?.name || fallbackName} vuelve para los últimos ${lastMatches} partidos. Objetivo: ${String(definition?.objetivo?.descripcion || '').toLowerCase()}`, id:`challenge-${definition.id}-${selected}-${Date.now()}` });
  return true;
}
function applyChallengePreset(challengeId, selectedClubId){
  const id = String(challengeId || '');
  if(id === campoDestruidoChallengeDefinition()?.id) return applyCampoDestruidoChallengePreset(selectedClubId);
  return false;
}
function startCampoDestruidoChallenge(selectedClubId, options={}){
  if(typeof setCurrentSaveSlot === 'function') setCurrentSaveSlot(SAVE_SLOT_CAMPO_DESTRUIDO);
  const club = seed?.clubs?.find(item => Number(item.id) === Number(selectedClubId));
  if(!club){ showNotice('Club no encontrado para el reto.'); return; }
  if(!campoDestruidoChallengeClubs().some(item => Number(item.id) === Number(selectedClubId))){
    showNotice('Ese club no forma parte del reto Campo destruido.');
    return;
  }
  newGame(Number(selectedClubId), {
    managerName:options.managerName || storedManagerName(),
    country:clubCountry(club),
    leagueId:club.divisionId || 'default',
    challengeId:campoDestruidoChallengeDefinition()?.id || 'campo_destruido',
    saveSlotId:SAVE_SLOT_CAMPO_DESTRUIDO,
    ignorePrestige:true
  });
}
function managerChallengeAfterOwnMatch(match){
  const challenge = activeManagerChallenge();
  if(!challenge || challenge.completed) return;
  if(String(challenge.id || '') !== 'campo_destruido') return;
  challenge.matchesPlayed = Math.max(0, Number(challenge.matchesPlayed || 0)) + 1;
  const maradonaId = Number(challenge.maradonaId || 0);
  if(maradonaId && (match?.injuries || []).some(injury => Number(injury.playerId) === maradonaId)){
    challenge.maradonaReinjured = true;
    pushGameMessage({ type:'reto', priority:'normal', title:'Maradona volvió a lesionarse', body:`${challenge.maradonaName || 'Maradona'} sufrió una nueva lesión, pero el resultado del reto se define únicamente por la tabla final.`, id:`challenge-maradona-injury-${game.seasonNumber || 1}-${game.globalTurn || 0}` });
  }
  const pendingChallengeMatches = (game?.fixtures || []).flatMap(round => round.matches || []).filter(item => String(item?.challengeId || '') === 'campo_destruido' && !item.played);
  if(Number(challenge.matchesPlayed || 0) >= Number(challenge.matchesTotal || 5) && pendingChallengeMatches.length === 0){
    finalizeActiveManagerChallenge();
  }
}
function grantManagerChallengeSkillPoints(points=0, context={}){
  const amount = Math.max(0, Math.round(Number(points || 0)));
  if(!amount) return 0;
  const state = typeof ensureSpecialState === 'function' ? ensureSpecialState() : game?.special;
  if(!state) return 0;
  state.puntos_habilidad = Math.max(0, Math.round(Number(state.puntos_habilidad || 0) + amount));
  const logEntry = { actionId:'completar_reto_campo_destruido_primero', points:amount, date:game?.currentDate || '', season:game?.seasonNumber || 1, ...context };
  if(typeof appendSpecialPointsLog === 'function') appendSpecialPointsLog(state, logEntry);
  else {
    state.puntos_log = Array.isArray(state.puntos_log) ? state.puntos_log : [];
    state.puntos_log.push(logEntry);
    if(state.puntos_log.length > 80) state.puntos_log = state.puntos_log.slice(-80);
  }
  if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'challenge_campo_destruido_reward' });
  return amount;
}
function completedChallengeResultModalActive(){
  const root = typeof $ === 'function' ? $('modalRoot') : document.getElementById('modalRoot');
  return Boolean(root?.dataset?.completedChallengeResult === '1');
}
async function closeCompletedChallengeResultScreen(){
  const challenge = game?.challenge;
  if(!challenge?.completed) return false;
  if(typeof forceCloseModal === 'function') forceCloseModal();
  else if(typeof closeModal === 'function') closeModal();
  if(typeof closeCompletedChallengeSlot === 'function') await closeCompletedChallengeSlot(challenge);
  return true;
}
function showCampoDestruidoCompletionScreen(challenge){
  if(!challenge?.completed || !challenge?.success || typeof openModal !== 'function') return false;
  const result = challenge.result || {};
  const firstReward = Number(result.skillPointsAwarded || 0) > 0;
  const dg = Number(result.dg || 0);
  const dgLabel = dg > 0 ? `+${dg}` : String(dg);
  const rewardAmount = Math.max(0, Math.round(Number(result.skillPointsAwarded || 0)));
  openModal(`<div class="challenge-completion-screen ${firstReward ? 'challenge-first-reward' : 'challenge-repeat-win'}">
    <div class="challenge-completion-emblem" aria-hidden="true">${firstReward ? '🏆' : '✓'}</div>
    <p class="label">Campo destruido</p>
    <h2>${firstReward ? '¡Reto superado!' : 'Reto superado nuevamente'}</h2>
    <p class="challenge-completion-lead">Terminaste primero con <strong>${Number(result.pts || 0)} puntos</strong> y diferencia de gol <strong>${dgLabel}</strong>.</p>
    ${firstReward
      ? `<div class="challenge-reward-box"><span>Premio único</span><strong>+${formatPlainNumber(rewardAmount)} puntos de habilidad</strong><p>Felicitaciones. Superaste por primera vez uno de los retos más exigentes del Manager.</p></div>`
      : `<div class="challenge-reward-box is-claimed"><span>Premio ya reclamado</span><strong>Sin recompensa adicional</strong><p>El reto puede repetirse, pero los 10.000 puntos de habilidad se entregan una sola vez por perfil.</p></div>`}
    <button class="primary challenge-result-continue" data-close-completed-challenge>Volver a crear partida</button>
  </div>`);
  const root = typeof $ === 'function' ? $('modalRoot') : document.getElementById('modalRoot');
  if(root) root.dataset.completedChallengeResult = '1';
  document.querySelector('[data-close-completed-challenge]')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeCompletedChallengeResultScreen();
  });
  return true;
}
function finalizeActiveManagerChallenge(record=null){
  const challenge = activeManagerChallenge();
  if(!challenge || challenge.completed) return null;
  if(String(challenge.id || '') !== 'campo_destruido') return null;
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const positionIndex = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId));
  const ownRow = positionIndex >= 0 ? table[positionIndex] : (game.standings?.[game.selectedClubId] || {});
  const position = positionIndex >= 0 ? positionIndex + 1 : Number(record?.position || 0) || null;
  const champion = position === 1;
  const definition = campoDestruidoChallengeDefinition();
  const configuredReward = Math.max(0, Math.round(Number(definition?.recompensas?.puntosHabilidadPrimerPuesto || 10000)));
  const rewardAlreadyClaimed = managerChallengeRewardAlreadyClaimed(challenge.id);
  let awarded = 0;
  if(champion && !rewardAlreadyClaimed && !challenge.skillPointsAwarded){
    awarded = grantManagerChallengeSkillPoints(configuredReward, { challengeId:challenge.id, clubId:game.selectedClubId, position, pts:Number(ownRow.pts || 0), dg:Number(ownRow.dg || 0) });
    challenge.skillPointsAwarded = awarded;
  }
  challenge.completed = true;
  challenge.active = false;
  challenge.completedAt = { season:game?.seasonNumber || 1, date:game?.currentDate || '', turn:currentTurnIndex() };
  challenge.success = champion;
  challenge.result = {
    champion,
    position,
    pts:Number(ownRow.pts || 0),
    dg:Number(ownRow.dg || 0),
    gf:Number(ownRow.gf || 0),
    gc:Number(ownRow.gc || 0),
    skillPointsAwarded:awarded,
    rewardAlreadyClaimed:Boolean(rewardAlreadyClaimed)
  };
  recordManagerChallengeCompletion(challenge.id, { success:champion, rewardClaimed:awarded > 0, rewardAmount:awarded });
  const dgLabel = Number(ownRow.dg || 0) > 0 ? `+${Number(ownRow.dg || 0)}` : String(Number(ownRow.dg || 0));
  challenge.closeNotice = champion
    ? (awarded > 0
      ? `La directiva te da las gracias: terminaste 1° con ${Number(ownRow.pts || 0)} puntos y diferencia ${dgLabel}. Recibiste el premio único de ${formatPlainNumber(awarded)} puntos de habilidad.`
      : `La directiva te da las gracias: volviste a terminar 1° con ${Number(ownRow.pts || 0)} puntos y diferencia ${dgLabel}. El premio único ya había sido reclamado.`)
    : `La directiva decidió despedirte: terminaste ${position || 'fuera del primer puesto'} con ${Number(ownRow.pts || 0)} puntos y diferencia ${dgLabel}.`;
  pushGameMessage({
    type:'reto',
    priority:champion ? 'high' : 'normal',
    title:champion ? `Reto completado: ${challenge.nombre || 'Campo destruido'}` : `Reto finalizado: ${challenge.nombre || 'Campo destruido'}`,
    body:challenge.closeNotice,
    id:`challenge-result-campo-destruido-${game.seasonNumber || 1}-${game.selectedClubId}`
  });
  if(typeof saveLocal === 'function') saveLocal(true);
  if(champion){
    showCampoDestruidoCompletionScreen(challenge);
  } else {
    showNotice(challenge.closeNotice, true);
    if(typeof closeCompletedChallengeSlot === 'function') setTimeout(() => closeCompletedChallengeSlot(challenge), 1400);
  }
  return challenge;
}
function managerChallengeHomeMarkup(){
  if(typeof ensureCampoDestruidoChallengeFullCalendar === 'function') ensureCampoDestruidoChallengeFullCalendar();
  const challenge = game?.challenge;
  if(!challenge || String(challenge.id || '') !== 'campo_destruido') return '';
  const fieldScore = typeof fieldScoreForClub === 'function' ? fieldScoreForClub(game.selectedClubId) : Number(game?.stadium?.fields?.[game.selectedClubId] || 0);
  const maradonaId = Number(challenge.maradonaId || 0);
  const maradonaStatus = maradonaId && typeof isInjured === 'function' && isInjured(maradonaId)
    ? `Lesionado · vuelve en ${typeof turnsRemaining === 'function' ? turnsRemaining(maradonaId) : '?'} día(s)`
    : (challenge.maradonaReinjured ? 'Re-lesionado' : 'Disponible');
  const table = sortedStandings(clubDivision(game.selectedClubId).id);
  const pos = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId)) + 1;
  const pct = clamp((Number(challenge.matchesPlayed || 0) / Math.max(1, Number(challenge.matchesTotal || 5))) * 100, 0, 100);
  const currentRow = table.find(row => Number(row.clubId) === Number(game.selectedClubId)) || {};
  const remainingLeagueMatches = (game?.fixtures || []).flatMap(round => round.matches || []).filter(item => String(item?.challengeId || '') === 'campo_destruido' && !item.played).length;
  const rewardAlreadyClaimed = managerChallengeRewardAlreadyClaimed('campo_destruido');
  const rewardStatus = rewardAlreadyClaimed ? 'Premio único ya reclamado: podés repetir el reto, pero no volverá a pagar puntos.' : 'Premio disponible: 10.000 puntos de habilidad la primera vez que terminás primero.';
  return `<div class="card manager-challenge-card" style="margin-top:14px">
    <div class="row"><div><p class="label">Reto predeterminado</p><h3>${escapeHtml(challenge.nombre || 'Campo destruido')}</h3></div><span class="pill danger">Dificultad ${escapeHtml(challenge.difficulty || 'Alta')}</span></div>
    <p class="tagline">Objetivo: <strong>${escapeHtml(challenge.objective || 'Completar las condiciones del reto.')}</strong></p>
    <div class="grid cols-4 compact-team-stats">
      <div><p class="label">Campo</p><strong>${fieldScore}/100</strong></div>
      <div><p class="label">Posición</p><strong>${pos || '—'}°</strong></div>
      <div><p class="label">Maradona</p><strong>${escapeHtml(maradonaStatus)}</strong></div>
      <div><p class="label">Partidos propios</p><strong>${Number(challenge.matchesPlayed || 0)}/${Number(challenge.matchesTotal || 5)}</strong></div>
    </div>
    <div class="project-progress" style="margin-top:10px"><span style="width:${pct}%"></span></div>
    <p class="muted small">Tabla actual: ${Number(currentRow.pts || 0)} puntos · DG ${Number(currentRow.dg || 0) > 0 ? '+' : ''}${Number(currentRow.dg || 0)}. Quedan ${remainingLeagueMatches} partidos de liga por resolver. ${escapeHtml(rewardStatus)}</p>
    <p class="muted small">Bloqueos activos: mantenimiento de campo, fichajes, empleados y resultado directo.</p>
  </div>`;
}

