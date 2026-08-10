/* V9.50 · Bolsa de clubes sudamericanos preparada para la futura Copa Libertadores. */

const LIBERTADORES_TEAM_POOL_CONFIG = Object.freeze({
  enabled:true,
  name:'Bolsa Copa Libertadores',
  divisionId:'libertadores-bolsa',
  divisionName:'Bolsa Copa Libertadores',
  rosterSize:25,
  rosterVersion:'V9.50',
  teams:Object.freeze([
    { id:910004, name:'Olimpia', country:'Paraguay', city:'Asunción', reputation:71, primaryColor:'#FFFFFF', crestPath:'img/escudos/Olimpia.png', nationalityPool:['Paraguay','Paraguay','Paraguay','Paraguay','Paraguay','Paraguay','Argentina','Uruguay','Brasil'] },
    { id:910003, name:'Cerro Porteño', country:'Paraguay', city:'Asunción', reputation:68, primaryColor:'#D71920', crestPath:'img/escudos/Cerro_Porteño.png', nationalityPool:['Paraguay','Paraguay','Paraguay','Paraguay','Paraguay','Paraguay','Argentina','Uruguay','Colombia'] },
    { id:920001, name:'Universitario', country:'Perú', city:'Lima', reputation:63, primaryColor:'#F5E6C8', crestPath:'img/escudos/Universitario.png', nationalityPool:['Perú','Perú','Perú','Perú','Perú','Perú','Argentina','Uruguay','Colombia'] },
    { id:920002, name:'Sporting Cristal', country:'Perú', city:'Lima', reputation:61, primaryColor:'#65C7F7', crestPath:'img/escudos/Sporting_Cristal.png', nationalityPool:['Perú','Perú','Perú','Perú','Perú','Perú','Argentina','Uruguay','Colombia'] },
    { id:920003, name:'Atlético Nacional', country:'Colombia', city:'Medellín', reputation:68, primaryColor:'#138A36', crestPath:'img/escudos/Atlético_Nacional.png', nationalityPool:['Colombia','Colombia','Colombia','Colombia','Colombia','Colombia','Argentina','Uruguay','Venezuela'] },
    { id:920004, name:'Junior', country:'Colombia', city:'Barranquilla', reputation:64, primaryColor:'#D71920', crestPath:'img/escudos/Junior.png', nationalityPool:['Colombia','Colombia','Colombia','Colombia','Colombia','Colombia','Argentina','Uruguay','Venezuela'] },
    { id:920005, name:'Peñarol', country:'Uruguay', city:'Montevideo', reputation:75, primaryColor:'#F4D21F', crestPath:'img/escudos/Peñarol.png', nationalityPool:['Uruguay','Uruguay','Uruguay','Uruguay','Uruguay','Uruguay','Argentina','Paraguay','Brasil'] },
    { id:920006, name:'Nacional', country:'Uruguay', city:'Montevideo', reputation:74, primaryColor:'#153D8A', crestPath:'img/escudos/Nacional.png', nationalityPool:['Uruguay','Uruguay','Uruguay','Uruguay','Uruguay','Uruguay','Argentina','Paraguay','Brasil'] },
    { id:920007, name:'Deportivo Táchira', country:'Venezuela', city:'San Cristóbal', reputation:56, primaryColor:'#F2D21B', crestPath:'img/escudos/Deportivo_Táchira.png', nationalityPool:['Venezuela','Venezuela','Venezuela','Venezuela','Venezuela','Venezuela','Colombia','Argentina','Uruguay'] },
    { id:920008, name:'Caracas FC', country:'Venezuela', city:'Caracas', reputation:54, primaryColor:'#C8102E', crestPath:'img/escudos/Caracas_FC.png', nationalityPool:['Venezuela','Venezuela','Venezuela','Venezuela','Venezuela','Venezuela','Colombia','Argentina','Uruguay'] },
    { id:920009, name:'LDU Quito', country:'Ecuador', city:'Quito', reputation:73, primaryColor:'#FFFFFF', crestPath:'img/escudos/LDU_Quito.png', nationalityPool:['Ecuador','Ecuador','Ecuador','Ecuador','Ecuador','Ecuador','Argentina','Uruguay','Colombia'] },
    { id:920010, name:'Independiente del Valle', country:'Ecuador', city:'Sangolquí', reputation:70, primaryColor:'#152B49', crestPath:'img/escudos/Independiente_del_Valle.png', nationalityPool:['Ecuador','Ecuador','Ecuador','Ecuador','Ecuador','Ecuador','Argentina','Colombia','Uruguay'] }
  ])
});

function libertadoresPoolTeamKey(name){
  if(typeof clubWorldCupTeamKey === 'function') return clubWorldCupTeamKey(name);
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function libertadoresPoolDefinitions(){
  return LIBERTADORES_TEAM_POOL_CONFIG.teams.map(team => ({ ...team, nationalityPool:[...(team.nationalityPool || [])] }));
}
function libertadoresPoolTeamIds(){
  return LIBERTADORES_TEAM_POOL_CONFIG.teams.map(team => Number(team.id || 0)).filter(Boolean);
}
function libertadoresPoolRosterBlueprint(){
  return typeof generationRosterBlueprint === 'function'
    ? generationRosterBlueprint()
    : ['POR','POR','POR','LD','LI','DFC','DFC','DFC','LD','LI','MCD','MCD','MC','MC','MCO','MCO','MI','MD','ED','EI','ED','EI','DC','DC','DC'];
}
function libertadoresPoolMediaRange(team, rosterIndex=0){
  const reputation = typeof clamp === 'function'
    ? clamp(Math.round(Number(team?.reputation || 50)), 20, 90)
    : Math.max(20, Math.min(90, Math.round(Number(team?.reputation || 50))));
  let min;
  let max;
  if(rosterIndex < 2){ min = reputation + 4; max = reputation + 10; }
  else if(rosterIndex < 8){ min = reputation - 2; max = reputation + 6; }
  else if(rosterIndex < 18){ min = reputation - 9; max = reputation + 2; }
  else { min = reputation - 15; max = reputation - 4; }
  const safe = value => typeof clamp === 'function' ? clamp(value, 20, 94) : Math.max(20, Math.min(94, value));
  return { min:safe(min), max:safe(Math.max(min, max)) };
}
function libertadoresPoolNationality(team, rosterIndex=0, playerId=0){
  const pool = Array.isArray(team?.nationalityPool) && team.nationalityPool.length ? team.nationalityPool : [team?.country || 'Argentina'];
  const index = typeof hashNumber === 'function'
    ? hashNumber(`libertadores-pool-nationality-${team?.name || ''}-${rosterIndex}-${playerId}`, pool.length)
    : Math.abs((Number(playerId || 0) + Number(rosterIndex || 0))) % pool.length;
  return String(pool[index] || team?.country || 'Argentina');
}
function libertadoresPoolPlayersByClub(clubId){
  if(typeof playersByClub === 'function') return playersByClub(Number(clubId || 0));
  return (seed?.players || []).filter(player => Number(player?.clubId || 0) === Number(clubId || 0));
}
function generateLibertadoresPoolPlayers(club, team, startId, fromRosterIndex=0, count=0, generationContext=null){
  const blueprint = libertadoresPoolRosterBlueprint();
  const total = Math.max(0, Math.round(Number(count || 0)));
  const firstIndex = Math.max(0, Math.round(Number(fromRosterIndex || 0)));
  const generated = [];
  if(typeof generatedPlayerFactory !== 'function') return generated;
  for(let offset=0; offset<total; offset+=1){
    const rosterIndex = firstIndex + offset;
    const id = Number(startId || 0) + offset;
    const position = blueprint[rosterIndex % blueprint.length] || 'MC';
    const group = typeof playerRoleGroup === 'function' ? playerRoleGroup(position) : (position === 'POR' ? 'POR' : 'MID');
    const age = group === 'POR'
      ? 23 + (typeof hashNumber === 'function' ? hashNumber(`libertadores-pool-age-${team.name}-${id}`, 13) : (id % 13))
      : 18 + (typeof hashNumber === 'function' ? hashNumber(`libertadores-pool-age-${team.name}-${id}`, 15) : (id % 15));
    const range = libertadoresPoolMediaRange(team, rosterIndex);
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:club.id,
      age,
      prestige:Number(team.reputation || club.reputation || 50),
      nameContext:club.name,
      divisionName:club.divisionName,
      divisionOrder:club.divisionOrder,
      generationContext,
      salaryFactor:1,
      mediaMin:range.min,
      mediaMax:range.max,
      nationalityOverride:libertadoresPoolNationality(team, rosterIndex, id),
      localCountry:team.country || club.country || 'Argentina'
    });
    generated.push({
      ...player,
      clubId:club.id,
      libertadoresPoolPlayer:true,
      specialCompetitionOnly:true,
      generatedForLibertadoresPool:true,
      libertadoresRosterVersion:LIBERTADORES_TEAM_POOL_CONFIG.rosterVersion
    });
  }
  return generated;
}
function syncLibertadoresPoolPlayerState(players=[]){
  if(!game || !Array.isArray(players) || !players.length) return;
  game.playerStats = game.playerStats || {};
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.trainingPlan = game.trainingPlan || {};
  game.playerAgeSkillPenalties = game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties) ? game.playerAgeSkillPenalties : {};
  players.forEach(player => {
    if(!game.playerStats[player.id] && typeof createEmptyPlayerStat === 'function') game.playerStats[player.id] = createEmptyPlayerStat(player);
    if(!game.playerCareerStats[player.id] && typeof createEmptyPlayerStat === 'function') game.playerCareerStats[player.id] = createEmptyPlayerStat(player);
    game.playerCondition[player.id] = Math.max(65, Number(game.playerCondition[player.id] || 0));
    game.playerMorale[player.id] = Math.max(60, Number(game.playerMorale[player.id] || 0));
    delete game.playerAgeSkillPenalties[player.id];
    if(typeof safeIndividualTrainingType === 'function') game.trainingPlan[player.id] = safeIndividualTrainingType(game.trainingPlan[player.id]);
  });
}
function ensureLibertadoresTeamPoolData(options={}){
  if(!LIBERTADORES_TEAM_POOL_CONFIG.enabled || !seed?.clubs || !seed?.players) return { clubs:0, players:0, migrated:0, totalClubs:0 };
  const cfg = LIBERTADORES_TEAM_POOL_CONFIG;
  const existingByKey = new Map((seed.clubs || []).map(club => [libertadoresPoolTeamKey(club.name), club]));
  const existingById = new Map((seed.clubs || []).map(club => [Number(club.id || 0), club]));
  let addedClubs = 0;
  let addedPlayers = 0;
  let migrated = 0;
  cfg.teams.forEach(team => {
    const key = libertadoresPoolTeamKey(team.name);
    let club = existingByKey.get(key) || existingById.get(Number(team.id || 0));
    if(!club){
      club = {
        id:Number(team.id),
        name:team.name,
        short:typeof clubShortFromName === 'function' ? clubShortFromName(team.name) : String(team.name).slice(0,3).toUpperCase(),
        city:team.city || '',
        country:team.country || '',
        reputation:Number(team.reputation || 50),
        budget:typeof clubBudgetByPrestige === 'function' ? clubBudgetByPrestige(Number(team.reputation || 50), 1) : 0,
        primaryColor:team.primaryColor || (typeof deterministicColor === 'function' ? deterministicColor(team.name) : '#888888'),
        divisionId:cfg.divisionId,
        divisionName:cfg.divisionName,
        divisionOrder:98,
        prizeMultiplier:1,
        libertadoresPoolClub:true,
        specialCompetitionOnly:true,
        noOwnStadium:true,
        fieldConditionScore:100,
        fieldCondition:'Excelente',
        crestPath:team.crestPath || ''
      };
      seed.clubs.push(club);
      existingByKey.set(key, club);
      existingById.set(Number(club.id), club);
      addedClubs += 1;
    }else{
      if(club.clubWorldCupInvite || String(club.divisionId || '') === String(CLUB_WORLD_CUP_CONFIG?.invitedDivisionId || 'club-world-cup-invitados')) migrated += 1;
      club.name = team.name;
      club.country = team.country || club.country || '';
      club.city = team.city || club.city || '';
      club.reputation = Number(team.reputation || club.reputation || 50);
      club.primaryColor = team.primaryColor || club.primaryColor || '#888888';
      club.crestPath = team.crestPath || club.crestPath || '';
      club.divisionId = cfg.divisionId;
      club.divisionName = cfg.divisionName;
      club.divisionOrder = 98;
      club.libertadoresPoolClub = true;
      club.specialCompetitionOnly = true;
      club.noOwnStadium = true;
    }
    club.clubWorldCupInvite = false;
    const currentPlayers = libertadoresPoolPlayersByClub(club.id).filter(player => !player.retired && !player.sold);
    currentPlayers.forEach(player => {
      player.libertadoresPoolPlayer = true;
      player.specialCompetitionOnly = true;
      delete player.clubWorldCupInvitePlayer;
      delete player.generatedForClubWorldCup;
    });
    const needed = Math.max(0, Number(cfg.rosterSize || 25) - currentPlayers.length);
    if(needed > 0){
      const activePlayers = (seed.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
      const context = typeof createPlayerGenerationContext === 'function' ? createPlayerGenerationContext(activePlayers.length + needed, activePlayers) : null;
      const startId = typeof nextPlayerId === 'function' ? nextPlayerId() : Math.max(100000, ...seed.players.map(player => Number(player?.id || 0))) + 1;
      const generated = generateLibertadoresPoolPlayers(club, team, startId, currentPlayers.length, needed, context);
      seed.players.push(...generated);
      syncLibertadoresPoolPlayerState(generated);
      addedPlayers += generated.length;
    }
    if(game){
      game.standings = game.standings || {};
      game.clubBudgets = game.clubBudgets || {};
      game.teamCohesion = game.teamCohesion || {};
      if(!game.standings[club.id]) game.standings[club.id] = { clubId:club.id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 };
      if(!Number.isFinite(Number(game.clubBudgets[club.id]))) game.clubBudgets[club.id] = Math.round(Number(club.budget || 0));
      if(!Number.isFinite(Number(game.teamCohesion[club.id]))) game.teamCohesion[club.id] = 65;
    }
  });
  if(options.markAutosave && game && (addedClubs || addedPlayers || migrated)) game._needsAutosave = true;
  return { clubs:addedClubs, players:addedPlayers, migrated, totalClubs:cfg.teams.length };
}
function libertadoresPoolClubIds(options={}){
  if(options.ensure) ensureLibertadoresTeamPoolData({ markAutosave:Boolean(options.markAutosave) });
  const keys = new Set(LIBERTADORES_TEAM_POOL_CONFIG.teams.map(team => libertadoresPoolTeamKey(team.name)));
  return (seed?.clubs || [])
    .filter(club => club?.libertadoresPoolClub && keys.has(libertadoresPoolTeamKey(club.name)))
    .map(club => Number(club.id || 0))
    .filter(Boolean);
}
