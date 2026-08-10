/* V9.57 · Mundial de Clubes cuatrienal: 8 Champions, 8 Libertadores y 16 invitados. */

const CLUB_WORLD_CUP_CONFIG = {
  enabled:true,
  name:'Copa Mundial de Clubes de la FIFA',
  divisionId:'club-world-cup',
  invitedDivisionId:'club-world-cup-invitados',
  invitedDivisionName:'Invitados Copa Mundial de Clubes',
  groupCount:8,
  groupSize:4,
  cycleBaseYear:configNumber('calendario.mundialClubes.anioBase', 2025, 1900, 9999),
  cycleYears:configNumber('calendario.mundialClubes.cadaAnios', 4, 1, 20),
  rankingWindowEditions:configNumber('calendario.mundialClubes.edicionesRanking', 4, 1, 10),
  championsCount:configNumber('calendario.mundialClubes.cuposChampions', 8, 1, 16),
  libertadoresCount:configNumber('calendario.mundialClubes.cuposLibertadores', 8, 1, 16),
  invitedCount:configNumber('calendario.mundialClubes.cuposInvitados', 16, 1, 30),
  rankingPoints:{
    win:configNumber('calendario.mundialClubes.rankingVictoria', 3, 0, 20),
    draw:configNumber('calendario.mundialClubes.rankingEmpate', 1, 0, 20),
    shootoutWin:configNumber('calendario.mundialClubes.rankingPenales', 1, 0, 20),
    reachR16:configNumber('calendario.mundialClubes.rankingOctavos', 2, 0, 50),
    reachQf:configNumber('calendario.mundialClubes.rankingCuartos', 3, 0, 50),
    reachSf:configNumber('calendario.mundialClubes.rankingSemifinal', 4, 0, 50),
    reachFinal:configNumber('calendario.mundialClubes.rankingFinal', 5, 0, 50)
  },
  scheduleSeasonDays:{
    draw:configNumber('calendario.mundialClubes.diaSorteo', 295, 1, 365),
    groups:[
      configNumber('calendario.mundialClubes.diaGrupos1', 305, 1, 365),
      configNumber('calendario.mundialClubes.diaGrupos2', 310, 1, 365),
      configNumber('calendario.mundialClubes.diaGrupos3', 315, 1, 365)
    ],
    r16:configNumber('calendario.mundialClubes.diaOctavos', 320, 1, 365),
    qf:configNumber('calendario.mundialClubes.diaCuartos', 325, 1, 365),
    sf:configNumber('calendario.mundialClubes.diaSemifinales', 330, 1, 365),
    thirdPlace:configNumber('calendario.mundialClubes.diaTercerPuesto', 335, 1, 365),
    final:configNumber('calendario.mundialClubes.diaFinal', 336, 1, 365)
  },
  preparationDaysBeforeFirstMatch:configNumber('calendario.mundialClubes.diasPreparacionAntesPrimerPartido', 1, 1, 10),
  minimumMatchSquad:configNumber('calendario.mundialClubes.jugadoresMinimosPorPartido', 21, 11, 42),
  championTrainingBoostMin:configNumber('calendario.mundialClubes.boostEntrenamientoCampeonMin', 10, 0, 99),
  championTrainingBoostMax:configNumber('calendario.mundialClubes.boostEntrenamientoCampeonMax', 30, 0, 99),
  ticketPrice:configNumber('calendario.mundialClubes.precioEntrada', 1200, 0, 1000000),
  finalTicketPrice:configNumber('calendario.mundialClubes.precioEntradaFinal', 3500, 0, 1000000),
  stadiums:[
    { name:'MetLife Stadium', capacity:81118 },
    { name:'Mercedes-Benz Stadium', capacity:66937 },
    { name:'Lincoln Financial Field', capacity:65782 },
    { name:'Camping World Stadium', capacity:43091 }
  ],
  invitedTeams:[
    { id:910001, name:'América de México', country:'México', city:'Ciudad de México', reputation:74, primaryColor:'#F4C430', crestPath:'img/escudos/América_de_México.png', nationalityPool:['México','México','México','México','México','México','Estados Unidos','Colombia'] },
    { id:910002, name:'Monterrey', country:'México', city:'Monterrey', reputation:73, primaryColor:'#005BAA', crestPath:'img/escudos/Monterrey.png', nationalityPool:['México','México','México','México','México','México','Colombia','Argentina'] },
    { id:910005, name:'Inter Miami', country:'Estados Unidos', city:'Miami', reputation:70, primaryColor:'#F7B5CD', crestPath:'img/escudos/Inter_Miami.png', nationalityPool:['Estados Unidos','Estados Unidos','Estados Unidos','Estados Unidos','Argentina','México','Colombia','Uruguay'] },
    { id:910006, name:'Seattle Sounders', country:'Estados Unidos', city:'Seattle', reputation:68, primaryColor:'#5D9731', crestPath:'img/escudos/Seattle_Sounders.png', nationalityPool:['Estados Unidos','Estados Unidos','Estados Unidos','Estados Unidos','Estados Unidos','México','Colombia','Inglaterra'] },
    { id:910007, name:'Wydad Casablanca', country:'Marruecos', city:'Casablanca', reputation:66, primaryColor:'#C8102E', crestPath:'img/escudos/Wydad_Casablanca.png', nationalityPool:['Marruecos','Marruecos','Marruecos','Marruecos','Marruecos','Senegal','Ghana','Nigeria'] },
    { id:910008, name:'Urawa Red Diamonds', country:'Japón', city:'Saitama', reputation:68, primaryColor:'#E60012', crestPath:'img/escudos/Urawa_Red_Diamonds.png', nationalityPool:['Japón','Japón','Japón','Japón','Japón','Japón','Corea del Sur','Brasil'] },
    { id:910009, name:'Al Ahly', country:'Egipto', city:'El Cairo', reputation:78, primaryColor:'#C8102E', crestPath:'img/escudos/Al_Ahly.png', nationalityPool:['Egipto','Egipto','Egipto','Egipto','Egipto','Egipto','Marruecos','Senegal'] },
    { id:910010, name:'Espérance de Tunis', country:'Túnez', city:'Túnez', reputation:68, primaryColor:'#D71920', crestPath:'img/escudos/Espérance_de_Tunis.png', nationalityPool:['Túnez','Túnez','Túnez','Túnez','Túnez','Marruecos','Senegal','Nigeria'] },
    { id:910011, name:'Mamelodi Sundowns', country:'Sudáfrica', city:'Pretoria', reputation:72, primaryColor:'#F5D328', crestPath:'img/escudos/Mamelodi_Sundowns.png', nationalityPool:['Sudáfrica','Sudáfrica','Sudáfrica','Sudáfrica','Sudáfrica','Ghana','Nigeria','Senegal'] },
    { id:910012, name:'TP Mazembe', country:'RD Congo', city:'Lubumbashi', reputation:66, primaryColor:'#111111', crestPath:'img/escudos/TP_Mazembe.png', nationalityPool:['RD Congo','RD Congo','RD Congo','RD Congo','RD Congo','Nigeria','Ghana','Senegal'] },
    { id:910013, name:'Al Hilal', country:'Arabia Saudita', city:'Riad', reputation:80, primaryColor:'#0057B8', crestPath:'img/escudos/Al_Hilal.png', nationalityPool:['Arabia Saudita','Arabia Saudita','Arabia Saudita','Arabia Saudita','Arabia Saudita','Marruecos','Brasil','Senegal'] },
    { id:910014, name:'Al Ain', country:'Emiratos Árabes Unidos', city:'Al Ain', reputation:70, primaryColor:'#6A1B9A', crestPath:'img/escudos/Al_Ain.png', nationalityPool:['Emiratos Árabes Unidos','Emiratos Árabes Unidos','Emiratos Árabes Unidos','Emiratos Árabes Unidos','Marruecos','Brasil','Senegal','Ghana'] },
    { id:910015, name:'Ulsan HD', country:'Corea del Sur', city:'Ulsan', reputation:69, primaryColor:'#005BAC', crestPath:'img/escudos/Ulsan_HD.png', nationalityPool:['Corea del Sur','Corea del Sur','Corea del Sur','Corea del Sur','Corea del Sur','Corea del Sur','Japón','Brasil'] },
    { id:910016, name:'Persepolis', country:'Irán', city:'Teherán', reputation:67, primaryColor:'#D71920', crestPath:'img/escudos/Persepolis.png', nationalityPool:['Irán','Irán','Irán','Irán','Irán','Irán','Marruecos','Senegal'] },
    { id:910017, name:'Deportivo Saprissa', country:'Costa Rica', city:'San José', reputation:63, primaryColor:'#6A1B4D', crestPath:'img/escudos/Deportivo_Saprissa.png', nationalityPool:['Costa Rica','Costa Rica','Costa Rica','Costa Rica','Costa Rica','México','Colombia','Estados Unidos'] },
    { id:910018, name:'CSD Municipal', country:'Guatemala', city:'Ciudad de Guatemala', reputation:55, primaryColor:'#D71920', crestPath:'img/escudos/CSD_Municipal.png', nationalityPool:['Guatemala','Guatemala','Guatemala','Guatemala','Guatemala','México','Colombia','Estados Unidos'] },
    { id:910019, name:'Auckland City', country:'Nueva Zelanda', city:'Auckland', reputation:60, primaryColor:'#1E4FA3', crestPath:'img/escudos/Auckland_City.png', nationalityPool:['Nueva Zelanda','Nueva Zelanda','Nueva Zelanda','Nueva Zelanda','Nueva Zelanda','Inglaterra','Japón','Corea del Sur'] },
    { id:910020, name:'Hekari United', country:'Papúa Nueva Guinea', city:'Port Moresby', reputation:48, primaryColor:'#C8102E', crestPath:'img/escudos/Hekari_United.png', nationalityPool:['Papúa Nueva Guinea','Papúa Nueva Guinea','Papúa Nueva Guinea','Papúa Nueva Guinea','Papúa Nueva Guinea','Ghana','Nueva Zelanda','Nigeria'] }
  ],
  // Lista histórica conservada solo como respaldo para partidas antiguas sin datos continentales.
  legacyQualifiers:[
    { country:'Argentina', order:1, count:2 },
    { country:'Chile', order:1, count:1 },
    { country:'Brasil', order:1, count:2 },
    { country:'Inglaterra', order:1, count:4 },
    { country:'España', order:1, count:3 },
    { country:'Italia', order:1, count:3 },
    { country:'Rumania', order:1, count:1 }
  ],
  prizes:{ participate:50000000, groups:70000000, qf:100000000, sf:140000000, runnerUp:180000000, champion:300000000 }
};
function clubWorldCupTeamKey(name){
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function clubWorldCupInviteId(index, team=null){ const explicitId=Math.round(Number(team?.id || 0)); return explicitId > 0 ? explicitId : (910000 + Number(index || 0) + 1); }
function clubWorldCupInviteRosterSize(){ return 25; }
function clubWorldCupInviteNationality(team, rosterIndex=0, playerId=0){
  const pool = Array.isArray(team?.nationalityPool) && team.nationalityPool.length ? team.nationalityPool : [team?.country || 'Argentina'];
  return String(pool[hashNumber(`cwc-invite-nationality-${team?.name || ''}-${rosterIndex}-${playerId}`, pool.length)] || team?.country || 'Argentina');
}
function clubWorldCupInviteMediaRange(team, rosterIndex=0){
  const reputation = clamp(Math.round(Number(team?.reputation || 50)), 20, 90);
  let min;
  let max;
  if(rosterIndex < 2){ min = reputation + 4; max = reputation + 10; }
  else if(rosterIndex < 8){ min = reputation - 2; max = reputation + 6; }
  else if(rosterIndex < 18){ min = reputation - 9; max = reputation + 2; }
  else { min = reputation - 15; max = reputation - 4; }
  return { min:clamp(min, 20, 94), max:clamp(Math.max(min, max), 20, 94) };
}
function generateClubWorldCupInvitePlayers(club, team, startId, fromRosterIndex=0, count=0, generationContext=null){
  const blueprint = typeof generationRosterBlueprint === 'function' ? generationRosterBlueprint() : ['POR','POR','POR','LD','LI','DFC','DFC','DFC','LD','LI','MCD','MCD','MC','MC','MCO','MCO','MI','MD','ED','EI','ED','EI','DC','DC','DC'];
  const total = Math.max(0, Math.round(Number(count || 0)));
  const firstIndex = Math.max(0, Math.round(Number(fromRosterIndex || 0)));
  const generated = [];
  for(let offset=0; offset<total; offset+=1){
    const rosterIndex = firstIndex + offset;
    const id = Number(startId || 0) + offset;
    const position = blueprint[rosterIndex % blueprint.length] || 'MC';
    const group = typeof playerRoleGroup === 'function' ? playerRoleGroup(position) : (position === 'POR' ? 'POR' : 'MID');
    const age = group === 'POR'
      ? 24 + hashNumber(`cwc-invite-age-${team?.name || club?.name}-${id}`, 12)
      : 18 + hashNumber(`cwc-invite-age-${team?.name || club?.name}-${id}`, 15);
    const range = clubWorldCupInviteMediaRange(team, rosterIndex);
    const nationality = clubWorldCupInviteNationality(team, rosterIndex, id);
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:club.id,
      age,
      prestige:Number(team?.reputation || club?.reputation || 50),
      nameContext:club.name,
      divisionName:club.divisionName,
      divisionOrder:club.divisionOrder,
      generationContext,
      salaryFactor:1,
      mediaMin:range.min,
      mediaMax:range.max,
      nationalityOverride:nationality,
      localCountry:team?.country || club?.country || 'Argentina'
    });
    generated.push({
      ...player,
      clubId:club.id,
      clubWorldCupInvitePlayer:true,
      specialCompetitionOnly:true,
      generatedForClubWorldCup:true,
      invitedRosterVersion:'V9.19'
    });
  }
  return generated;
}
function ensureClubWorldCupInvitedData(){
  if(!seed?.clubs || !seed?.players) return { clubs:0, players:0 };
  const cfg = CLUB_WORLD_CUP_CONFIG;
  const existingByKey = new Map((seed.clubs || []).map(club => [clubWorldCupTeamKey(club.name), club]));
  let addedClubs = 0;
  let addedPlayers = 0;
  cfg.invitedTeams.forEach((team, index) => {
    const key = clubWorldCupTeamKey(team.name);
    let club = existingByKey.get(key);
    if(!club){
      const id = clubWorldCupInviteId(index, team);
      club = {
        id,
        name:team.name,
        short:typeof clubShortFromName === 'function' ? clubShortFromName(team.name) : String(team.name).slice(0,3).toUpperCase(),
        city:team.city || '',
        country:team.country || '',
        reputation:Number(team.reputation || 50),
        budget:typeof clubBudgetByPrestige === 'function' ? clubBudgetByPrestige(Number(team.reputation || 50), 1) : 0,
        primaryColor:team.primaryColor || (typeof deterministicColor === 'function' ? deterministicColor(team.name) : '#888888'),
        divisionId:cfg.invitedDivisionId,
        divisionName:cfg.invitedDivisionName,
        divisionOrder:99,
        prizeMultiplier:1,
        clubWorldCupInvite:true,
        specialCompetitionOnly:true,
        noOwnStadium:true,
        fieldConditionScore:100,
        fieldCondition:'Excelente',
        crestPath:team.crestPath || ''
      };
      seed.clubs.push(club);
      existingByKey.set(key, club);
      addedClubs += 1;
      if(game?.standings && !game.standings[club.id]) game.standings[club.id] = { clubId:club.id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 };
      if(game?.teamCohesion && !game.teamCohesion[club.id]) game.teamCohesion[club.id] = 65;
    }else{
      club.clubWorldCupInvite = true;
      club.specialCompetitionOnly = true;
      club.noOwnStadium = true;
      club.country = team.country || club.country || '';
      club.city = team.city || club.city || '';
      club.divisionId = cfg.invitedDivisionId;
      club.divisionName = cfg.invitedDivisionName;
      club.divisionOrder = 99;
      club.reputation = Number(team.reputation || club.reputation || 50);
      club.primaryColor = team.primaryColor || club.primaryColor || '#888888';
      club.crestPath = team.crestPath || club.crestPath || '';
    }
    const currentPlayers = playersByClub(club.id).filter(player => !player.retired && !player.sold);
    const targetRosterSize = clubWorldCupInviteRosterSize();
    const needed = Math.max(0, targetRosterSize - currentPlayers.length);
    if(needed > 0 && typeof generatedPlayerFactory === 'function'){
      const activePlayers = (seed.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
      const context = typeof createPlayerGenerationContext === 'function' ? createPlayerGenerationContext(activePlayers.length + needed, activePlayers) : null;
      const generated = generateClubWorldCupInvitePlayers(club, team, nextPlayerId(), currentPlayers.length, needed, context);
      seed.players.push(...generated);
      addedPlayers += generated.length;
      if(game){
        game.playerStats = game.playerStats || {};
        game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
        generated.forEach(player => {
          if(!game.playerStats[player.id]) game.playerStats[player.id] = createEmptyPlayerStat(player);
          if(!game.playerCareerStats[player.id]) game.playerCareerStats[player.id] = createEmptyPlayerStat(player);
          if(game.playerCondition) game.playerCondition[player.id] = Math.max(65, Number(game.playerCondition[player.id] || 0));
          if(game.playerMorale) game.playerMorale[player.id] = Math.max(60, Number(game.playerMorale[player.id] || 0));
          game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
          delete game.playerAgeSkillPenalties[player.id];
          if(game.trainingPlan) game.trainingPlan[player.id] = typeof safeIndividualTrainingType === 'function' ? safeIndividualTrainingType(game.trainingPlan[player.id]) : (game.trainingPlan[player.id] || 'balanced');
        });
      }
    }
  });
  return { clubs:addedClubs, players:addedPlayers };
}
function normalizeClubWorldCupMatchSnapshot(match){
  const src = (match && typeof match === 'object' && !Array.isArray(match)) ? match : {};
  const homeId = Number(src.homeId || 0);
  const awayId = Number(src.awayId || 0);
  const homeGoals = Number(src.homeGoals || 0);
  const awayGoals = Number(src.awayGoals || 0);
  const played = Boolean(src.played);
  const penalties = src.penaltyShootout && typeof src.penaltyShootout === 'object' ? {
    home:Number(src.penaltyShootout.home || 0),
    away:Number(src.penaltyShootout.away || 0),
    homeKicks:Number(src.penaltyShootout.homeKicks || 0),
    awayKicks:Number(src.penaltyShootout.awayKicks || 0),
    firstClubId:Number(src.penaltyShootout.firstClubId || 0),
    winnerClubId:Number(src.penaltyShootout.winnerClubId || 0),
    completedRounds:Number(src.penaltyShootout.completedRounds || 0),
    suddenDeathRounds:Number(src.penaltyShootout.suddenDeathRounds || 0),
    earlyFinish:Boolean(src.penaltyShootout.earlyFinish),
    kicks:(Array.isArray(src.penaltyShootout.kicks) ? src.penaltyShootout.kicks : []).map(kick => ({
      order:Number(kick?.order || 0), round:Number(kick?.round || 0), suddenDeath:Boolean(kick?.suddenDeath),
      clubId:Number(kick?.clubId || 0), playerId:Number(kick?.playerId || 0), playerName:String(kick?.playerName || ''),
      goalkeeperId:Number(kick?.goalkeeperId || 0), goalkeeperName:String(kick?.goalkeeperName || ''),
      scored:Boolean(kick?.scored), probability:Number(kick?.probability || 0)
    }))
  } : null;
  const tiebreaker = src.clubWorldCupTiebreaker && typeof src.clubWorldCupTiebreaker === 'object' ? {
    type:String(src.clubWorldCupTiebreaker.type || ''),
    homeFouls:Number(src.clubWorldCupTiebreaker.homeFouls || 0),
    awayFouls:Number(src.clubWorldCupTiebreaker.awayFouls || 0),
    homeCards:Number(src.clubWorldCupTiebreaker.homeCards || 0),
    awayCards:Number(src.clubWorldCupTiebreaker.awayCards || 0),
    winnerClubId:Number(src.clubWorldCupTiebreaker.winnerClubId || 0)
  } : null;
  let winnerClubId = Number(src.winnerClubId || tiebreaker?.winnerClubId || 0);
  if(!winnerClubId && played){
    if(homeGoals > awayGoals) winnerClubId = homeId;
    else if(awayGoals > homeGoals) winnerClubId = awayId;
    else if(penalties && penalties.home !== penalties.away) winnerClubId = penalties.home > penalties.away ? homeId : awayId;
  }
  const stage = String(src.clubWorldCupStage || src.stage || '');
  const roundNumber = Math.max(0, Math.round(Number(src.clubWorldCupRound || src.roundNumber || 0)));
  const seasonDay = Math.max(0, Math.round(Number(src.seasonDay || src.clubWorldCupSeasonDay || clubWorldCupStageSeasonDay(stage, roundNumber || 1) || 0)));
  return {
    id:String(src.id || ''),
    date:validIsoDate(src.date) ? src.date : '',
    seasonDay,
    stage,
    groupId:String(src.clubWorldCupGroup || src.groupId || ''),
    roundNumber,
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    played,
    winnerClubId,
    stadiumName:String(src.stadiumName || src.matchContext?.stadiumName || ''),
    attendance:Math.max(0, Math.round(Number(src.attendance ?? src.totalFans ?? src.matchContext?.totalFans ?? 0))),
    ticketPrice:Math.max(0, Math.round(Number(src.ticketPrice ?? src.matchContext?.ticketPrice ?? 0))),
    ticketRevenue:Math.max(0, Math.round(Number(src.ticketRevenue ?? src.matchContext?.ticketRevenue ?? 0))),
    bracketKey:String(src.clubWorldCupBracketKey || src.bracketKey || ''),
    bracketSlot:String(src.clubWorldCupBracketSlot || src.bracketSlot || ''),
    penaltyShootout:penalties,
    tiebreaker
  };
}
function normalizeClubWorldCupStandingSnapshot(row, position=0){
  const src = (row && typeof row === 'object' && !Array.isArray(row)) ? row : {};
  return {
    clubId:Number(src.clubId || 0),
    pj:Number(src.pj || 0), pg:Number(src.pg || 0), pe:Number(src.pe || 0), pp:Number(src.pp || 0),
    gf:Number(src.gf || 0), gc:Number(src.gc || 0), dg:Number(src.dg || 0), pts:Number(src.pts || 0),
    position:Math.max(1, Math.round(Number(src.position || position || 1)))
  };
}
function normalizeClubWorldCupEditionSnapshot(item){
  const src = (item && typeof item === 'object' && !Array.isArray(item)) ? item : {};
  const season = Math.max(1, Math.round(Number(src.season || 1)));
  const year = Math.round(Number(src.year || 0)) || seasonYearForNumber(season);
  const groups = (Array.isArray(src.groups) ? src.groups : []).map((group, groupIndex) => ({
    id:String(group?.id || String.fromCharCode(65 + groupIndex)),
    name:String(group?.name || `Grupo ${group?.id || String.fromCharCode(65 + groupIndex)}`),
    clubIds:Array.from(new Set((Array.isArray(group?.clubIds) ? group.clubIds : []).map(Number).filter(Boolean))),
    standings:(Array.isArray(group?.standings) ? group.standings : []).map((row, index) => normalizeClubWorldCupStandingSnapshot(row, index + 1)).filter(row => row.clubId),
    matches:(Array.isArray(group?.matches) ? group.matches : []).map(normalizeClubWorldCupMatchSnapshot).filter(match => match.homeId && match.awayId)
  })).filter(group => group.clubIds.length || group.standings.length || group.matches.length);
  const stages = {};
  ['r16','qf','sf','thirdPlace','final'].forEach(stage => {
    stages[stage] = (Array.isArray(src?.stages?.[stage]) ? src.stages[stage] : []).map(normalizeClubWorldCupMatchSnapshot).filter(match => match.homeId && match.awayId);
  });
  return {
    season,
    year,
    name:String(src.name || CLUB_WORLD_CUP_CONFIG?.name || 'Copa Mundial de Clubes de la FIFA'),
    status:String(src.status || (src.championId ? 'completed' : 'groups')),
    createdAt:String(src.createdAt || ''),
    archivedAt:String(src.archivedAt || ''),
    drawDate:validIsoDate(src.drawDate) ? src.drawDate : clubWorldCupIsoForSeasonDay(Number(src.drawSeasonDay || clubWorldCupFixtureReadySeasonDay()), year),
    drawSeasonDay:Math.max(1, Math.round(Number(src.drawSeasonDay || clubWorldCupFixtureReadySeasonDay()))),
    firstGroupDate:validIsoDate(src.firstGroupDate) ? src.firstGroupDate : clubWorldCupStageDate('groups', 1, year),
    groupDates:(Array.isArray(src.groupDates) && src.groupDates.length ? src.groupDates : clubWorldCupGroupDatesFromFirstDate('', year)).filter(validIsoDate).slice(0,3),
    groupSeasonDays:(Array.isArray(src.groupSeasonDays) && src.groupSeasonDays.length ? src.groupSeasonDays : clubWorldCupGroupSeasonDays()).map(value => Math.max(1, Math.round(Number(value || 1)))).slice(0,3),
    stageSeasonDays:{
      r16:Math.max(1, Math.round(Number(src?.stageSeasonDays?.r16 || clubWorldCupStageSeasonDay('r16', 1)))),
      qf:Math.max(1, Math.round(Number(src?.stageSeasonDays?.qf || clubWorldCupStageSeasonDay('qf', 1)))),
      sf:Math.max(1, Math.round(Number(src?.stageSeasonDays?.sf || clubWorldCupStageSeasonDay('sf', 1)))),
      thirdPlace:Math.max(1, Math.round(Number(src?.stageSeasonDays?.thirdPlace || clubWorldCupStageSeasonDay('thirdPlace', 1)))),
      final:Math.max(1, Math.round(Number(src?.stageSeasonDays?.final || clubWorldCupStageSeasonDay('final', 1))))
    },
    participantClubIds:Array.from(new Set((Array.isArray(src.participantClubIds) ? src.participantClubIds : []).map(Number).filter(Boolean))),
    championsLeagueClubIds:Array.from(new Set((Array.isArray(src.championsLeagueClubIds) ? src.championsLeagueClubIds : []).map(Number).filter(Boolean))),
    libertadoresClubIds:Array.from(new Set((Array.isArray(src.libertadoresClubIds) ? src.libertadoresClubIds : []).map(Number).filter(Boolean))),
    invitedClubIds:Array.from(new Set((Array.isArray(src.invitedClubIds) ? src.invitedClubIds : []).map(Number).filter(Boolean))),
    qualificationWindowYears:(Array.isArray(src.qualificationWindowYears) ? src.qualificationWindowYears : []).map(Number).filter(Boolean),
    qualificationSources:(Array.isArray(src.qualificationSources) ? src.qualificationSources : []).map(item => ({
      clubId:Number(item?.clubId || 0), competition:String(item?.competition || ''), source:String(item?.source || ''),
      confirmed:item?.confirmed !== false, points:Number(item?.points || 0), rank:Number(item?.rank || 0), year:Number(item?.year || 0)
    })).filter(item => item.clubId),
    continentalRankings:src.continentalRankings && typeof src.continentalRankings === 'object' && !Array.isArray(src.continentalRankings) ? {
      champions:(Array.isArray(src.continentalRankings.champions) ? src.continentalRankings.champions : []).map(item => ({ ...item, clubId:Number(item?.clubId || 0) })).filter(item => item.clubId),
      libertadores:(Array.isArray(src.continentalRankings.libertadores) ? src.continentalRankings.libertadores : []).map(item => ({ ...item, clubId:Number(item?.clubId || 0) })).filter(item => item.clubId)
    } : { champions:[], libertadores:[] },
    groups,
    stages,
    championId:Number(src.championId || 0),
    runnerUpId:Number(src.runnerUpId || 0),
    thirdPlaceId:Number(src.thirdPlaceId || 0),
    summaryOnly:Boolean(src.summaryOnly),
    sourceVersion:String(src.sourceVersion || APP_VERSION || '')
  };
}
function normalizeClubWorldCupHistoryState(src){
  const obj = (src && typeof src === 'object' && !Array.isArray(src)) ? src : {};
  const editions = Array.isArray(obj.editions) ? obj.editions : (Array.isArray(obj.seasons) ? obj.seasons : []);
  const byKey = new Map();
  editions.map(normalizeClubWorldCupEditionSnapshot).forEach(edition => {
    if(!edition.season || !edition.year) return;
    const key = `${edition.season}-${edition.year}`;
    const previous = byKey.get(key);
    const score = Number(edition.groups.length > 0) * 100 + Object.values(edition.stages).reduce((sum, rows) => sum + rows.length, 0) + Number(Boolean(edition.championId));
    const previousScore = previous ? Number(previous.groups.length > 0) * 100 + Object.values(previous.stages).reduce((sum, rows) => sum + rows.length, 0) + Number(Boolean(previous.championId)) : -1;
    if(!previous || score >= previousScore) byKey.set(key, edition);
  });
  return { editions:Array.from(byKey.values()).sort((a,b)=>Number(b.year || 0)-Number(a.year || 0) || Number(b.season || 0)-Number(a.season || 0)) };
}
function clubWorldCupMatchesForState(targetState, cupState=null){
  const target = targetState || game || {};
  const cup = cupState || target.clubWorldCup || null;
  const season = Number(cup?.season || target.seasonNumber || 0);
  return (Array.isArray(target.fixtures) ? target.fixtures : [])
    .filter(round => round?.clubWorldCupRound || (round?.matches || []).some(match => match?.clubWorldCup))
    .flatMap(round => round?.matches || [])
    .filter(match => match?.clubWorldCup && (!season || String(match.id || '').includes(`cwc-s${season}-`) || Number(match.season || season) === season));
}
function clubWorldCupStandingsFromMatches(clubIds=[], matches=[]){
  const rows = Object.fromEntries((clubIds || []).map(Number).filter(Boolean).map(id => [id, { clubId:id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 }]));
  (matches || []).filter(match => match?.played).forEach(match => {
    const h = rows[Number(match.homeId)];
    const a = rows[Number(match.awayId)];
    if(!h || !a) return;
    const hg = Number(match.homeGoals || 0);
    const ag = Number(match.awayGoals || 0);
    h.pj += 1; a.pj += 1;
    h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
    if(hg > ag){ h.pg += 1; a.pp += 1; h.pts += 3; }
    else if(hg < ag){ a.pg += 1; h.pp += 1; a.pts += 3; }
    else { h.pe += 1; a.pe += 1; h.pts += 1; a.pts += 1; }
    h.dg = h.gf - h.gc; a.dg = a.gf - a.gc;
  });
  return Object.values(rows)
    .sort((a,b)=>b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || clubPrestigeValue(b.clubId)-clubPrestigeValue(a.clubId) || clubName(a.clubId).localeCompare(clubName(b.clubId), 'es', { sensitivity:'base' }))
    .map((row,index)=>({ ...row, position:index + 1 }));
}
function clubWorldCupEditionSnapshotForState(targetState, cupState=null){
  const target = targetState || game || {};
  const cup = cupState || target.clubWorldCup;
  if(!cup || typeof cup !== 'object') return null;
  const season = Math.max(1, Math.round(Number(cup.season || target.seasonNumber || 1)));
  const year = Math.round(Number(cup.year || (Number(target.seasonNumber || 0) === season ? target.seasonYear : 0) || seasonYearForNumber(season))) || seasonYearForNumber(season);
  const allMatches = clubWorldCupMatchesForState(target, cup).map(normalizeClubWorldCupMatchSnapshot);
  const groups = (Array.isArray(cup.groups) ? cup.groups : []).map((group, groupIndex) => {
    const id = String(group?.id || String.fromCharCode(65 + groupIndex));
    const clubIds = Array.from(new Set((Array.isArray(group?.clubIds) ? group.clubIds : []).map(Number).filter(Boolean)));
    const matches = allMatches.filter(match => match.stage === 'groups' && String(match.groupId) === id);
    return {
      id,
      name:String(group?.name || `Grupo ${id}`),
      clubIds,
      standings:clubWorldCupStandingsFromMatches(clubIds, matches),
      matches
    };
  });
  const stages = {};
  ['r16','qf','sf','thirdPlace','final'].forEach(stage => { stages[stage] = allMatches.filter(match => match.stage === stage); });
  return normalizeClubWorldCupEditionSnapshot({
    season,
    year,
    name:cup.name || CLUB_WORLD_CUP_CONFIG.name,
    status:cup.status || 'groups',
    createdAt:(()=>{ if(!cup.createdAt) return ''; const value = Number(cup.createdAt) || cup.createdAt; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(cup.createdAt) : date.toISOString(); })(),
    archivedAt:'',
    drawDate:cup.drawDate || '',
    drawSeasonDay:cup.drawSeasonDay || clubWorldCupFixtureReadySeasonDay(),
    firstGroupDate:cup.firstGroupDate || '',
    groupDates:cup.groupDates || [],
    groupSeasonDays:cup.groupSeasonDays || clubWorldCupGroupSeasonDays(),
    stageSeasonDays:cup.stageSeasonDays || {
      r16:clubWorldCupStageSeasonDay('r16', 1),
      qf:clubWorldCupStageSeasonDay('qf', 1),
      sf:clubWorldCupStageSeasonDay('sf', 1),
      thirdPlace:clubWorldCupStageSeasonDay('thirdPlace', 1),
      final:clubWorldCupStageSeasonDay('final', 1)
    },
    participantClubIds:cup.participantClubIds || [],
    championsLeagueClubIds:cup.championsLeagueClubIds || [],
    libertadoresClubIds:cup.libertadoresClubIds || [],
    invitedClubIds:cup.invitedClubIds || [],
    qualificationWindowYears:cup.qualificationWindowYears || [],
    qualificationSources:cup.qualificationSources || [],
    continentalRankings:cup.continentalRankings || { champions:[], libertadores:[] },
    groups,
    stages,
    championId:cup.championId || 0,
    runnerUpId:cup.runnerUpId || 0,
    thirdPlaceId:cup.thirdPlaceId || 0,
    summaryOnly:false,
    sourceVersion:APP_VERSION
  });
}
function archiveClubWorldCupEditionForState(targetState, options={}){
  const target = targetState || game;
  if(!target?.clubWorldCup) return false;
  const snapshot = clubWorldCupEditionSnapshotForState(target, target.clubWorldCup);
  if(!snapshot) return false;
  if(!options.allowIncomplete && snapshot.status !== 'completed' && !snapshot.championId) return false;
  target.clubWorldCupHistory = normalizeClubWorldCupHistoryState(target.clubWorldCupHistory || {});
  const key = `${snapshot.season}-${snapshot.year}`;
  const previous = (target.clubWorldCupHistory.editions || []).find(item => `${Number(item.season || 0)}-${Number(item.year || 0)}` === key) || null;
  snapshot.archivedAt = String(previous?.archivedAt || new Date().toISOString());
  target.clubWorldCupHistory.editions = (target.clubWorldCupHistory.editions || []).filter(item => `${Number(item.season || 0)}-${Number(item.year || 0)}` !== key);
  target.clubWorldCupHistory.editions.push(snapshot);
  target.clubWorldCupHistory = normalizeClubWorldCupHistoryState(target.clubWorldCupHistory);
  return true;
}
function syncClubWorldCupHistoryForState(targetState){
  const target = targetState || game;
  if(!target) return false;
  const before = JSON.stringify(target.clubWorldCupHistory || {});
  target.clubWorldCupHistory = normalizeClubWorldCupHistoryState(target.clubWorldCupHistory || {});
  if(target.clubWorldCup && (String(target.clubWorldCup.status || '') === 'completed' || Number(target.clubWorldCup.championId || 0))){
    archiveClubWorldCupEditionForState(target, { allowIncomplete:false });
  }
  const champions = normalizeCompetitionChampionsHistoryState(target.competitionChampionsHistory || {}).entries || [];
  champions.filter(entry => String(entry.type || '') === 'club_world_cup' || String(entry.competitionId || '') === 'club-world-cup').forEach(entry => {
    const season = Number(entry.season || 0);
    const year = Number(entry.year || 0) || seasonYearForNumber(season);
    const exists = (target.clubWorldCupHistory.editions || []).some(item => Number(item.season || 0) === season && Number(item.year || 0) === year);
    if(exists) return;
    target.clubWorldCupHistory.editions.push(normalizeClubWorldCupEditionSnapshot({
      season,
      year,
      name:entry.competitionName || CLUB_WORLD_CUP_CONFIG.name,
      status:'completed',
      championId:entry.championId,
      runnerUpId:entry.runnerUpId,
      thirdPlaceId:entry.thirdPlaceId,
      summaryOnly:true,
      sourceVersion:'legacy'
    }));
  });
  target.clubWorldCupHistory = normalizeClubWorldCupHistoryState(target.clubWorldCupHistory);
  return JSON.stringify(target.clubWorldCupHistory || {}) !== before;
}
function clubWorldCupHistoryEntries(){
  if(!game) return [];
  syncClubWorldCupHistoryForState(game);
  return (game.clubWorldCupHistory?.editions || []).slice().sort((a,b)=>Number(b.year || 0)-Number(a.year || 0) || Number(b.season || 0)-Number(a.season || 0));
}
function clubWorldCupCurrentEditionSnapshot(){
  const state = clubWorldCupState();
  return state ? clubWorldCupEditionSnapshotForState(game, state) : null;
}
function clubWorldCupState(){
  if(!game) return null;
  const season = Number(game.seasonNumber || 1);
  if(!game.clubWorldCup || Number(game.clubWorldCup.season || 0) !== season){
    game.clubWorldCup = null;
  }
  return game.clubWorldCup;
}
function clubWorldCupParticipantIds(state=clubWorldCupState()){
  return Array.from(new Set((Array.isArray(state?.participantClubIds) ? state.participantClubIds : []).map(Number).filter(Boolean)));
}
function clubWorldCupClubParticipates(clubId, state=clubWorldCupState()){
  const id = Number(clubId || 0);
  return id > 0 && clubWorldCupParticipantIds(state).includes(id);
}

function clubWorldCupPreparationSeasonDay(){
  const firstGroupDay = Math.max(1, Number(clubWorldCupGroupSeasonDays()[0] || 1));
  return Math.max(1, firstGroupDay - Math.max(1, Number(CLUB_WORLD_CUP_CONFIG.preparationDaysBeforeFirstMatch || 1)));
}
function clearClubWorldCupPlayerInjury(playerId){
  if(!game?.playerStatus) return false;
  const id = Number(playerId || 0);
  const before = game.playerStatus[id];
  const injuryFields = ['injuredThrough','injuredUntilTurn','injuryLabel','injuryChance','injuredAtMatchday','injuredAtTurn','carriedFromPreviousSeason','carriedFromSeason','rebasedForSeason'];
  if(!before || !injuryFields.some(key => Object.prototype.hasOwnProperty.call(before, key))) return false;
  const clean = typeof removeInjuryFieldsFromStatus === 'function' ? removeInjuryFieldsFromStatus(before) : (() => {
    const next = { ...before };
    injuryFields.forEach(key => delete next[key]);
    return next;
  })();
  if(Object.keys(clean).length) game.playerStatus[id] = clean;
  else delete game.playerStatus[id];
  return true;
}
function clubWorldCupActiveSquad(clubId){
  return playersByClub(Number(clubId || 0)).filter(player => player && !player.retired && !player.sold && !player.freeAgent);
}
function clubWorldCupEligibleSquad(clubId){
  return clubWorldCupActiveSquad(clubId).filter(player => !isUnavailable(player.id, COMPETITION_SUSPENSION_SCOPES.INTERNATIONAL_CUP));
}
function clubWorldCupNextRosterGroup(clubId){
  const squad = clubWorldCupEligibleSquad(clubId);
  const counts = rosterGroupCounts(squad);
  const req = minimumRosterRequirements();
  const deficits = [
    ['POR', Math.max(0, Number(req.POR || 0) - Number(counts.POR || 0))],
    ['DEF', Math.max(0, Number(req.DEF || 0) - Number(counts.DEF || 0))],
    ['MID', Math.max(0, Number(req.MID || 0) - Number(counts.MID || 0))],
    ['ATT', Math.max(0, Number(req.ATT || 0) - Number(counts.ATT || 0))]
  ].sort((a,b)=>b[1]-a[1]);
  if(deficits[0][1] > 0) return deficits[0][0];
  return ['DEF','MID','ATT','POR'].sort((a,b)=>Number(counts[a] || 0)-Number(counts[b] || 0))[0] || 'MID';
}
function ensureClubWorldCupParticipantRoster(clubId, minimumPlayers=CLUB_WORLD_CUP_CONFIG.minimumMatchSquad, report=null){
  const id = Number(clubId || 0);
  const club = seed?.clubs?.find(item => Number(item.id) === id);
  if(!club || id === Number(game?.selectedClubId || 0)) return { eligible:clubWorldCupEligibleSquad(id).length, added:0 };
  const localReport = report || { created:0, converted:0, signedFreeAgents:0 };
  if(typeof repairBotRoster === 'function') repairBotRoster(club, localReport);
  let added = 0;
  let guard = 0;
  while(clubWorldCupEligibleSquad(id).length < Math.max(11, Number(minimumPlayers || 21)) && guard < 48){
    const before = clubWorldCupActiveSquad(id).length;
    const group = clubWorldCupNextRosterGroup(id);
    if(typeof addOrConvertEmergencyBotPlayer !== 'function') break;
    const player = addOrConvertEmergencyBotPlayer(club, group, localReport);
    if(!player) break;
    added += clubWorldCupActiveSquad(id).length > before ? 1 : 0;
    guard += 1;
  }
  return { eligible:clubWorldCupEligibleSquad(id).length, added };
}
function clubWorldCupLeagueChampionIds(state=clubWorldCupState()){
  const participants = new Set(clubWorldCupParticipantIds(state));
  const champions = new Set();
  const season = Number(state?.season || game?.seasonNumber || 1);
  const recorded = normalizeCompetitionChampionsHistoryState(game?.competitionChampionsHistory || {}).entries || [];
  recorded.filter(entry => Number(entry.season || 0) === season && String(entry.type || 'league') === 'league').forEach(entry => {
    const id = Number(entry.championId || 0);
    if(participants.has(id)) champions.add(id);
  });
  (seed?.divisions || []).forEach(division => {
    if(String(division?.id || '') === String(CLUB_WORLD_CUP_CONFIG.divisionId) || String(division?.id || '') === String(CLUB_WORLD_CUP_CONFIG.invitedDivisionId)) return;
    const championId = Number(sortedStandings(division.id)?.[0]?.clubId || 0);
    if(participants.has(championId)) champions.add(championId);
  });
  return Array.from(champions).filter(id => id && id !== Number(game?.selectedClubId || 0));
}
function applyClubWorldCupChampionTrainingBoost(clubId, state=clubWorldCupState()){
  const id = Number(clubId || 0);
  const season = Number(state?.season || game?.seasonNumber || 1);
  const minBoost = Math.min(Number(CLUB_WORLD_CUP_CONFIG.championTrainingBoostMin || 10), Number(CLUB_WORLD_CUP_CONFIG.championTrainingBoostMax || 30));
  const maxBoost = Math.max(Number(CLUB_WORLD_CUP_CONFIG.championTrainingBoostMin || 10), Number(CLUB_WORLD_CUP_CONFIG.championTrainingBoostMax || 30));
  const spread = Math.max(1, Math.round(maxBoost - minBoost + 1));
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  let players = 0;
  let gains = 0;
  clubWorldCupActiveSquad(id).forEach(player => {
    const target = Math.round(minBoost + hashNumber(`cwc-champion-boost-${season}-${id}-${player.id}`, spread));
    const skills = (typeof trainableSkillsForPlayer === 'function' ? trainableSkillsForPlayer(player) : botBalanceSkillPool(player)).filter(Boolean);
    if(!skills.length || target <= 0) return;
    game.playerSkillBoosts[player.id] = game.playerSkillBoosts[player.id] && typeof game.playerSkillBoosts[player.id] === 'object' && !Array.isArray(game.playerSkillBoosts[player.id]) ? game.playerSkillBoosts[player.id] : {};
    let applied = 0;
    let safety = 0;
    while(applied < target && safety < target * Math.max(4, skills.length)){
      const skill = skills[hashNumber(`cwc-champion-skill-${season}-${id}-${player.id}-${safety}`, skills.length)];
      const current = Math.max(0, Math.round(Number(game.playerSkillBoosts[player.id][skill] || 0)));
      if(current < 30 && baseSkill(player, skill) < 99){
        game.playerSkillBoosts[player.id][skill] = current + 1;
        applied += 1;
      }
      safety += 1;
    }
    if(applied > 0){ players += 1; gains += applied; }
  });
  return { clubId:id, players, gains };
}
function prepareClubWorldCupParticipantsIfNeeded(options={}){
  const state = clubWorldCupState();
  const result = { applied:false, changed:false, reason:'', clubs:0, players:0, injuriesCleared:0, rosterAdded:0, championClubs:0, championPlayers:0, championGains:0 };
  if(!game || !state || state.status === 'completed') return result;
  const season = Number(state.season || game.seasonNumber || 1);
  const source = String(options.source || '');
  const preparationRecord = state.hostCityPreparation;
  const alreadyApplied = Boolean(preparationRecord?.applied && Number(preparationRecord.season || 0) === season);
  const readinessValidationSources = new Set(['daily_calendar','daily_calendar_complete','before_matchday']);
  if(alreadyApplied && !options.forceReadiness && !readinessValidationSources.has(source)) return result;
  const currentDay = clubWorldCupCurrentSeasonDay();
  const preparationDay = clubWorldCupPreparationSeasonDay();
  if(currentDay < preparationDay) return result;
  const playedCupMatches = clubWorldCupPlayedMatches();
  if(playedCupMatches.length){ result.reason = 'el torneo ya tiene partidos disputados'; return result; }
  ensurePlayerStateForAll();
  ensureTeamCohesion();
  game.playerStatus = game.playerStatus || {};
  game.playerWear = game.playerWear || {};
  game.lastMatchTactics = game.lastMatchTactics || {};
  const participantIds = clubWorldCupParticipantIds(state).filter(id => Number(id) !== Number(game.selectedClubId || 0));
  const rosterReport = { created:0, converted:0, signedFreeAgents:0 };
  let readinessChanged = false;
  const normalizeReadyPlayer = player => {
    if(clearClubWorldCupPlayerInjury(player.id)){ result.injuriesCleared += 1; readinessChanged = true; }
    if(Number(game.playerWear[player.id] || 0) !== 0) readinessChanged = true;
    if(Number(game.playerCondition[player.id]) !== 99) readinessChanged = true;
    if(Number(game.playerMorale[player.id]) !== 99) readinessChanged = true;
    game.playerWear[player.id] = 0;
    game.playerCondition[player.id] = 99;
    game.playerMorale[player.id] = 99;
  };
  participantIds.forEach(clubId => {
    if(Number(game.teamCohesion[clubId]) !== 100) readinessChanged = true;
    game.teamCohesion[clubId] = 100;
    clubWorldCupActiveSquad(clubId).forEach(normalizeReadyPlayer);
    const roster = ensureClubWorldCupParticipantRoster(clubId, CLUB_WORLD_CUP_CONFIG.minimumMatchSquad, rosterReport);
    result.rosterAdded += Number(roster.added || 0);
    if(Number(roster.added || 0) > 0) readinessChanged = true;
    const readySquad = clubWorldCupActiveSquad(clubId);
    readySquad.forEach(normalizeReadyPlayer);
    result.players += readySquad.length;
    const preparedTactic = window.Simulator20?.botTacticForClub?.(clubId);
    if(preparedTactic && typeof tacticSignature === 'function'){
      const signature = tacticSignature(preparedTactic);
      if(game.lastMatchTactics[clubId] !== signature) readinessChanged = true;
      game.lastMatchTactics[clubId] = signature;
    }
    result.clubs += 1;
  });
  if(!alreadyApplied){
    const championIds = clubWorldCupLeagueChampionIds(state);
    championIds.forEach(clubId => {
      const boost = applyClubWorldCupChampionTrainingBoost(clubId, state);
      result.championClubs += 1;
      result.championPlayers += Number(boost.players || 0);
      result.championGains += Number(boost.gains || 0);
    });
    state.hostCityPreparation = {
      applied:true,
      season,
      preparationSeasonDay:preparationDay,
      appliedSeasonDay:currentDay,
      appliedDate:game.currentDate || '',
      participantClubCount:participantIds.length,
      minimumMatchSquad:Number(CLUB_WORLD_CUP_CONFIG.minimumMatchSquad || 21),
      rosterReport:{ ...rosterReport },
      summary:{ ...result, applied:true, changed:true },
      version:APP_VERSION
    };
    pushGameMessage({
      type:'deportivo',
      priority:'normal',
      inbox:clubWorldCupClubParticipates(game.selectedClubId, state) ? 'always' : 'never',
      title:CLUB_WORLD_CUP_CONFIG.name,
      body:'Los equipos ya están listos en la ciudad anfitriona.',
      id:`club-world-cup-${season}-host-city-ready`
    });
    result.applied = true;
    result.changed = true;
    game._needsAutosave = true;
    return result;
  }
  if(readinessChanged){
    state.hostCityPreparation.lastValidatedSeasonDay = currentDay;
    state.hostCityPreparation.lastValidatedDate = game.currentDate || '';
    state.hostCityPreparation.validationCount = Math.max(0, Number(state.hostCityPreparation.validationCount || 0)) + 1;
    state.hostCityPreparation.lastValidationSummary = {
      clubs:result.clubs,
      players:result.players,
      injuriesCleared:result.injuriesCleared,
      rosterAdded:result.rosterAdded
    };
    result.changed = true;
    game._needsAutosave = true;
  }
  return result;
}
function clubWorldCupAuthoritativeSeasonDay(match, round=null, state=clubWorldCupState()){
  if(!match?.clubWorldCup) return 0;
  const stage = String(match?.clubWorldCupStage || round?.clubWorldCupStage || '');
  const roundNumber = Math.max(1, Math.round(Number(match?.clubWorldCupRound || clubWorldCupRoundNumberFromRound(round, 1) || 1)));
  const fixed = clubWorldCupStageSeasonDay(stage, roundNumber);
  if(fixed > 0) return fixed;
  return Math.max(0, Math.round(Number(match?.seasonDay || round?.seasonDay || 0)));
}
function clubWorldCupAuthoritativeMatchDate(match, round=null, state=clubWorldCupState()){
  if(!match?.clubWorldCup) return '';
  const season = Math.max(1, Math.round(Number(state?.season || game?.seasonNumber || 1)));
  const year = Math.round(Number(state?.year || (season === Number(game?.seasonNumber || 0) ? game?.seasonYear : 0) || seasonYearForNumber(season))) || seasonYearForNumber(season);
  const seasonDay = clubWorldCupAuthoritativeSeasonDay(match, round, state);
  if(seasonDay > 0) return clubWorldCupIsoForSeasonDay(seasonDay, year);
  if(validIsoDate(round?.date)) return round.date;
  return validIsoDate(match?.date) ? match.date : '';
}
function repairInvalidClubWorldCupParticipationPrizeForState(state){
  const cup = state?.clubWorldCup;
  if(!cup || !Array.isArray(cup.participantClubIds) || !cup.participantClubIds.length) return false;
  const managedId = Number(state?.selectedClubId || 0);
  if(!managedId || clubWorldCupClubParticipates(managedId, cup)) return false;
  const paid = cup.prizesPaid?.[managedId];
  const amount = Math.max(0, Math.round(Number(paid?.participate || 0)));
  if(amount <= 0) return false;
  cup.invalidParticipationPrizeReversals = (cup.invalidParticipationPrizeReversals && typeof cup.invalidParticipationPrizeReversals === 'object' && !Array.isArray(cup.invalidParticipationPrizeReversals)) ? cup.invalidParticipationPrizeReversals : {};
  const reversalKey = `${managedId}:participate`;
  if(cup.invalidParticipationPrizeReversals[reversalKey]) return false;
  delete paid.participate;
  if(!Object.keys(paid).length) delete cup.prizesPaid[managedId];
  cup.invalidParticipationPrizeReversals[reversalKey] = { clubId:managedId, amount, season:Number(cup.season || state.seasonNumber || 1), repairedAt:Date.now() };
  state.budget = Math.round(Number(state.budget || 0) - amount);
  state.clubBudgets = (state.clubBudgets && typeof state.clubBudgets === 'object' && !Array.isArray(state.clubBudgets)) ? state.clubBudgets : {};
  state.clubBudgets[managedId] = state.budget;
  state.lastBudgetDelta = -amount;
  state.budgetHistory = Array.isArray(state.budgetHistory) ? state.budgetHistory : [];
  state.budgetHistory.push({
    season:Number(state.seasonNumber || cup.season || 1),
    matchdayIndex:Number(state.matchdayIndex || 0),
    date:state.currentDate || '',
    concept:'Corrección de premio de participación no clasificado',
    delta:-amount,
    budget:state.budget,
    type:'club_world_cup_prize_reversal',
    category:'Premios Mundial de Clubes'
  });
  state.messages = Array.isArray(state.messages) ? state.messages : [];
  const messageId = `club-world-cup-prize-reversal-${cup.season || state.seasonNumber || 1}-${managedId}`;
  if(!state.messages.some(message => String(message?.id || '') === messageId)){
    state.messages.unshift({
      id:messageId,
      turn:Number(state.matchdayIndex || 0),
      season:Number(state.seasonNumber || cup.season || 1),
      date:state.currentDate || '',
      read:false,
      priority:'normal',
      type:'finanzas',
      title:`Corrección ${CLUB_WORLD_CUP_CONFIG.name}`,
      body:`Se revirtió ${formatMoney(amount)} porque ${clubName(managedId)} no estaba clasificado al torneo.`,
      action:null,
      createdAt:Date.now()
    });
  }
  state._needsAutosave = true;
  return true;
}
function clubWorldCupStageRounds(stage){
  return (game?.fixtures || []).filter(round => round?.clubWorldCupRound && String(round.clubWorldCupStage || '') === String(stage || ''));
}
function clubWorldCupStageMatches(stage){
  return clubWorldCupStageRounds(stage).flatMap(round => round.matches || []).filter(match => match?.clubWorldCup);
}
function clubWorldCupStageComplete(stage){
  const matches = clubWorldCupStageMatches(stage);
  return matches.length > 0 && matches.every(match => match.played);
}
function clubWorldCupIsEditionYear(year=game?.seasonYear || currentSeasonYear()){
  const value = Math.round(Number(year || 0));
  const base = Math.round(Number(CLUB_WORLD_CUP_CONFIG.cycleBaseYear || 2025));
  const cycle = Math.max(1, Math.round(Number(CLUB_WORLD_CUP_CONFIG.cycleYears || 4)));
  return value >= base && ((value - base) % cycle === 0);
}
function clubWorldCupNextEditionYear(year=game?.seasonYear || currentSeasonYear(), includeCurrent=true){
  const value = Math.round(Number(year || 0));
  const base = Math.round(Number(CLUB_WORLD_CUP_CONFIG.cycleBaseYear || 2025));
  const cycle = Math.max(1, Math.round(Number(CLUB_WORLD_CUP_CONFIG.cycleYears || 4)));
  if(value <= base) return base;
  const offset = value - base;
  const remainder = offset % cycle;
  if(remainder === 0 && includeCurrent) return value;
  return value + (cycle - remainder);
}
function clubWorldCupRankingWindowYears(worldCupYear){
  const target = Math.round(Number(worldCupYear || clubWorldCupNextEditionYear()));
  const count = Math.max(1, Math.round(Number(CLUB_WORLD_CUP_CONFIG.rankingWindowEditions || 4)));
  return Array.from({ length:count }, (_, index) => target - count + 1 + index);
}
function clubWorldCupSelectedInvites(season=game?.seasonNumber || 1){
  ensureClubWorldCupInvitedData();
  const cfg = CLUB_WORLD_CUP_CONFIG;
  const activeInviteKeys = new Set(cfg.invitedTeams.map(team => clubWorldCupTeamKey(team.name)));
  return (seed.clubs || [])
    .filter(club => club.clubWorldCupInvite && activeInviteKeys.has(clubWorldCupTeamKey(club.name)))
    .sort((a,b)=>hashNumber(`cwc-invite-${season}-${a.name}`, 1000000) - hashNumber(`cwc-invite-${season}-${b.name}`, 1000000))
    .slice(0, cfg.invitedCount)
    .map(club => Number(club.id));
}
function clubWorldCupEditionMatches(edition={}){
  return [
    ...(Array.isArray(edition?.groups) ? edition.groups.flatMap(group => Array.isArray(group?.matches) ? group.matches : []) : []),
    ...Object.values(edition?.stages || {}).flatMap(matches => Array.isArray(matches) ? matches : [])
  ].filter(match => match && match.played);
}
function clubWorldCupStageParticipants(edition={}, stage=''){
  const matches = Array.isArray(edition?.stages?.[stage]) ? edition.stages[stage] : [];
  return new Set(matches.flatMap(match => [Number(match?.homeId || 0), Number(match?.awayId || 0)]).filter(Boolean));
}
function clubWorldCupPenaltyWinner(match={}){
  const direct = Number(match?.winnerClubId || match?.penaltyShootout?.winnerClubId || 0);
  if(direct && Number(match?.homeGoals || 0) === Number(match?.awayGoals || 0)) return direct;
  const homePens = Number(match?.penaltyShootout?.home || 0);
  const awayPens = Number(match?.penaltyShootout?.away || 0);
  if(homePens !== awayPens) return homePens > awayPens ? Number(match?.homeId || 0) : Number(match?.awayId || 0);
  return 0;
}
function clubWorldCupContinentalHistory(kind, worldCupYear){
  const years = new Set(clubWorldCupRankingWindowYears(worldCupYear));
  let editions = [];
  if(kind === 'champions' && typeof championsLeagueHistoryEntries === 'function') editions = championsLeagueHistoryEntries();
  if(kind === 'libertadores' && typeof libertadoresHistoryEntries === 'function') editions = libertadoresHistoryEntries();
  return (editions || []).filter(edition => years.has(Number(edition?.year || 0)) && Number(edition?.championId || 0) > 0)
    .sort((a,b)=>Number(a.year || 0)-Number(b.year || 0));
}
function clubWorldCupContinentalFallbackCandidates(kind){
  if(kind === 'champions' && typeof ensureChampionsTeamPoolData === 'function') ensureChampionsTeamPoolData();
  if(kind === 'libertadores' && typeof ensureLibertadoresTeamPoolData === 'function') ensureLibertadoresTeamPoolData();
  const countryKeys = new Set((kind === 'champions'
    ? ['Inglaterra','España','Italia','Rumania','Alemania','Francia','Portugal','Rusia','Países Bajos','Grecia','Bélgica','Escocia','Dinamarca','República Checa']
    : ['Argentina','Brasil','Chile','Paraguay','Perú','Colombia','Uruguay','Venezuela','Ecuador'])
    .map(normalizeScheduleText));
  return (seed?.clubs || [])
    .filter(club => countryKeys.has(normalizeScheduleText(club?.country || club?.pais || '')) && !club?.clubWorldCupInvite)
    .sort((a,b)=>clubPrestigeValue(b.id)-clubPrestigeValue(a.id) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' }))
    .map(club => Number(club.id || 0)).filter(Boolean);
}
function clubWorldCupContinentalRanking(kind, worldCupYear){
  const editions = clubWorldCupContinentalHistory(kind, worldCupYear);
  const targetYear = Math.round(Number(worldCupYear || 0));
  const pointsCfg = CLUB_WORLD_CUP_CONFIG.rankingPoints || {};
  const rows = new Map();
  const getRow = clubId => {
    const id = Number(clubId || 0);
    if(!id) return null;
    if(!rows.has(id)) rows.set(id, { clubId:id, points:0, wins:0, draws:0, shootoutWins:0, knockoutWins:0, currentYearWins:0, gf:0, gc:0, dg:0, latestYear:0, latestStage:0, titles:0, editionPoints:{} });
    return rows.get(id);
  };
  editions.forEach(edition => {
    const year = Number(edition?.year || 0);
    const participantIds = Array.isArray(edition?.participantClubIds) ? edition.participantClubIds.map(Number).filter(Boolean) : [];
    participantIds.forEach(id => { const row=getRow(id); if(row){ if(year > row.latestYear) row.latestStage=0; row.latestYear=Math.max(row.latestYear, year); } });
    const stageSets = {
      r16:clubWorldCupStageParticipants(edition, 'r16'),
      qf:clubWorldCupStageParticipants(edition, 'qf'),
      sf:clubWorldCupStageParticipants(edition, 'sf'),
      final:clubWorldCupStageParticipants(edition, 'final')
    };
    participantIds.forEach(id => {
      const row=getRow(id); if(!row) return;
      let stage=1;
      if(stageSets.r16.has(id)){ row.points += Number(pointsCfg.reachR16 || 0); stage=3; }
      if(stageSets.qf.has(id)){ row.points += Number(pointsCfg.reachQf || 0); stage=4; }
      if(stageSets.sf.has(id)){ row.points += Number(pointsCfg.reachSf || 0); stage=5; }
      if(stageSets.final.has(id)){ row.points += Number(pointsCfg.reachFinal || 0); stage=6; }
      if(Number(edition?.championId || 0) === id){ row.titles += 1; stage=7; }
      if(year >= row.latestYear) row.latestStage = Math.max(row.latestStage, stage);
    });
    clubWorldCupEditionMatches(edition).forEach(match => {
      const homeId=Number(match?.homeId || 0), awayId=Number(match?.awayId || 0);
      const home=getRow(homeId), away=getRow(awayId); if(!home || !away) return;
      const hg=Number(match?.homeGoals || 0), ag=Number(match?.awayGoals || 0);
      home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
      const knockout=String(match?.stage || match?.libertadoresStage || match?.championsLeagueStage || '') !== 'groups';
      if(hg > ag){ home.points += Number(pointsCfg.win || 3); home.wins += 1; if(knockout) home.knockoutWins += 1; if(year === targetYear) home.currentYearWins += 1; }
      else if(ag > hg){ away.points += Number(pointsCfg.win || 3); away.wins += 1; if(knockout) away.knockoutWins += 1; if(year === targetYear) away.currentYearWins += 1; }
      else {
        home.points += Number(pointsCfg.draw || 1); away.points += Number(pointsCfg.draw || 1); home.draws += 1; away.draws += 1;
        const shootoutWinner=clubWorldCupPenaltyWinner(match);
        if(shootoutWinner){ const winner=getRow(shootoutWinner); winner.points += Number(pointsCfg.shootoutWin || 1); winner.shootoutWins += 1; }
      }
    });
  });
  rows.forEach(row => { row.dg=row.gf-row.gc; });
  return Array.from(rows.values()).sort((a,b)=>
    b.points-a.points || b.wins-a.wins || b.currentYearWins-a.currentYearWins || b.knockoutWins-a.knockoutWins || b.dg-a.dg || b.gf-a.gf || b.latestStage-a.latestStage || b.latestYear-a.latestYear || clubPrestigeValue(b.clubId)-clubPrestigeValue(a.clubId) || clubName(a.clubId).localeCompare(clubName(b.clubId), 'es', { sensitivity:'base' })
  ).map((row,index)=>({ ...row, rank:index + 1 }));
}
function clubWorldCupContinentalQualifiers(kind, worldCupYear){
  const targetCount = kind === 'champions' ? Number(CLUB_WORLD_CUP_CONFIG.championsCount || 8) : Number(CLUB_WORLD_CUP_CONFIG.libertadoresCount || 8);
  const competitionLabel = kind === 'champions' ? 'Champions League' : 'Copa Libertadores';
  const editions = clubWorldCupContinentalHistory(kind, worldCupYear);
  const ranking = clubWorldCupContinentalRanking(kind, worldCupYear);
  const clubIds=[]; const sources=[]; const used=new Set();
  editions.slice().sort((a,b)=>Number(b.year || 0)-Number(a.year || 0)).forEach(edition => {
    const id=Number(edition?.championId || 0);
    if(!id || used.has(id) || clubIds.length >= targetCount) return;
    used.add(id); clubIds.push(id);
    const row=ranking.find(item => Number(item.clubId) === id);
    sources.push({ clubId:id, competition:kind, source:`Campeón de ${competitionLabel} ${Number(edition.year || 0)}`, confirmed:true, points:Number(row?.points || 0), rank:Number(row?.rank || 0), year:Number(edition.year || 0) });
  });
  ranking.forEach(row => {
    const id=Number(row.clubId || 0);
    if(!id || used.has(id) || clubIds.length >= targetCount) return;
    used.add(id); clubIds.push(id);
    sources.push({ clubId:id, competition:kind, source:`Ranking ${competitionLabel} · ${Number(row.rank || 0)}°`, confirmed:false, points:Number(row.points || 0), rank:Number(row.rank || 0), year:Number(worldCupYear || 0) });
  });
  clubWorldCupContinentalFallbackCandidates(kind).forEach(id => {
    const clubId=Number(id || 0);
    if(!clubId || used.has(clubId) || clubIds.length >= targetCount) return;
    used.add(clubId); clubIds.push(clubId);
    sources.push({ clubId, competition:kind, source:`Cupo de respaldo ${competitionLabel} por reputación`, confirmed:false, points:0, rank:0, year:Number(worldCupYear || 0) });
  });
  return { kind, clubIds:clubIds.slice(0,targetCount), sources:sources.slice(0,targetCount), ranking, editions, targetCount };
}
let clubWorldCupQualificationPreviewCache={ key:'', value:null };
function clubWorldCupQualificationPreviewCacheKey(year){
  const compact = key => (Array.isArray(game?.[key]?.editions) ? game[key].editions : []).map(edition => `${Number(edition?.year || 0)}:${Number(edition?.championId || 0)}:${Object.values(edition?.stages || {}).reduce((sum, matches) => sum + (Array.isArray(matches) ? matches.filter(match => match?.played).length : 0), 0)}`).join('|');
  return `${Number(year || 0)}::${compact('championsLeagueHistory')}::${compact('libertadoresHistory')}::${Number(game?.championsLeague?.championId || 0)}::${Number(game?.libertadores?.championId || 0)}`;
}
function clubWorldCupQualificationPreview(worldCupYear=clubWorldCupNextEditionYear()){
  const year=Math.round(Number(worldCupYear || clubWorldCupNextEditionYear()));
  const cacheKey=clubWorldCupQualificationPreviewCacheKey(year);
  if(clubWorldCupQualificationPreviewCache.key === cacheKey && clubWorldCupQualificationPreviewCache.value) return clubWorldCupQualificationPreviewCache.value;
  const champions=clubWorldCupContinentalQualifiers('champions', year);
  const libertadores=clubWorldCupContinentalQualifiers('libertadores', year);
  const invitedIds=clubWorldCupSelectedInvites(year);
  const value={
    year,
    windowYears:clubWorldCupRankingWindowYears(year),
    champions,
    libertadores,
    invitedIds,
    participantIds:[...champions.clubIds, ...libertadores.clubIds, ...invitedIds].map(Number).filter(Boolean),
    sources:[...champions.sources, ...libertadores.sources, ...invitedIds.map(id => ({ clubId:Number(id), competition:'invited', source:'Invitado internacional', confirmed:false, points:0, rank:0, year }))]
  };
  clubWorldCupQualificationPreviewCache={ key:cacheKey, value };
  return value;
}
function clubWorldCupQualificationInfoForClub(clubId){
  const id=Number(clubId || 0); if(!id) return null;
  const current=clubWorldCupState();
  if(current && clubWorldCupIsEditionYear(current.year) && (current.participantClubIds || []).map(Number).includes(id)){
    const source=(current.qualificationSources || []).find(item => Number(item?.clubId || 0) === id);
    return { clubId:id, year:Number(current.year || 0), qualified:true, provisional:false, source:String(source?.source || 'Clasificado al Mundial de Clubes') };
  }
  const targetYear=clubWorldCupNextEditionYear(Number(game?.seasonYear || currentSeasonYear()), true);
  const preview=clubWorldCupQualificationPreview(targetYear);
  const source=preview.sources.find(item => Number(item?.clubId || 0) === id && item.competition !== 'invited');
  if(!source) return null;
  return { clubId:id, year:targetYear, qualified:Boolean(source.confirmed), provisional:!source.confirmed, source:String(source.source || '') };
}
function clubWorldCupQualifiedClubIdsForDisplay(){
  const current=clubWorldCupState();
  if(current?.participantClubIds?.length) return new Set(current.participantClubIds.map(Number).filter(Boolean));
  const targetYear=clubWorldCupNextEditionYear(Number(game?.seasonYear || currentSeasonYear()), true);
  const preview=clubWorldCupQualificationPreview(targetYear);
  return new Set(preview.sources.filter(item => item.competition !== 'invited' && item.confirmed).map(item => Number(item.clubId)).filter(Boolean));
}
function clubWorldCupCountryForClub(clubId){
  const club = seed?.clubs?.find(item => Number(item.id) === Number(clubId));
  return normalizeScheduleText(club?.country || club?.pais || 'sin-pais');
}
function clubWorldCupShuffledSource(ids=[], season=game?.seasonNumber || 1, label='source'){
  return ids.map(Number).filter(Boolean).sort((a,b)=>hashNumber(`cwc-${label}-${season}-${a}`, 1000000)-hashNumber(`cwc-${label}-${season}-${b}`, 1000000));
}
function clubWorldCupGroupsForSources({ championsIds=[], libertadoresIds=[], invitedIds=[] }={}, season=game?.seasonNumber || 1){
  const labels=['A','B','C','D','E','F','G','H'];
  const groups=labels.map(label => ({ id:label, name:`Grupo ${label}`, clubIds:[], sourceClubIds:{ champions:[], libertadores:[], invited:[] } }));
  const placeOnePerGroup=(ids, source) => clubWorldCupShuffledSource(ids, season, source).slice(0,groups.length).forEach((id,index) => {
    groups[index].clubIds.push(id); groups[index].sourceClubIds[source].push(id);
  });
  placeOnePerGroup(championsIds, 'champions');
  placeOnePerGroup(libertadoresIds, 'libertadores');
  const invites=clubWorldCupShuffledSource(invitedIds, season, 'invited');
  invites.forEach((id, inviteIndex) => {
    const candidates=groups.filter(group => group.sourceClubIds.invited.length < 2);
    candidates.sort((a,b) => {
      const country=clubWorldCupCountryForClub(id);
      const aSame=a.clubIds.some(clubId => clubWorldCupCountryForClub(clubId) === country) ? 1 : 0;
      const bSame=b.clubIds.some(clubId => clubWorldCupCountryForClub(clubId) === country) ? 1 : 0;
      return aSame-bSame || a.sourceClubIds.invited.length-b.sourceClubIds.invited.length || hashNumber(`cwc-invite-group-${season}-${id}-${a.id}-${inviteIndex}`,1000000)-hashNumber(`cwc-invite-group-${season}-${id}-${b.id}-${inviteIndex}`,1000000);
    });
    if(candidates[0]){ candidates[0].clubIds.push(id); candidates[0].sourceClubIds.invited.push(id); }
  });
  return groups;
}
function clubWorldCupFixtureMatch({ season, stage, roundNumber, homeId, awayId, date='', seasonDay=0, groupId='', matchIndex=0, bracketKey='', bracketSlot='' }){
  const stadium = CLUB_WORLD_CUP_CONFIG.stadiums[Math.abs(matchIndex) % CLUB_WORLD_CUP_CONFIG.stadiums.length];
  const fixedSeasonDay = Math.max(0, Math.round(Number(seasonDay || clubWorldCupStageSeasonDay(stage, roundNumber) || 0)));
  const year = Number(game?.clubWorldCup?.year || (Number(season || 0) === Number(game?.seasonNumber || 0) ? game?.seasonYear : 0) || seasonYearForNumber(season));
  const fixedDate = validIsoDate(date) ? date : (fixedSeasonDay > 0 ? clubWorldCupIsoForSeasonDay(fixedSeasonDay, year) : '');
  return {
    id:`cwc-s${season}-${stage}-${groupId || 'ko'}-r${roundNumber}-${homeId}-${awayId}-${matchIndex}`,
    matchday:Number(game?.fixtures?.length || 0) + 1,
    divisionId:CLUB_WORLD_CUP_CONFIG.divisionId,
    divisionName:CLUB_WORLD_CUP_CONFIG.name,
    homeId:Number(homeId),
    awayId:Number(awayId),
    played:false,
    date:fixedDate,
    roundDate:fixedDate,
    seasonDay:fixedSeasonDay,
    neutral:true,
    neutralVenue:true,
    knockout:true,
    requiresWinner:stage !== 'groups',
    tieBreakMode:stage !== 'groups' ? 'penalties' : 'draw',
    clubWorldCup:true,
    clubWorldCupStage:stage,
    clubWorldCupGroup:groupId,
    clubWorldCupRound:Number(roundNumber || 0),
    clubWorldCupKnockout:stage !== 'groups',
    clubWorldCupBracketKey:bracketKey || '',
    clubWorldCupBracketSlot:bracketSlot || '',
    stadiumName:stadium.name,
    stadiumCapacity:stadium.capacity
  };
}
function appendClubWorldCupRound(stage, title, date, matches, seasonDay=0){
  if(!game?.fixtures || !Array.isArray(matches) || !matches.length) return false;
  const matchday = game.fixtures.length + 1;
  const fixedSeasonDay = Math.max(0, Math.round(Number(seasonDay || matches[0]?.seasonDay || clubWorldCupStageSeasonDay(stage, matches[0]?.clubWorldCupRound || 1) || 0)));
  const normalized = matches.map((match, index) => ({ ...match, matchday, date:match.date || date, roundDate:match.date || date, seasonDay:Math.max(0, Math.round(Number(match.seasonDay || fixedSeasonDay))), matchIndex:index }));
  game.fixtures.push({
    matchday,
    date,
    startDate:date,
    endDate:date,
    roundDate:date,
    seasonDay:fixedSeasonDay,
    title,
    clubWorldCupRound:true,
    clubWorldCupStage:stage,
    matches:normalized
  });
  return true;
}
function createClubWorldCupGroupFixtures(){
  const state = clubWorldCupState();
  if(!state?.groups?.length) return false;
  const season = Number(state.season || game?.seasonNumber || 1);
  const year = Number(state.year || game?.seasonYear || seasonYearForNumber(season));
  const seasonDays = clubWorldCupGroupSeasonDays();
  const dates = clubWorldCupGroupDatesFromFirstDate('', year);
  state.firstGroupDate = dates[0];
  state.groupDates = dates.slice();
  state.groupSeasonDays = seasonDays.slice();
  const pairings = [ [[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]] ];
  pairings.forEach((roundPairings, roundIndex) => {
    const matches = [];
    state.groups.forEach((group, groupIndex) => {
      roundPairings.forEach(pair => {
        const homeId = group.clubIds[pair[0]];
        const awayId = group.clubIds[pair[1]];
        if(!homeId || !awayId) return;
        matches.push(clubWorldCupFixtureMatch({ season, stage:'groups', roundNumber:roundIndex + 1, groupId:group.id, homeId, awayId, date:dates[roundIndex], seasonDay:seasonDays[roundIndex], matchIndex:(roundIndex * 20) + (groupIndex * 2) + matches.length }));
      });
    });
    appendClubWorldCupRound('groups', `${CLUB_WORLD_CUP_CONFIG.name} · Grupos ${roundIndex + 1}/3`, dates[roundIndex], matches, seasonDays[roundIndex]);
  });
  return true;
}
function clubWorldCupScheduleSeasonDays(){
  const raw = CLUB_WORLD_CUP_CONFIG?.scheduleSeasonDays || {};
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  return {
    draw:clamp(Math.round(Number(raw.draw || 295)), 1, 365),
    groups:[
      clamp(Math.round(Number(groups[0] || 305)), 1, 365),
      clamp(Math.round(Number(groups[1] || 310)), 1, 365),
      clamp(Math.round(Number(groups[2] || 315)), 1, 365)
    ],
    r16:clamp(Math.round(Number(raw.r16 || 320)), 1, 365),
    qf:clamp(Math.round(Number(raw.qf || 325)), 1, 365),
    sf:clamp(Math.round(Number(raw.sf || 330)), 1, 365),
    thirdPlace:clamp(Math.round(Number(raw.thirdPlace || 335)), 1, 365),
    final:clamp(Math.round(Number(raw.final || 336)), 1, 365)
  };
}
function clubWorldCupFixtureReadySeasonDay(){
  return clubWorldCupScheduleSeasonDays().draw;
}
function clubWorldCupIsoForSeasonDay(day, year=currentSeasonYear()){
  const safeDay = clamp(Math.round(Number(day || 1)), 1, daysInSeasonYear(year));
  return addDaysToIsoDate(seasonStartDateForYear(year), safeDay - 1);
}
function clubWorldCupCurrentSeasonDay(){
  if(typeof currentSeasonDayNumber === 'function') return Number(currentSeasonDayNumber() || 0);
  const iso = currentCalendarDate?.() || game?.currentDate || dateForSeasonState(game);
  return Number(seasonDayFromDate(iso, currentSeasonYear()) || 0);
}
function clubWorldCupDrawDate(year=currentSeasonYear()){
  return clubWorldCupIsoForSeasonDay(clubWorldCupFixtureReadySeasonDay(), year);
}
function clubWorldCupGroupSeasonDays(){
  return clubWorldCupScheduleSeasonDays().groups.slice();
}
function clubWorldCupGroupDatesFromFirstDate(_firstDate, year=currentSeasonYear()){
  return clubWorldCupGroupSeasonDays().map(day => clubWorldCupIsoForSeasonDay(day, year));
}
function clubWorldCupStageSeasonDay(stage, roundNumber=1){
  const schedule = clubWorldCupScheduleSeasonDays();
  const cleanStage = String(stage || '');
  if(cleanStage === 'groups') return schedule.groups[clamp(Math.round(Number(roundNumber || 1)), 1, 3) - 1];
  return Number(schedule[cleanStage] || 0);
}
function clubWorldCupStageDate(stage, roundNumber=1, year=currentSeasonYear()){
  const day = clubWorldCupStageSeasonDay(stage, roundNumber);
  return day > 0 ? clubWorldCupIsoForSeasonDay(day, year) : '';
}
function clubWorldCupRoundNumberFromRound(round, fallback=1){
  const nums = (round?.matches || []).map(match => Number(match?.clubWorldCupRound || 0)).filter(n => n > 0);
  if(nums.length) return Math.min(...nums);
  return Number(fallback || 1);
}
function repairClubWorldCupFixtureSchedule(options={}){
  if(!game?.fixtures || !clubWorldCupState?.()) return false;
  const state = clubWorldCupState();
  const season = Number(state.season || game?.seasonNumber || 1);
  const year = Number(state.year || game?.seasonYear || seasonYearForNumber(season));
  const schedule = clubWorldCupScheduleSeasonDays();
  let changed = false;
  const rounds = (game.fixtures || []).filter(round => round?.clubWorldCupRound || (round?.matches || []).some(match => match?.clubWorldCup));
  rounds.forEach(round => {
    const sample = (round.matches || []).find(match => match?.clubWorldCup) || null;
    const stage = String(round.clubWorldCupStage || sample?.clubWorldCupStage || '');
    const roundNumber = clubWorldCupRoundNumberFromRound(round, 1);
    const seasonDay = clubWorldCupStageSeasonDay(stage, roundNumber);
    if(seasonDay <= 0) return;
    const date = clubWorldCupIsoForSeasonDay(seasonDay, year);
    const roundNeedsChange = Number(round.seasonDay || 0) !== seasonDay
      || round.date !== date || round.startDate !== date || round.endDate !== date || round.roundDate !== date;
    if(roundNeedsChange) changed = true;
    round.seasonDay = seasonDay;
    round.date = date;
    round.startDate = date;
    round.endDate = date;
    round.roundDate = date;
    round.clubWorldCupStage = stage;
    (round.matches || []).forEach(match => {
      if(!match?.clubWorldCup) return;
      const matchRound = Math.max(1, Math.round(Number(match.clubWorldCupRound || roundNumber || 1)));
      const matchSeasonDay = clubWorldCupStageSeasonDay(String(match.clubWorldCupStage || stage), matchRound) || seasonDay;
      const matchDate = clubWorldCupIsoForSeasonDay(matchSeasonDay, year);
      if(Number(match.seasonDay || 0) !== matchSeasonDay || match.date !== matchDate || match.roundDate !== matchDate) changed = true;
      match.seasonDay = matchSeasonDay;
      match.date = matchDate;
      match.roundDate = matchDate;
      match.clubWorldCupRound = matchRound;
      const history = (game.matchHistory || []).find(item => item?.id === match.id);
      if(history){
        history.seasonDay = matchSeasonDay;
        history.date = matchDate;
        history.roundDate = matchDate;
      }
    });
  });
  const groupDates = schedule.groups.map(day => clubWorldCupIsoForSeasonDay(day, year));
  const stateSchedule = {
    draw:schedule.draw,
    groups:schedule.groups.slice(),
    r16:schedule.r16,
    qf:schedule.qf,
    sf:schedule.sf,
    thirdPlace:schedule.thirdPlace,
    final:schedule.final
  };
  if(Number(state.year || 0) !== year) changed = true;
  if(Number(state.drawSeasonDay || 0) !== schedule.draw) changed = true;
  if(JSON.stringify(state.groupSeasonDays || []) !== JSON.stringify(schedule.groups)) changed = true;
  if(JSON.stringify(state.stageSeasonDays || {}) !== JSON.stringify({ r16:schedule.r16, qf:schedule.qf, sf:schedule.sf, thirdPlace:schedule.thirdPlace, final:schedule.final })) changed = true;
  if(state.drawDate !== clubWorldCupIsoForSeasonDay(schedule.draw, year)) changed = true;
  if(JSON.stringify(state.groupDates || []) !== JSON.stringify(groupDates)) changed = true;
  state.year = year;
  state.drawSeasonDay = schedule.draw;
  state.groupSeasonDays = schedule.groups.slice();
  state.stageSeasonDays = { r16:schedule.r16, qf:schedule.qf, sf:schedule.sf, thirdPlace:schedule.thirdPlace, final:schedule.final };
  state.scheduleSeasonDays = stateSchedule;
  state.drawDate = clubWorldCupIsoForSeasonDay(schedule.draw, year);
  state.firstGroupDate = groupDates[0];
  state.groupDates = groupDates;
  state.fixtureReadySeasonDay = schedule.draw;
  if(changed || options.force){
    state.fixtureDatesRepairedAt = Date.now();
    state.fixtureScheduleMode = 'season-day-fixed';
  }
  return Boolean(changed || options.force);
}
function repairClubWorldCupGroupFixtureDates(options={}){
  return repairClubWorldCupFixtureSchedule(options);
}
function clubWorldCupCanCreateFixtureNow(){
  if(!game || !clubWorldCupIsEditionYear(Number(game.seasonYear || currentSeasonYear()))) return false;
  return clubWorldCupCurrentSeasonDay() >= clubWorldCupFixtureReadySeasonDay();
}
function clubWorldCupStateStructureInfo(state, season=game?.seasonNumber || 1){
  const participantIds = clubWorldCupParticipantIds(state);
  const groups = Array.isArray(state?.groups) ? state.groups : [];
  const groupClubIds = groups.flatMap(group => Array.isArray(group?.clubIds) ? group.clubIds.map(Number).filter(Boolean) : []);
  const completedLegacy = String(state?.status || '') === 'completed' && Number(state?.championId || 0) > 0;
  const validGroups = groups.length === Number(CLUB_WORLD_CUP_CONFIG.groupCount || 8)
    && groups.every(group => Array.isArray(group?.clubIds) && group.clubIds.map(Number).filter(Boolean).length === Number(CLUB_WORLD_CUP_CONFIG.groupSize || 4));
  const uniqueGroupIds = new Set(groupClubIds);
  const championsIds=new Set((state?.championsLeagueClubIds || []).map(Number).filter(Boolean));
  const libertadoresIds=new Set((state?.libertadoresClubIds || []).map(Number).filter(Boolean));
  const invitedIds=new Set((state?.invitedClubIds || []).map(Number).filter(Boolean));
  const sourceShapeValid = state?.sourceVersion && String(state.sourceVersion).localeCompare('V9.57', undefined, { numeric:true }) >= 0
    ? championsIds.size === 8 && libertadoresIds.size === 8 && invitedIds.size === 16 && groups.every(group => {
        const ids=(group?.clubIds || []).map(Number).filter(Boolean);
        return ids.filter(id => championsIds.has(id)).length === 1 && ids.filter(id => libertadoresIds.has(id)).length === 1 && ids.filter(id => invitedIds.has(id)).length === 2;
      })
    : true;
  const validParticipants = participantIds.length === Number(CLUB_WORLD_CUP_CONFIG.groupCount || 8) * Number(CLUB_WORLD_CUP_CONFIG.groupSize || 4)
    && uniqueGroupIds.size === participantIds.length
    && participantIds.every(id => uniqueGroupIds.has(Number(id)))
    && sourceShapeValid;
  return {
    sameSeason:Number(state?.season || 0) === Number(season || 1),
    completedLegacy,
    validGroups,
    validParticipants,
    usable:completedLegacy || (validGroups && validParticipants),
    participantCount:participantIds.length,
    groupCount:groups.length
  };
}
function removeBrokenClubWorldCupFixtures(){
  if(!Array.isArray(game?.fixtures)) return 0;
  const before = game.fixtures.length;
  game.fixtures = game.fixtures.filter(round => !round?.clubWorldCupRound && !(round?.matches || []).some(match => match?.clubWorldCup));
  if(Array.isArray(game.matchHistory)) game.matchHistory = game.matchHistory.filter(match => !match?.clubWorldCup);
  return before - game.fixtures.length;
}
function resetBrokenClubWorldCupState(reason='estructura incompleta'){
  if(!game?.clubWorldCup) return false;
  game.clubWorldCupGenerationRecoveries = Array.isArray(game.clubWorldCupGenerationRecoveries) ? game.clubWorldCupGenerationRecoveries.slice(-9) : [];
  game.clubWorldCupGenerationRecoveries.push({
    season:Number(game.seasonNumber || 1),
    day:typeof clubWorldCupCurrentSeasonDay === 'function' ? Number(clubWorldCupCurrentSeasonDay() || 0) : 0,
    reason:String(reason || 'estructura incompleta'),
    removedRounds:removeBrokenClubWorldCupFixtures(),
    repairedAt:Date.now()
  });
  game.clubWorldCup = null;
  return true;
}
function ensureClubWorldCupCurrentSeason(options={}){
  const result = { changed:false, created:false, repaired:false, reason:'' };
  if(!game || !CLUB_WORLD_CUP_CONFIG.enabled || !Array.isArray(game.fixtures)) return result;
  if(typeof managerChallengeIs === 'function' && managerChallengeIs()) return result;
  const season = Number(game.seasonNumber || 1);
  const year = Number(game.seasonYear || currentSeasonYear());
  let raw = game.clubWorldCup;
  if(raw && Number(raw.season || 0) === season && clubWorldCupIsEditionYear(year) && String(raw.sourceVersion || '') !== 'V9.57'){
    const legacyMatches=(game.fixtures || []).flatMap(round => round?.matches || []).filter(match => match?.clubWorldCup);
    if(!legacyMatches.some(match => match?.played)){
      resetBrokenClubWorldCupState('edición anterior al sistema 8+8+16');
      result.changed=true; result.repaired=true; result.reason='sorteo reconstruido con cupos de Champions y Libertadores';
      raw=null;
    }
  }
  if(!clubWorldCupIsEditionYear(year)){
    if(raw && Number(raw.season || 0) === season){
      const existingCupMatches=(game.fixtures || []).flatMap(round => round?.matches || []).filter(match => match?.clubWorldCup);
      if(!existingCupMatches.some(match => match?.played)){
        resetBrokenClubWorldCupState('año sin Mundial de Clubes');
        result.changed=true; result.repaired=true; result.reason='edición anual anterior retirada por el nuevo ciclo de cuatro años';
      }
    }
    return result;
  }
  if(!clubWorldCupCanCreateFixtureNow()) return result;
  if(raw){
    const info = clubWorldCupStateStructureInfo(raw, season);
    if(!info.sameSeason){
      resetBrokenClubWorldCupState('edición perteneciente a otra temporada');
      result.changed = true;
      result.repaired = true;
    }else if(!info.usable){
      const existingCupMatches = (game.fixtures || []).flatMap(round => round?.matches || []).filter(match => match?.clubWorldCup);
      if(existingCupMatches.some(match => match?.played)){
        result.reason = `estado incompleto con ${existingCupMatches.filter(match => match?.played).length} partido(s) ya jugado(s); no se reinició automáticamente`;
        return result;
      }
      resetBrokenClubWorldCupState(`estado incompleto: ${info.participantCount} participantes y ${info.groupCount} grupos`);
      result.changed = true;
      result.repaired = true;
    }else if(!info.completedLegacy && String(raw.status || '') === 'groups' && clubWorldCupStageMatches('groups').length === 0){
      const createdFixtures = createClubWorldCupGroupFixtures();
      if(createdFixtures){
        repairClubWorldCupGroupFixtureDates({ force:true });
        result.changed = true;
        result.repaired = true;
        result.reason = 'fixture de grupos reconstruido';
      }
      if(typeof prepareClubWorldCupParticipantsIfNeeded === 'function'){
        const prep = prepareClubWorldCupParticipantsIfNeeded({ source:options.source || 'ensure_rebuilt_fixture' });
        if(prep.changed) result.changed = true;
      }
      return result;
    }else{
      if(repairClubWorldCupFixtureSchedule()){
        result.changed = true;
        result.repaired = true;
        result.reason = 'calendario realineado por día de temporada';
      }
      if(typeof prepareClubWorldCupParticipantsIfNeeded === 'function'){
        const prep = prepareClubWorldCupParticipantsIfNeeded({ source:options.source || 'ensure_existing' });
        if(prep.changed) result.changed = true;
      }
      return result;
    }
  }
  const created = createClubWorldCupIfNeeded({ skipEnsure:true });
  result.created = Boolean(created);
  result.changed = result.changed || result.created;
  if(result.created) result.reason = 'edición generada';
  if(typeof prepareClubWorldCupParticipantsIfNeeded === 'function'){
    const prep = prepareClubWorldCupParticipantsIfNeeded({ source:options.source || 'ensure_created' });
    if(prep.changed) result.changed = true;
  }
  return result;
}
function createClubWorldCupIfNeeded(options={}){
  if(!game || !CLUB_WORLD_CUP_CONFIG.enabled || !Array.isArray(game.fixtures)) return false;
  if(typeof managerChallengeIs === 'function' && managerChallengeIs()) return false;
  const season = Number(game.seasonNumber || 1);
  if(!clubWorldCupCanCreateFixtureNow()) return false;
  if(!options.skipEnsure){
    const raw = game.clubWorldCup;
    if(raw){
      const info = clubWorldCupStateStructureInfo(raw, season);
      if(info.sameSeason && info.usable) return false;
      resetBrokenClubWorldCupState(info.sameSeason ? 'estado inválido al intentar el sorteo' : 'edición de otra temporada');
    }
  }
  ensureClubWorldCupInvitedData();
  if(!clubWorldCupIsEditionYear(Number(game.seasonYear || currentSeasonYear()))) return false;
  const preview = clubWorldCupQualificationPreview(Number(game.seasonYear || currentSeasonYear()));
  const championsIds = preview.champions.clubIds.slice(0, Number(CLUB_WORLD_CUP_CONFIG.championsCount || 8));
  const libertadoresIds = preview.libertadores.clubIds.slice(0, Number(CLUB_WORLD_CUP_CONFIG.libertadoresCount || 8));
  const invitedIds = preview.invitedIds.slice(0, Number(CLUB_WORLD_CUP_CONFIG.invitedCount || 16));
  const participantIds = [...championsIds, ...libertadoresIds, ...invitedIds].map(Number).filter(Boolean);
  if(championsIds.length !== 8 || libertadoresIds.length !== 8 || invitedIds.length !== 16 || new Set(participantIds).size !== 32){
    game.clubWorldCupGenerationIssue = {
      season,
      day:typeof clubWorldCupCurrentSeasonDay === 'function' ? Number(clubWorldCupCurrentSeasonDay() || 0) : 0,
      reason:`No se pudieron reunir los cupos exactos: Champions ${championsIds.length}/8, Libertadores ${libertadoresIds.length}/8, invitados ${invitedIds.length}/16.`,
      championsCount:championsIds.length,
      libertadoresCount:libertadoresIds.length,
      invitedCount:invitedIds.length,
      checkedAt:Date.now()
    };
    return false;
  }
  const groups = clubWorldCupGroupsForSources({ championsIds, libertadoresIds, invitedIds }, season);
  const groupCount = groups.length;
  const completeGroups = groups.filter(group => Array.isArray(group?.clubIds) && group.clubIds.length === CLUB_WORLD_CUP_CONFIG.groupSize).length;
  if(groupCount !== CLUB_WORLD_CUP_CONFIG.groupCount || completeGroups !== CLUB_WORLD_CUP_CONFIG.groupCount){
    game.clubWorldCupGenerationIssue = {
      season,
      day:typeof clubWorldCupCurrentSeasonDay === 'function' ? Number(clubWorldCupCurrentSeasonDay() || 0) : 0,
      reason:`El sorteo produjo ${completeGroups}/${CLUB_WORLD_CUP_CONFIG.groupCount} grupos completos.`,
      checkedAt:Date.now()
    };
    return false;
  }
  const year = currentSeasonYear();
  const schedule = clubWorldCupScheduleSeasonDays();
  const groupDates = clubWorldCupGroupDatesFromFirstDate('', year);
  const firstGroupDate = groupDates[0];
  game.clubWorldCup = {
    season,
    year,
    name:CLUB_WORLD_CUP_CONFIG.name,
    sourceVersion:'V9.57',
    status:'groups',
    created:true,
    participantClubIds:participantIds,
    championsLeagueClubIds:championsIds,
    libertadoresClubIds:libertadoresIds,
    invitedClubIds:invitedIds,
    qualificationWindowYears:preview.windowYears,
    qualificationSources:preview.sources.map(item => ({ ...item, confirmed:true })),
    continentalRankings:{ champions:preview.champions.ranking, libertadores:preview.libertadores.ranking },
    groups,
    prizesPaid:{},
    championId:0,
    runnerUpId:0,
    createdAt:Date.now(),
    fixtureCreatedDate:currentCalendarDate?.() || game.currentDate || '',
    fixtureScheduleMode:'season-day-fixed',
    drawSeasonDay:schedule.draw,
    groupSeasonDays:schedule.groups.slice(),
    stageSeasonDays:{ r16:schedule.r16, qf:schedule.qf, sf:schedule.sf, thirdPlace:schedule.thirdPlace, final:schedule.final },
    scheduleSeasonDays:{ ...schedule, groups:schedule.groups.slice() },
    drawDate:clubWorldCupDrawDate(year),
    firstGroupDate,
    groupDates,
    fixtureReadySeasonDay:schedule.draw
  };
  delete game.clubWorldCupGenerationIssue;
  createClubWorldCupGroupFixtures();
  repairClubWorldCupFixtureSchedule({ force:true });
  if(clubWorldCupClubParticipates(game.selectedClubId, game.clubWorldCup)) awardClubWorldCupPrizeIfManaged(game.selectedClubId, 'participate');
  const activeInviteKeys = new Set(CLUB_WORLD_CUP_CONFIG.invitedTeams.map(team => clubWorldCupTeamKey(team.name)));
  const omittedInviteIds = (seed.clubs || [])
    .filter(club => club?.clubWorldCupInvite && activeInviteKeys.has(clubWorldCupTeamKey(club.name)) && !invitedIds.includes(Number(club.id)))
    .map(club => Number(club.id));
  pushGameMessage({
    type:'deportivo',
    priority:'high',
    title:CLUB_WORLD_CUP_CONFIG.name,
    body:`Se sortearon 8 grupos de 4 equipos. Cada grupo tiene un club de Champions League, uno de Copa Libertadores y dos invitados. Ventana clasificatoria: ${preview.windowYears.join(', ')}. Calendario fijo: día ${schedule.groups[0]}, día ${schedule.groups[1]} y día ${schedule.groups[2]}. Invitados seleccionados: ${invitedIds.map(clubName).join(', ')}. Quedaron fuera de esta edición: ${omittedInviteIds.map(clubName).join(', ') || 'ninguno'}.`,
    id:`club-world-cup-${season}-created`
  });
  return true;
}
function clubWorldCupGroupStandings(groupId){
  const state = clubWorldCupState();
  const group = state?.groups?.find(item => String(item.id) === String(groupId));
  if(!group) return [];
  const rows = Object.fromEntries(group.clubIds.map(id => [Number(id), { clubId:Number(id), pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 }]));
  clubWorldCupStageMatches('groups').filter(match => String(match.clubWorldCupGroup) === String(groupId) && match.played).forEach(match => {
    const h = rows[Number(match.homeId)];
    const a = rows[Number(match.awayId)];
    if(!h || !a) return;
    const hg = Number(match.homeGoals || 0);
    const ag = Number(match.awayGoals || 0);
    h.pj++; a.pj++;
    h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
    if(hg > ag){ h.pg++; a.pp++; h.pts += 3; }
    else if(hg < ag){ a.pg++; h.pp++; a.pts += 3; }
    else { h.pe++; a.pe++; h.pts += 1; a.pts += 1; }
    h.dg = h.gf - h.gc; a.dg = a.gf - a.gc;
  });
  return Object.values(rows).sort((a,b)=>b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || clubPrestigeValue(b.clubId)-clubPrestigeValue(a.clubId) || clubName(a.clubId).localeCompare(clubName(b.clubId), 'es', { sensitivity:'base' }));
}
function clubWorldCupQualifiedFromGroups(){
  const state = clubWorldCupState();
  if(!state?.groups?.length) return [];
  return state.groups.flatMap(group => clubWorldCupGroupStandings(group.id).slice(0,2).map(row => Number(row.clubId))).filter(Boolean);
}
function clubWorldCupKnockoutWinner(match){
  if(!match?.played) return 0;
  if(Number(match.winnerClubId || 0)) return Number(match.winnerClubId);
  const hg = Number(match.homeGoals || 0);
  const ag = Number(match.awayGoals || 0);
  if(hg > ag) return Number(match.homeId || 0);
  if(ag > hg) return Number(match.awayId || 0);
  const pens = match.penaltyShootout || {};
  if(Number(pens.home || 0) > Number(pens.away || 0)) return Number(match.homeId || 0);
  if(Number(pens.away || 0) > Number(pens.home || 0)) return Number(match.awayId || 0);
  return Number(match.homeId || 0);
}
function createClubWorldCupKnockoutStage(stage, participants){
  const state = clubWorldCupState();
  if(!state || !Array.isArray(participants) || participants.length < 2) return false;
  const season = Number(state.season || game?.seasonNumber || 1);
  const year = Number(state.year || game?.seasonYear || seasonYearForNumber(season));
  const stageTitles = { r16:'Octavos de final', qf:'Cuartos de final', sf:'Semifinales', final:'Final', thirdPlace:'Partido por el 3er puesto' };
  const seasonDay = clubWorldCupStageSeasonDay(stage, 1);
  const date = clubWorldCupIsoForSeasonDay(seasonDay, year);
  const matches = [];
  for(let i=0;i<participants.length;i+=2){
    const homeId = Number(participants[i]);
    const awayId = Number(participants[i+1]);
    if(!homeId || !awayId) continue;
    const matchNumber = Math.floor(i / 2);
    let bracketKey = '';
    let bracketSlot = '';
    if(stage === 'r16'){
      bracketKey = `Llave ${Math.floor(matchNumber / 2) + 1}`;
      bracketSlot = matchNumber % 2 === 0 ? '1° grupo impar vs 2° grupo siguiente' : '2° grupo impar vs 1° grupo siguiente';
    }else if(stage === 'qf'){
      bracketKey = `Llave ${matchNumber + 1}`;
      bracketSlot = 'Ganadores de octavos';
    }else if(stage === 'sf'){
      bracketKey = `Semifinal ${matchNumber + 1}`;
      bracketSlot = matchNumber === 0 ? 'Ganador Llave 1 vs Ganador Llave 2' : 'Ganador Llave 3 vs Ganador Llave 4';
    }
    matches.push(clubWorldCupFixtureMatch({ season, stage, roundNumber:1, homeId, awayId, date, seasonDay, matchIndex:i, bracketKey, bracketSlot }));
  }
  const title = `${CLUB_WORLD_CUP_CONFIG.name} · ${stageTitles[stage] || stage}`;
  const created = appendClubWorldCupRound(stage, title, date, matches, seasonDay);
  if(created){
    state.status = stage;
    state[`${stage}ClubIds`] = participants.map(Number).filter(Boolean);
    repairClubWorldCupFixtureSchedule();
    pushGameMessage({ type:'deportivo', priority:'normal', inbox:clubWorldCupClubParticipates(game.selectedClubId, state) ? 'always' : 'never', title, body:`Ya están definidos los cruces de ${stageTitles[stage] || stage}. Se jugarán el día ${seasonDay}.`, id:`club-world-cup-${season}-${stage}` });
  }
  return created;
}
function clubWorldCupWinnersFromStage(stage){
  return clubWorldCupStageMatches(stage).filter(match => match.played).map(clubWorldCupKnockoutWinner).filter(Boolean);
}
function clubWorldCupLosersFromStage(stage){
  return clubWorldCupStageMatches(stage).filter(match => match.played).map(match => {
    const winner = clubWorldCupKnockoutWinner(match);
    const homeId = Number(match.homeId || 0);
    const awayId = Number(match.awayId || 0);
    if(!winner || !homeId || !awayId) return 0;
    return winner === homeId ? awayId : homeId;
  }).filter(Boolean);
}
function createClubWorldCupFinalStages(finalists=[], thirdPlaceClubs=[]){
  const state = clubWorldCupState();
  if(!state || !Array.isArray(finalists) || finalists.length < 2 || !Array.isArray(thirdPlaceClubs) || thirdPlaceClubs.length < 2) return false;
  const season = Number(state.season || game?.seasonNumber || 1);
  const year = Number(state.year || game?.seasonYear || seasonYearForNumber(season));
  const thirdPlaceSeasonDay = clubWorldCupStageSeasonDay('thirdPlace', 1);
  const finalSeasonDay = clubWorldCupStageSeasonDay('final', 1);
  const thirdPlaceDate = clubWorldCupIsoForSeasonDay(thirdPlaceSeasonDay, year);
  const finalDate = clubWorldCupIsoForSeasonDay(finalSeasonDay, year);
  const thirdMatches = [clubWorldCupFixtureMatch({ season, stage:'thirdPlace', roundNumber:1, homeId:Number(thirdPlaceClubs[0]), awayId:Number(thirdPlaceClubs[1]), date:thirdPlaceDate, seasonDay:thirdPlaceSeasonDay, matchIndex:0 })];
  const finalMatches = [clubWorldCupFixtureMatch({ season, stage:'final', roundNumber:1, homeId:Number(finalists[0]), awayId:Number(finalists[1]), date:finalDate, seasonDay:finalSeasonDay, matchIndex:1 })];
  const thirdCreated = appendClubWorldCupRound('thirdPlace', `${CLUB_WORLD_CUP_CONFIG.name} · Partido por el 3er puesto`, thirdPlaceDate, thirdMatches, thirdPlaceSeasonDay);
  const finalCreated = appendClubWorldCupRound('final', `${CLUB_WORLD_CUP_CONFIG.name} · Final`, finalDate, finalMatches, finalSeasonDay);
  if(thirdCreated && finalCreated){
    state.status = 'final';
    state.finalClubIds = finalists.map(Number).filter(Boolean);
    state.thirdPlaceClubIds = thirdPlaceClubs.map(Number).filter(Boolean);
    repairClubWorldCupFixtureSchedule();
    pushGameMessage({ type:'deportivo', priority:'normal', inbox:clubWorldCupClubParticipates(game.selectedClubId, state) ? 'always' : 'never', title:`${CLUB_WORLD_CUP_CONFIG.name} · Final`, body:`El tercer puesto se jugará el día ${thirdPlaceSeasonDay} y la final el día ${finalSeasonDay}.`, id:`club-world-cup-${season}-final` });
    return true;
  }
  return false;
}
function awardClubWorldCupPrizeIfManaged(clubId, stage){
  if(!game || !stage) return false;
  const managedId = Number(game.selectedClubId || 0);
  const cleanClubId = Number(clubId || 0);
  if(!managedId || cleanClubId !== managedId) return false;
  const state = clubWorldCupState();
  if(!state || !clubWorldCupClubParticipates(cleanClubId, state)) return false;
  const amount = Number(CLUB_WORLD_CUP_CONFIG.prizes?.[stage] || 0);
  if(amount <= 0) return false;
  state.prizesPaid = state.prizesPaid || {};
  const key = String(stage);
  const paid = state.prizesPaid[managedId] || {};
  if(paid[key]) return false;
  paid[key] = amount;
  state.prizesPaid[managedId] = paid;
  game.budget = Math.round(Number(game.budget || 0) + amount);
  game.lastBudgetDelta = Math.round(Number(game.lastBudgetDelta || 0) + amount);
  const labels = { participate:'Participación', groups:'Pasar grupos', qf:'Cuartos', sf:'Semifinal', runnerUp:'Subcampeón', champion:'Campeón' };
  pushGameMessage({
    type:'finanzas',
    priority:'normal',
    inbox:'always',
    title:`Premio ${CLUB_WORLD_CUP_CONFIG.name}`,
    body:`${labels[key] || key}: ${formatMoney(amount)} acreditados a ${clubName(managedId)}.`,
    id:`club-world-cup-prize-${state.season}-${managedId}-${key}`
  });
  return true;
}
function finalizeClubWorldCupMatchResult(match, result){
  if(!match?.clubWorldCup || !result) return result;
  let out = { ...result, clubWorldCup:true, clubWorldCupStage:match.clubWorldCupStage, clubWorldCupGroup:match.clubWorldCupGroup || '' };
  if(match.clubWorldCupKnockout){
    const winnerMatch = { ...match, requiresWinner:true, tieBreakMode:'penalties', neutralVenue:true };
    if(typeof finalizeWinnerRequiredMatchResult === 'function') out = finalizeWinnerRequiredMatchResult(winnerMatch, out);
    else{
      const hg = Number(out.homeGoals || 0);
      const ag = Number(out.awayGoals || 0);
      if(hg > ag) out.winnerClubId = Number(match.homeId);
      else if(ag > hg) out.winnerClubId = Number(match.awayId);
    }
    delete out.clubWorldCupTiebreaker;
    out.clubWorldCupResolved = Boolean(out.winnerClubId);
  }
  return out;
}
function advanceClubWorldCupIfNeeded(){
  const state = clubWorldCupState();
  if(!game || !state || state.status === 'completed') return false;
  if(state.status === 'groups' && clubWorldCupStageComplete('groups')){
    const qualified = clubWorldCupQualifiedFromGroups();
    state.r16ClubIds = qualified;
    if(qualified.includes(Number(game.selectedClubId))) awardClubWorldCupPrizeIfManaged(game.selectedClubId, 'groups');
    const groupOrder = state.groups || [];
    const participants = [];
    for(let i=0;i<groupOrder.length;i+=2){
      const g1 = clubWorldCupGroupStandings(groupOrder[i].id);
      const g2 = clubWorldCupGroupStandings(groupOrder[i+1].id);
      participants.push(g1[0]?.clubId, g2[1]?.clubId, g2[0]?.clubId, g1[1]?.clubId);
    }
    return createClubWorldCupKnockoutStage('r16', participants.filter(Boolean));
  }
  if(state.status === 'r16' && clubWorldCupStageComplete('r16')){
    const winners = clubWorldCupWinnersFromStage('r16');
    if(winners.includes(Number(game.selectedClubId))) awardClubWorldCupPrizeIfManaged(game.selectedClubId, 'qf');
    return createClubWorldCupKnockoutStage('qf', winners);
  }
  if(state.status === 'qf' && clubWorldCupStageComplete('qf')){
    const winners = clubWorldCupWinnersFromStage('qf');
    if(winners.includes(Number(game.selectedClubId))) awardClubWorldCupPrizeIfManaged(game.selectedClubId, 'sf');
    return createClubWorldCupKnockoutStage('sf', winners);
  }
  if(state.status === 'sf' && clubWorldCupStageComplete('sf')){
    return createClubWorldCupFinalStages(clubWorldCupWinnersFromStage('sf'), clubWorldCupLosersFromStage('sf'));
  }
  if(state.status === 'final' && clubWorldCupStageComplete('thirdPlace') && clubWorldCupStageComplete('final')){
    const final = clubWorldCupStageMatches('final')[0];
    const thirdPlaceMatch = clubWorldCupStageMatches('thirdPlace')[0];
    const championId = clubWorldCupKnockoutWinner(final);
    const runnerUpId = championId === Number(final.homeId) ? Number(final.awayId) : Number(final.homeId);
    const thirdPlaceId = thirdPlaceMatch ? clubWorldCupKnockoutWinner(thirdPlaceMatch) : 0;
    state.championId = championId;
    state.runnerUpId = runnerUpId;
    state.thirdPlaceId = thirdPlaceId;
    state.status = 'completed';
    archiveClubWorldCupEditionForState(game, { allowIncomplete:false });
    recordCompetitionChampion({
      season:state.season || game.seasonNumber || 1,
      year:game.seasonYear || seasonYearForNumber(state.season || game.seasonNumber || 1),
      type:'club_world_cup',
      competitionId:'club-world-cup',
      competitionName:state.name || CLUB_WORLD_CUP_CONFIG.name,
      championId,
      runnerUpId,
      thirdPlaceId
    });
    awardClubWorldCupPrizeIfManaged(runnerUpId, 'runnerUp');
    awardClubWorldCupPrizeIfManaged(championId, 'champion');
    if(Number(game.selectedClubId || 0) === championId){
      if(typeof addManagerPrestige === 'function') addManagerPrestige(4, `Campeón de ${CLUB_WORLD_CUP_CONFIG.name}`);
      recordManagerOfficialTitleForState(game, {
        season:state.season || game.seasonNumber || 1,
        year:game.seasonYear || seasonYearForNumber(state.season || game.seasonNumber || 1),
        type:'club_world_cup',
        competitionId:'club-world-cup',
        competitionName:state.name || CLUB_WORLD_CUP_CONFIG.name,
        clubId:championId,
        clubName:clubName(championId)
      });
      if(typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:false });
    }
    pushGameMessage({ type:'deportivo', priority:'high', title:`Campeón: ${clubName(championId)}`, body:`${clubName(championId)} ganó la ${CLUB_WORLD_CUP_CONFIG.name}.`, id:`club-world-cup-${state.season}-champion` });
    return true;
  }
  return false;
}
function createPostRegularCompetitionsIfNeeded(){
  if(!game || game.seasonFinalized || !Array.isArray(game.fixtures)) return null;
  if(typeof managerChallengeIs === 'function' && managerChallengeIs()) return null;
  const createdKinds = [];
  if(typeof createNationalSupercupIfNeeded === 'function') NATIONAL_CUP_COUNTRIES?.forEach?.(country => { if(createNationalSupercupIfNeeded(country)) createdKinds.push(`national_supercup_${nationalCupCountryKey(country)}`); });
  if(typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded()){
    createdKinds.push('promotion_playoff');
  }
  const clubWorldCupEnsure = typeof ensureClubWorldCupCurrentSeason === 'function' ? ensureClubWorldCupCurrentSeason({ source:'post-regular-check' }) : { created:createClubWorldCupIfNeeded(), changed:false, repaired:false };
  if(clubWorldCupEnsure?.created){
    createdKinds.push('club_world_cup');
  }else if(clubWorldCupEnsure?.changed){
    createdKinds.push('club_world_cup_repaired');
  }
  if(createdKinds.length){
    if(typeof repairClubWorldCupFixtureSchedule === 'function') repairClubWorldCupFixtureSchedule({ force:true });
    else if(typeof repairClubWorldCupGroupFixtureDates === 'function') repairClubWorldCupGroupFixtureDates({ force:true });
    const messages = [];
    if(createdKinds.includes('promotion_playoff')) messages.push('Se creó el calendario de playoffs de promoción');
    if(createdKinds.some(kind => String(kind).startsWith('national_supercup_'))) messages.push('se programaron las supercopas nacionales para el día 300');
    if(createdKinds.includes('club_world_cup')) messages.push(`se sorteó la Copa Mundial de Clubes de la FIFA el día ${clubWorldCupFixtureReadySeasonDay()}, con la primera fecha programada para el día ${clubWorldCupGroupSeasonDays()[0]}`);
    if(createdKinds.includes('club_world_cup_repaired')) messages.push('se reparó y reconstruyó el calendario del Mundial de Clubes');
    return { created:true, kind:createdKinds.join('+'), message:`${messages.join(' y ')}.` };
  }
  if(typeof repairClubWorldCupFixtureSchedule === 'function') repairClubWorldCupFixtureSchedule();
  else if(typeof repairClubWorldCupGroupFixtureDates === 'function') repairClubWorldCupGroupFixtureDates();
  if(advanceClubWorldCupIfNeeded()){
    const state = clubWorldCupState();
    const done = state?.status === 'completed';
    return { created:true, kind:'club_world_cup', completed:done, message:done ? 'Finalizó la Copa Mundial de Clubes de la FIFA.' : 'Se creó la siguiente fase de la Copa Mundial de Clubes de la FIFA.' };
  }
  return null;
}

function clubWorldCupPlayedMatches(){
  return (game?.fixtures || [])
    .filter(round => round?.clubWorldCupRound)
    .flatMap(round => round.matches || [])
    .filter(match => match?.clubWorldCup && match.played);
}
function clubWorldCupEnsurePlayerStat(map, playerId, clubId){
  const id = Number(playerId || 0);
  if(!id) return null;
  if(!map.has(id)){
    const player = playerById(id) || {};
    map.set(id, { playerId:id, clubId:Number(clubId || player.clubId || 0), played:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, errors:0, goalErrors:0 });
  }
  return map.get(id);
}
function clubWorldCupTournamentPlayerStats(){
  const map = new Map();
  clubWorldCupPlayedMatches().forEach(match => {
    const homeIds = (match.playedIdsHome || match.starterIdsHome || []).map(Number).filter(Boolean);
    const awayIds = (match.playedIdsAway || match.starterIdsAway || []).map(Number).filter(Boolean);
    homeIds.forEach(id => { const row = clubWorldCupEnsurePlayerStat(map, id, match.homeId); if(row) row.played += 1; });
    awayIds.forEach(id => { const row = clubWorldCupEnsurePlayerStat(map, id, match.awayId); if(row) row.played += 1; });
    (match.goals || []).forEach(goal => {
      const row = clubWorldCupEnsurePlayerStat(map, goal.playerId, goal.clubId);
      if(row) row.goals += 1;
      if(goal.assistId){
        const assist = clubWorldCupEnsurePlayerStat(map, goal.assistId, goal.clubId);
        if(assist) assist.assists += 1;
      }
    });
    (match.cards || []).forEach(card => {
      const row = clubWorldCupEnsurePlayerStat(map, card.playerId, card.clubId);
      if(!row) return;
      if(card.type === 'yellow') row.yellow += 1;
      if(card.type === 'secondYellowRed'){ row.yellow += 1; row.red += 1; }
      if(card.type === 'red') row.red += 1;
    });
    (match.injuries || []).forEach(injury => {
      const row = clubWorldCupEnsurePlayerStat(map, injury.playerId, injury.clubId);
      if(row) row.injuries += 1;
    });
    (match.keySaves || []).forEach(save => {
      const row = clubWorldCupEnsurePlayerStat(map, save.playerId, save.clubId);
      if(row) row.keySaves += 1;
    });
    (match.errors || []).forEach(error => {
      const row = clubWorldCupEnsurePlayerStat(map, error.playerId, error.clubId);
      if(row){ row.errors += 1; if(error.goal) row.goalErrors += 1; }
    });
  });
  return Array.from(map.values());
}
function clubWorldCupTournamentTeamStats(){
  const state = clubWorldCupState();
  const ids = Array.isArray(state?.participantClubIds) ? state.participantClubIds.map(Number).filter(Boolean) : [];
  const rows = new Map(ids.map(id => [id, { clubId:id, pj:0, gf:0, gc:0, dg:0, fouls:0, yellow:0, red:0 }]));
  const ensure = id => {
    const clubId = Number(id || 0);
    if(!clubId) return null;
    if(!rows.has(clubId)) rows.set(clubId, { clubId, pj:0, gf:0, gc:0, dg:0, fouls:0, yellow:0, red:0 });
    return rows.get(clubId);
  };
  clubWorldCupPlayedMatches().forEach(match => {
    const h = ensure(match.homeId);
    const a = ensure(match.awayId);
    if(!h || !a) return;
    const hg = Number(match.homeGoals || 0);
    const ag = Number(match.awayGoals || 0);
    h.pj += 1; a.pj += 1;
    h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
    h.dg = h.gf - h.gc; a.dg = a.gf - a.gc;
    h.fouls += Number(match.matchStats?.home?.fouls || 0);
    a.fouls += Number(match.matchStats?.away?.fouls || 0);
    (match.cards || []).forEach(card => {
      const row = ensure(card.clubId);
      if(!row) return;
      if(card.type === 'yellow') row.yellow += 1;
      if(card.type === 'secondYellowRed'){ row.yellow += 1; row.red += 1; }
      if(card.type === 'red') row.red += 1;
    });
  });
  return Array.from(rows.values()).filter(row => row.pj > 0);
}
function clubWorldCupStatList(list, key, empty='Sin datos todavía.'){
  if(!list.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return list.slice(0,20).map((s,i) => {
    const player = playerById(s.playerId);
    return `<div class="stat-rank ${Number(s.clubId)===Number(game?.selectedClubId) ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${Number(s.playerId || 0)}">${escapeHtml(player?.name || 'Jugador')}</button> <span class="pill ${Number(s.clubId)===Number(game?.selectedClubId) ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong>${Number(s[key] || 0)}</strong></div>`;
  }).join('');
}
function clubWorldCupCardStatList(list){
  if(!list.length) return '<p class="muted">Sin tarjetas todavía.</p>';
  return list.slice(0,20).map((s,i) => {
    const player = playerById(s.playerId);
    return `<div class="stat-rank ${Number(s.clubId)===Number(game?.selectedClubId) ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${Number(s.playerId || 0)}">${escapeHtml(player?.name || 'Jugador')}</button> <span class="pill ${Number(s.clubId)===Number(game?.selectedClubId) ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong><span class="yellow-card">■</span> ${Number(s.yellow || 0)} / <span class="red-card">■</span> ${Number(s.red || 0)}</strong></div>`;
  }).join('');
}
function clubWorldCupTeamFoulsList(list){
  if(!list.length) return '<p class="muted">Sin faltas registradas todavía.</p>';
  return list.slice(0,20).map((s,i) => `<div class="stat-rank ${Number(s.clubId)===Number(game?.selectedClubId) ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span>${clubLink(s.clubId)}</span><strong>${Number(s.fouls || 0)}</strong></div>`).join('');
}
function clubWorldCupStatsBlock(){
  const stats = clubWorldCupTournamentPlayerStats();
  const scorers = stats.filter(s => s.goals > 0).sort((a,b)=>b.goals-a.goals || b.assists-a.assists || clubName(a.clubId).localeCompare(clubName(b.clubId),'es',{sensitivity:'base'}));
  const assists = stats.filter(s => s.assists > 0).sort((a,b)=>b.assists-a.assists || b.goals-a.goals || clubName(a.clubId).localeCompare(clubName(b.clubId),'es',{sensitivity:'base'}));
  const cards = stats.filter(s => s.yellow > 0 || s.red > 0).sort((a,b)=>(b.red*3+b.yellow)-(a.red*3+a.yellow));
  const played = stats.filter(s => s.played > 0).sort((a,b)=>b.played-a.played || b.goals-a.goals);
  const fouls = clubWorldCupTournamentTeamStats().sort((a,b)=>b.fouls-a.fouls || b.yellow-a.yellow || b.red-a.red);
  return `<div class="card stats-division-block"><h3>Estadísticas del Mundial de Clubes</h3><div class="grid cols-4">
    <div class="card inner"><h3>Goleadores</h3>${clubWorldCupStatList(scorers, 'goals')}</div>
    <div class="card inner"><h3>Asistidores</h3>${clubWorldCupStatList(assists, 'assists')}</div>
    <div class="card inner"><h3>Tarjetas</h3>${clubWorldCupCardStatList(cards)}</div>
    <div class="card inner"><h3>Más PJ</h3>${clubWorldCupStatList(played, 'played')}</div>
  </div><div class="card inner" style="margin-top:12px"><h3>Faltas por equipo</h3>${clubWorldCupTeamFoulsList(fouls)}</div></div>`;
}

function clubWorldCupEditionHistoryKey(edition){
  return `history-${Number(edition?.season || 0)}-${Number(edition?.year || 0)}`;
}
function clubWorldCupYearOptionsMarkup(selected=selectedClubWorldCupYear){
  const currentYear = Number(game?.seasonYear || seasonYearForNumber(game?.seasonNumber || 1));
  const current = clubWorldCupCurrentEditionSnapshot();
  const options = [`<option value="current" ${String(selected || 'current') === 'current' ? 'selected' : ''}>${currentYear} · actual${current ? '' : ' · sin sorteo'}</option>`];
  clubWorldCupHistoryEntries()
    .filter(edition => !current || Number(edition.season || 0) !== Number(current.season || 0) || Number(edition.year || 0) !== Number(current.year || 0))
    .forEach(edition => {
      const key = clubWorldCupEditionHistoryKey(edition);
      options.push(`<option value="${escapeHtml(key)}" ${String(selected || '') === key ? 'selected' : ''}>${Number(edition.year || 0)} · Temp. ${Number(edition.season || 0)}</option>`);
    });
  return `<div class="division-filter cwc-year-filter"><label for="clubWorldCupYearFilter">Año</label><select id="clubWorldCupYearFilter">${options.join('')}</select></div>`;
}
function selectedClubWorldCupEditionForDisplay(){
  const selected = String(selectedClubWorldCupYear || 'current');
  if(selected === 'current') return { edition:clubWorldCupCurrentEditionSnapshot(), current:true };
  const match = selected.match(/^history-(\d+)-(\d+)$/);
  if(!match){ selectedClubWorldCupYear = 'current'; return { edition:clubWorldCupCurrentEditionSnapshot(), current:true }; }
  const season = Number(match[1] || 0);
  const year = Number(match[2] || 0);
  const edition = clubWorldCupHistoryEntries().find(item => Number(item.season || 0) === season && Number(item.year || 0) === year) || null;
  if(!edition){ selectedClubWorldCupYear = 'current'; return { edition:clubWorldCupCurrentEditionSnapshot(), current:true }; }
  return { edition, current:false };
}
function clubWorldCupEditionMatchScore(match){
  if(!match?.played) return 'vs';
  const tie = match.tiebreaker ? ` · faltas ${Number(match.tiebreaker.homeFouls || 0)}-${Number(match.tiebreaker.awayFouls || 0)}` : '';
  return `${Number(match.homeGoals || 0)} - ${Number(match.awayGoals || 0)}${tie}`;
}
function clubWorldCupEditionPenaltyLine(match){
  if(!match?.penaltyShootout) return '';
  const winnerId = Number(match.winnerClubId || match.penaltyShootout.winnerClubId || (Number(match.penaltyShootout.home || 0) > Number(match.penaltyShootout.away || 0) ? match.homeId : match.awayId));
  return `<div class="penalty-result-line">${escapeHtml(clubName(winnerId))} gana ${Number(match.penaltyShootout.home || 0)}-${Number(match.penaltyShootout.away || 0)} por penales</div>`;
}
function clubWorldCupEditionMatchCard(match, options={}){
  const interactive = Boolean(options.interactive && match?.played && match?.id);
  const tag = interactive ? 'button' : 'div';
  const attr = interactive ? ` data-match-id="${escapeHtml(match.id)}"` : '';
  const className = `match-card cwc-edition-match ${interactive ? 'clickable' : ''} ${match?.played ? 'played' : 'pending'}`;
  const seasonDay = Math.max(0, Math.round(Number(match?.seasonDay || clubWorldCupStageSeasonDay(match?.stage, match?.roundNumber || 1) || 0)));
  const meta = [seasonDay ? `Día ${seasonDay}` : '', match?.date ? matchDateLabel(match.date) : '', match?.stadiumName || '', match?.bracketKey || ''].filter(Boolean).join(' · ');
  const revenue = Number(match?.ticketRevenue || 0) > 0 ? `<span class="cwc-match-revenue">${formatPlainNumber(match.attendance || 0)} espectadores · Entrada ${formatMoney(match.ticketPrice || 0)} · Recaudación ${formatMoney(match.ticketRevenue || 0)}</span>` : '';
  return `<${tag} class="${className}"${attr}>
    <div class="match-date-line">${escapeHtml(meta || 'Fecha pendiente')}</div>
    <div class="match-line">
      <div class="cwc-match-team ${Number(match?.winnerClubId || 0) === Number(match?.homeId || 0) ? 'winner' : ''}">${clubBadge(match?.homeId)} <span>${escapeHtml(clubName(match?.homeId))}</span></div>
      <strong class="score">${escapeHtml(clubWorldCupEditionMatchScore(match))}</strong>
      <div class="cwc-match-team ${Number(match?.winnerClubId || 0) === Number(match?.awayId || 0) ? 'winner' : ''}">${clubBadge(match?.awayId)} <span>${escapeHtml(clubName(match?.awayId))}</span></div>
    </div>
    ${clubWorldCupEditionPenaltyLine(match)}
    ${revenue}
  </${tag}>`;
}
function clubWorldCupCompactGroupMatch(match, interactive=false){
  const attr = interactive && match?.played && match?.id ? ` data-match-id="${escapeHtml(match.id)}"` : '';
  const tag = attr ? 'button' : 'div';
  const seasonDay = Math.max(0, Math.round(Number(match?.seasonDay || clubWorldCupStageSeasonDay('groups', match?.roundNumber || 1) || 0)));
  const compactRevenue = Number(match?.ticketRevenue || 0) > 0 ? `Rec. ${formatMoney(match.ticketRevenue || 0)}` : '';
  const dateLabel = [seasonDay ? `Día ${seasonDay}` : '', match?.date ? matchDateLabel(match.date) : 'Pendiente', compactRevenue].filter(Boolean).join(' · ');
  const revenueTitle = Number(match?.ticketRevenue || 0) > 0 ? ` title="${escapeHtml(`${formatPlainNumber(match.attendance || 0)} espectadores · Entrada ${formatMoney(match.ticketPrice || 0)} · Recaudación ${formatMoney(match.ticketRevenue || 0)}`)}"` : '';
  return `<${tag} class="cwc-group-result ${attr ? 'clickable' : ''}"${attr}${revenueTitle}>
    <span class="cwc-group-result-date">${escapeHtml(dateLabel)}</span>
    <span>${clubBadge(match?.homeId)} ${escapeHtml(clubName(match?.homeId))}</span>
    <strong>${escapeHtml(clubWorldCupEditionMatchScore(match))}</strong>
    <span>${escapeHtml(clubName(match?.awayId))} ${clubBadge(match?.awayId)}</span>
  </${tag}>`;
}
function clubWorldCupGroupsMarkup(edition, options={}){
  const groups = Array.isArray(edition?.groups) ? edition.groups : [];
  if(!groups.length) return '<div class="card"><p class="muted">No hay tablas de grupos guardadas para esta edición.</p></div>';
  return `<div class="cwc-section-heading"><div><h3>Fase de grupos</h3><p class="muted small">Cada grupo funciona como una liga de cuatro equipos. Los dos primeros avanzan a octavos.</p></div><span class="pill">8 grupos · 16 clasificados</span></div>
    <div class="cwc-groups-grid">${groups.map(group => {
      const standings = (Array.isArray(group.standings) ? group.standings : []).slice().sort((a,b)=>Number(a.position || 999)-Number(b.position || 999));
      const rows = standings.map((row,index) => `<tr class="${index < 2 ? 'promotion-row cwc-qualified-row' : ''}"><td><strong>${index + 1}</strong></td><td>${clubLink(row.clubId)}</td><td>${Number(row.pj || 0)}</td><td>${Number(row.dg || 0)}</td><td><strong>${Number(row.pts || 0)}</strong></td></tr>`).join('');
      const matches = (Array.isArray(group.matches) ? group.matches : []).slice().sort((a,b)=>Number(a.seasonDay || 0)-Number(b.seasonDay || 0) || Number(a.roundNumber || 0)-Number(b.roundNumber || 0) || daysBetweenIsoDates(b.date || '', a.date || ''));
      return `<article class="card inner cwc-group-card">
        <div class="row cwc-group-title"><h3>${escapeHtml(group.name || `Grupo ${group.id}`)}</h3><span class="pill">1° y 2° clasifican</span></div>
        <div class="table-wrap"><table class="cwc-group-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table></div>
        <details class="cwc-group-results"><summary>Partidos y resultados</summary><div class="cwc-group-result-list">${matches.map(match => clubWorldCupCompactGroupMatch(match, Boolean(options.interactive))).join('') || '<p class="muted small">Todavía no hay partidos.</p>'}</div></details>
      </article>`;
    }).join('')}</div>`;
}
function clubWorldCupBracketMarkup(edition, options={}){
  const stages = edition?.stages || {};
  const stageDefs = [ ['r16','Octavos'], ['qf','Cuartos'], ['sf','Semifinales'], ['final','Final'] ];
  const columns = stageDefs.map(([stage,label]) => {
    const matches = Array.isArray(stages[stage]) ? stages[stage] : [];
    return `<section class="cwc-bracket-stage cwc-bracket-${stage}"><h3>${label}</h3><div class="cwc-bracket-matches">${matches.length ? matches.map(match => clubWorldCupEditionMatchCard(match, { interactive:Boolean(options.interactive) })).join('') : '<div class="cwc-bracket-placeholder">Pendiente</div>'}</div></section>`;
  }).join('');
  const third = Array.isArray(stages.thirdPlace) ? stages.thirdPlace : [];
  return `<div class="cwc-section-heading"><div><h3>Cuadro eliminatorio</h3><p class="muted small">Cruces a partido único desde octavos hasta la final.</p></div></div>
    <div class="cwc-bracket-scroll"><div class="cwc-bracket">${columns}</div></div>
    ${third.length ? `<div class="card cwc-third-place"><h3>Partido por el 3er puesto</h3><div class="grid cols-2">${third.map(match => clubWorldCupEditionMatchCard(match, { interactive:Boolean(options.interactive) })).join('')}</div></div>` : ''}`;
}
function clubWorldCupRankingTableMarkup(title, result, selectedIds=[]){
  const selected=new Set((selectedIds || []).map(Number));
  const championIds=new Set((result?.sources || []).filter(item => /^Campeón de /.test(String(item?.source || ''))).map(item => Number(item.clubId)));
  const rows=(result?.ranking || []).slice(0,16).map(row => {
    const id=Number(row.clubId || 0);
    const state=selected.has(id) ? (championIds.has(id) ? 'Campeón clasificado' : 'Clasifica por ranking') : 'Fuera del corte';
    return `<tr class="${selected.has(id) ? 'cwc-ranking-qualified' : ''}"><td>${Number(row.rank || 0)}</td><td>${clubBadge(id)} ${escapeHtml(clubName(id))}</td><td>${Number(row.points || 0)}</td><td>${Number(row.wins || 0)}</td><td>${Number(row.currentYearWins || 0)}</td><td>${Number(row.dg || 0)}</td><td>${escapeHtml(state)}</td></tr>`;
  }).join('');
  return `<div class="card cwc-ranking-card"><h3>${escapeHtml(title)}</h3><p class="muted small">Los campeones únicos tienen cupo directo. El resto se ordena por puntos, victorias, rendimiento reciente y diferencia de gol.</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Club</th><th>Pts.</th><th>Victorias</th><th>Victorias año actual</th><th>DG</th><th>Situación</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">Todavía no hay ediciones continentales finalizadas dentro de la ventana.</td></tr>'}</tbody></table></div></div>`;
}
function clubWorldCupQualificationMarkup(data){
  if(!data) return '';
  const championsIds=data.championsLeagueClubIds || data.champions?.clubIds || [];
  const libertadoresIds=data.libertadoresClubIds || data.libertadores?.clubIds || [];
  const invitedIds=data.invitedClubIds || data.invitedIds || [];
  const rankings=data.continentalRankings || { champions:data.champions?.ranking || [], libertadores:data.libertadores?.ranking || [] };
  const sources=Array.isArray(data.qualificationSources) ? data.qualificationSources : (data.sources || []);
  if(!championsIds.length && !libertadoresIds.length && !invitedIds.length && !(rankings.champions || []).length && !(rankings.libertadores || []).length) return '';
  const sourceList=(ids,label) => `<div class="card inner"><p class="label">${escapeHtml(label)}</p><div class="cwc-qualified-list">${ids.map(id => { const source=sources.find(item => Number(item?.clubId || 0)===Number(id)); return `<div>${clubBadge(id)} <strong>${escapeHtml(clubName(id))}</strong><span>${escapeHtml(source?.source || '')}</span></div>`; }).join('')}</div></div>`;
  return `<div class="card cwc-qualification-summary"><div class="row section-title"><div><h3>Clasificación al Mundial</h3><p class="muted small">Ventana: ${(data.qualificationWindowYears || data.windowYears || []).join(', ') || 'sin datos'}. Ocho cupos por Champions, ocho por Libertadores y dieciséis invitados.</p></div></div><div class="grid cols-3">${sourceList(championsIds,'Champions League · 8')}${sourceList(libertadoresIds,'Copa Libertadores · 8')}${sourceList(invitedIds,'Invitados · 16')}</div></div>${clubWorldCupRankingTableMarkup('Ranking Champions League', { ranking:rankings.champions || [], sources }, championsIds)}${clubWorldCupRankingTableMarkup('Ranking Copa Libertadores', { ranking:rankings.libertadores || [], sources }, libertadoresIds)}`;
}
function clubWorldCupEditionMarkup(edition, options={}){
  if(!edition){
    const readyDay = typeof clubWorldCupFixtureReadySeasonDay === 'function' ? clubWorldCupFixtureReadySeasonDay() : 295;
    const currentYear=Number(game?.seasonYear || currentSeasonYear());
    const nextYear=clubWorldCupNextEditionYear(currentYear, true);
    const isEdition=clubWorldCupIsEditionYear(currentYear);
    const preview=clubWorldCupQualificationPreview(nextYear);
    const currentNote = options.current && isEdition ? ` El sorteo se genera automáticamente el día ${readyDay}, después de las finales continentales.` : ` La próxima edición se jugará en ${nextYear}.`;
    const issue = options.current && game?.clubWorldCupGenerationIssue?.reason ? `<p class="small danger-text">Diagnóstico: ${escapeHtml(game.clubWorldCupGenerationIssue.reason)}</p>` : '';
    return `<div class="card"><p class="muted">${isEdition ? 'El Mundial de Clubes todavía no se sorteó.' : `En ${currentYear} no se disputa el Mundial de Clubes.`}</p><p class="small muted">Se juega cada cuatro años desde 2025.${currentNote}</p>${issue}</div>${clubWorldCupQualificationMarkup(preview)}`;
  }
  const champion = Number(edition.championId || 0);
  const runnerUp = Number(edition.runnerUpId || 0);
  const third = Number(edition.thirdPlaceId || 0);
  const championBlock = champion ? `<div class="card champion-card cwc-champion-card"><p class="label">Campeón ${Number(edition.year || 0)}</p><h2>${clubBadge(champion)} ${escapeHtml(clubName(champion))}</h2><p class="muted">${runnerUp ? `Subcampeón: ${escapeHtml(clubName(runnerUp))}` : ''}${third ? `${runnerUp ? ' · ' : ''}3°: ${escapeHtml(clubName(third))}` : ''}</p></div>` : '';
  const statusLabels = { groups:'Fase de grupos', r16:'Octavos', qf:'Cuartos', sf:'Semifinales', final:'Final', completed:'Finalizado' };
  const dates = Array.isArray(edition.groupDates) ? edition.groupDates : [];
  const groupSeasonDays = Array.isArray(edition.groupSeasonDays) && edition.groupSeasonDays.length ? edition.groupSeasonDays : clubWorldCupGroupSeasonDays();
  const stageSeasonDays = edition.stageSeasonDays || {};
  const allEditionMatches = [
    ...(Array.isArray(edition.groups) ? edition.groups.flatMap(group => Array.isArray(group?.matches) ? group.matches : []) : []),
    ...Object.values(edition.stages || {}).flatMap(matches => Array.isArray(matches) ? matches : [])
  ];
  const playedRevenueMatches = allEditionMatches.filter(match => match?.played && Number(match?.ticketRevenue || 0) > 0);
  const totalRevenue = playedRevenueMatches.reduce((sum, match) => sum + Number(match.ticketRevenue || 0), 0);
  const totalAttendance = playedRevenueMatches.reduce((sum, match) => sum + Number(match.attendance || 0), 0);
  const overview = `<div class="grid cols-3 cwc-overview-grid">
    <div class="card inner"><p class="label">Edición</p><h3>${Number(edition.year || 0)}</h3><p class="muted small">Temporada ${Number(edition.season || 0)}</p></div>
    <div class="card inner"><p class="label">Estado</p><h3>${escapeHtml(statusLabels[edition.status] || edition.status || '—')}</h3><p class="muted small">${Number(edition.participantClubIds?.length || 0) || 32} participantes</p></div>
    <div class="card inner"><p class="label">Formato</p><h3>8 grupos de 4</h3><p class="muted small">1 Champions · 1 Libertadores · 2 invitados</p></div>
  </div>`;
  const stageCalendarLabel = stage => {
    const day = Number(stageSeasonDays[stage] || clubWorldCupStageSeasonDay(stage, 1));
    const iso = clubWorldCupIsoForSeasonDay(day, Number(edition.year || currentSeasonYear()));
    return `día ${day} · ${escapeHtml(matchDateLabel(iso))}`;
  };
  const calendar = edition.drawDate || dates.length ? `<div class="card cwc-calendar-summary"><h3>Calendario fijo por día de temporada</h3><p class="muted small">${edition.drawDate ? `Sorteo: día ${Number(edition.drawSeasonDay || clubWorldCupFixtureReadySeasonDay())} · ${escapeHtml(matchDateLabel(edition.drawDate))}. ` : ''}${dates[0] ? `Grupos 1: día ${Number(groupSeasonDays[0] || 305)} · ${escapeHtml(matchDateLabel(dates[0]))}. ` : ''}${dates[1] ? `Grupos 2: día ${Number(groupSeasonDays[1] || 310)} · ${escapeHtml(matchDateLabel(dates[1]))}. ` : ''}${dates[2] ? `Grupos 3: día ${Number(groupSeasonDays[2] || 315)} · ${escapeHtml(matchDateLabel(dates[2]))}. ` : ''}Octavos: ${stageCalendarLabel('r16')}. Cuartos: ${stageCalendarLabel('qf')}. Semifinales: ${stageCalendarLabel('sf')}. 3er puesto: ${stageCalendarLabel('thirdPlace')}. Final: ${stageCalendarLabel('final')}.</p><p class="muted small">Entradas: ${formatMoney(CLUB_WORLD_CUP_CONFIG.ticketPrice)} por partido y ${formatMoney(CLUB_WORLD_CUP_CONFIG.finalTicketPrice)} en la final.</p></div>` : '';
  const revenueSummary = playedRevenueMatches.length ? `<div class="card cwc-revenue-summary"><h3>Recaudación de la edición</h3><div class="grid cols-3"><div><p class="label">Partidos contabilizados</p><strong>${playedRevenueMatches.length}</strong></div><div><p class="label">Espectadores</p><strong>${formatPlainNumber(totalAttendance)}</strong></div><div><p class="label">Recaudación total</p><strong class="ok">${formatMoney(totalRevenue)}</strong></div></div></div>` : '';
  if(edition.summaryOnly){
    return `${overview}${championBlock}<div class="card"><p class="muted">Esta edición proviene de una partida anterior a V7.09. Se conserva el campeón y el podio, pero los grupos y resultados detallados ya no estaban disponibles en el guardado.</p></div>`;
  }
  const stats = options.showStats && options.current ? clubWorldCupStatsBlock() : '';
  return `${overview}${clubWorldCupQualificationMarkup(edition)}${calendar}${revenueSummary}${championBlock}${clubWorldCupGroupsMarkup(edition, { interactive:Boolean(options.interactive) })}${clubWorldCupBracketMarkup(edition, { interactive:Boolean(options.interactive) })}${stats ? `<div class="stack cwc-stats-history">${stats}</div>` : ''}`;
}
function bindClubWorldCupYearFilter(renderFn){
  $('clubWorldCupYearFilter')?.addEventListener('change', event => {
    selectedClubWorldCupYear = event.target.value;
    if(typeof renderFn === 'function') renderFn();
  });
}
function renderClubWorldCup(){
  if(typeof ensureClubWorldCupCurrentSeason === 'function'){
    const ensured = ensureClubWorldCupCurrentSeason({ source:'open-world-cup-tab' });
    if(ensured?.changed && typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>{});
  }
  if(typeof repairClubWorldCupGroupFixtureDates === 'function') repairClubWorldCupGroupFixtureDates();
  const selected = selectedClubWorldCupEditionForDisplay();
  view.innerHTML = `<div class="row section-title fixture-title-row">
      <div><h2>${escapeHtml(CLUB_WORLD_CUP_CONFIG.name)}</h2><p class="tagline">Edición cada cuatro años, clasificación continental y cuadro eliminatorio.</p></div>
      <div class="fixture-controls row">${clubWorldCupYearOptionsMarkup(selectedClubWorldCupYear)}</div>
    </div>
    <div class="stack cwc-edition-view">${clubWorldCupEditionMarkup(selected.edition, { current:selected.current, interactive:selected.current, showStats:true })}</div>`;
  bindClubWorldCupYearFilter(renderClubWorldCup);
}
