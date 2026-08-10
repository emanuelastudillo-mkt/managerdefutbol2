/* V9.54 · Bolsa de clubes europeos preparada para la futura Champions League. */

const CHAMPIONS_TEAM_POOL_CONFIG = Object.freeze({
  enabled:true,
  name:'Bolsa Champions League',
  divisionId:'champions-bolsa',
  divisionName:'Bolsa Champions League',
  rosterSize:25,
  rosterVersion:'V9.54',
  teams:Object.freeze([
    { id:930001, name:'Bayern Múnich', country:'Alemania', city:'Múnich', reputation:90, primaryColor:'#DC052D', crestPath:'img/escudos/Bayern_Múnich.png', nationalityPool:['Alemania','Alemania','Alemania','Alemania','Alemania','Alemania','Francia','Países Bajos','Portugal','Inglaterra'] },
    { id:930002, name:'Borussia Dortmund', country:'Alemania', city:'Dortmund', reputation:84, primaryColor:'#FDE100', crestPath:'img/escudos/Borussia_Dortmund.png', nationalityPool:['Alemania','Alemania','Alemania','Alemania','Alemania','Alemania','Francia','Países Bajos','Inglaterra','Croacia'] },
    { id:930003, name:'Bayer Leverkusen', country:'Alemania', city:'Leverkusen', reputation:85, primaryColor:'#E32221', crestPath:'img/escudos/Bayer_Leverkusen.png', nationalityPool:['Alemania','Alemania','Alemania','Alemania','Alemania','Alemania','Francia','Países Bajos','Brasil','Croacia'] },
    { id:930004, name:'RB Leipzig', country:'Alemania', city:'Leipzig', reputation:80, primaryColor:'#DD0741', crestPath:'img/escudos/RB_Leipzig.png', nationalityPool:['Alemania','Alemania','Alemania','Alemania','Alemania','Alemania','Francia','Países Bajos','Croacia','Inglaterra'] },

    { id:930005, name:'Paris Saint-Germain', country:'Francia', city:'París', reputation:90, primaryColor:'#004170', crestPath:'img/escudos/Paris_Saint-Germain.png', nationalityPool:['Francia','Francia','Francia','Francia','Francia','Francia','Brasil','Portugal','España','Senegal'] },
    { id:930006, name:'Olympique de Marsella', country:'Francia', city:'Marsella', reputation:78, primaryColor:'#2FAEE0', crestPath:'img/escudos/Olympique_de_Marsella.png', nationalityPool:['Francia','Francia','Francia','Francia','Francia','Francia','Marruecos','Senegal','Portugal','Argentina'] },

    { id:930007, name:'Benfica', country:'Portugal', city:'Lisboa', reputation:82, primaryColor:'#E30613', crestPath:'img/escudos/Benfica.png', nationalityPool:['Portugal','Portugal','Portugal','Portugal','Portugal','Portugal','Brasil','España','Argentina','Uruguay'] },
    { id:930008, name:'Porto', country:'Portugal', city:'Oporto', reputation:81, primaryColor:'#00428C', crestPath:'img/escudos/Porto.png', nationalityPool:['Portugal','Portugal','Portugal','Portugal','Portugal','Portugal','Brasil','España','Argentina','Colombia'] },

    { id:930009, name:'Zenit San Petersburgo', country:'Rusia', city:'San Petersburgo', reputation:76, primaryColor:'#009FE3', crestPath:'img/escudos/Zenit_San_Petersburgo.png', nationalityPool:['Rusia','Rusia','Rusia','Rusia','Rusia','Rusia','Serbia','Croacia','Brasil','Colombia'] },
    { id:930010, name:'CSKA Moscú', country:'Rusia', city:'Moscú', reputation:70, primaryColor:'#D71920', crestPath:'img/escudos/CSKA_Moscú.png', nationalityPool:['Rusia','Rusia','Rusia','Rusia','Rusia','Rusia','Serbia','Croacia','Bulgaria','Brasil'] },

    { id:930011, name:'PSV Eindhoven', country:'Países Bajos', city:'Eindhoven', reputation:82, primaryColor:'#E30613', crestPath:'img/escudos/PSV_Eindhoven.png', nationalityPool:['Países Bajos','Países Bajos','Países Bajos','Países Bajos','Países Bajos','Países Bajos','Bélgica','Alemania','Brasil','Inglaterra'] },
    { id:930012, name:'Ajax', country:'Países Bajos', city:'Ámsterdam', reputation:79, primaryColor:'#D2122E', crestPath:'img/escudos/Ajax.png', nationalityPool:['Países Bajos','Países Bajos','Países Bajos','Países Bajos','Países Bajos','Países Bajos','Bélgica','Dinamarca','Alemania','Ghana'] },

    { id:930013, name:'Olympiacos', country:'Grecia', city:'El Pireo', reputation:71, primaryColor:'#E30613', crestPath:'img/escudos/Olympiacos.png', nationalityPool:['Grecia','Grecia','Grecia','Grecia','Grecia','Grecia','Serbia','Croacia','Portugal','Argentina'] },
    { id:930014, name:'Panathinaikos', country:'Grecia', city:'Atenas', reputation:68, primaryColor:'#117B45', crestPath:'img/escudos/Panathinaikos.png', nationalityPool:['Grecia','Grecia','Grecia','Grecia','Grecia','Grecia','Serbia','Croacia','Bulgaria','Portugal'] },

    { id:930015, name:'Club Brujas', country:'Bélgica', city:'Brujas', reputation:74, primaryColor:'#0055A4', crestPath:'img/escudos/Club_Brujas.png', nationalityPool:['Bélgica','Bélgica','Bélgica','Bélgica','Bélgica','Bélgica','Países Bajos','Francia','Ghana','Nigeria'] },
    { id:930016, name:'Anderlecht', country:'Bélgica', city:'Bruselas', reputation:69, primaryColor:'#5B2A86', crestPath:'img/escudos/Anderlecht.png', nationalityPool:['Bélgica','Bélgica','Bélgica','Bélgica','Bélgica','Bélgica','Francia','Países Bajos','Ghana','Senegal'] },

    { id:930017, name:'Celtic', country:'Escocia', city:'Glasgow', reputation:75, primaryColor:'#008749', crestPath:'img/escudos/Celtic.png', nationalityPool:['Escocia','Escocia','Escocia','Escocia','Escocia','Escocia','Inglaterra','Irlanda','Países Bajos','Japón'] },
    { id:930018, name:'Rangers', country:'Escocia', city:'Glasgow', reputation:73, primaryColor:'#005EB8', crestPath:'img/escudos/Rangers.png', nationalityPool:['Escocia','Escocia','Escocia','Escocia','Escocia','Escocia','Inglaterra','Irlanda','Países Bajos','Nigeria'] },

    { id:930019, name:'FC Copenhague', country:'Dinamarca', city:'Copenhague', reputation:69, primaryColor:'#FFFFFF', crestPath:'img/escudos/FC_Copenhague.png', nationalityPool:['Dinamarca','Dinamarca','Dinamarca','Dinamarca','Dinamarca','Dinamarca','Países Bajos','Alemania','Escocia','Ghana'] },
    { id:930020, name:'Sparta Praga', country:'República Checa', city:'Praga', reputation:69, primaryColor:'#7A1E2C', crestPath:'img/escudos/Sparta_Praga.png', nationalityPool:['República Checa','República Checa','República Checa','República Checa','República Checa','República Checa','Croacia','Serbia','Alemania','Hungría'] }
  ])
});

function championsPoolTeamKey(name){
  if(typeof clubWorldCupTeamKey === 'function') return clubWorldCupTeamKey(name);
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function championsPoolDefinitions(){
  return CHAMPIONS_TEAM_POOL_CONFIG.teams.map(team => ({ ...team, nationalityPool:[...(team.nationalityPool || [])] }));
}
function championsPoolTeamIds(){
  return CHAMPIONS_TEAM_POOL_CONFIG.teams.map(team => Number(team.id || 0)).filter(Boolean);
}
function championsPoolRosterBlueprint(){
  return typeof generationRosterBlueprint === 'function'
    ? generationRosterBlueprint()
    : ['POR','POR','POR','LD','LI','DFC','DFC','DFC','LD','LI','MCD','MCD','MC','MC','MCO','MCO','MI','MD','ED','EI','ED','EI','DC','DC','DC'];
}
function championsPoolMediaRange(team, rosterIndex=0){
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
function championsPoolNationality(team, rosterIndex=0, playerId=0){
  const pool = Array.isArray(team?.nationalityPool) && team.nationalityPool.length ? team.nationalityPool : [team?.country || 'Alemania'];
  const index = typeof hashNumber === 'function'
    ? hashNumber(`champions-pool-nationality-${team?.name || ''}-${rosterIndex}-${playerId}`, pool.length)
    : Math.abs((Number(playerId || 0) + Number(rosterIndex || 0))) % pool.length;
  return String(pool[index] || team?.country || 'Alemania');
}
function championsPoolNameCountry(nationality){
  const aliases = {
    'Rusia':'Serbia',
    'Grecia':'Bulgaria',
    'Bélgica':'Países Bajos',
    'Dinamarca':'Alemania',
    'República Checa':'Hungría'
  };
  return aliases[String(nationality || '')] || String(nationality || 'Alemania');
}
function championsPoolPlayersByClub(clubId){
  if(typeof playersByClub === 'function') return playersByClub(Number(clubId || 0));
  return (seed?.players || []).filter(player => Number(player?.clubId || 0) === Number(clubId || 0));
}
function generateChampionsPoolPlayers(club, team, startId, fromRosterIndex=0, count=0, generationContext=null){
  const blueprint = championsPoolRosterBlueprint();
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
      ? 23 + (typeof hashNumber === 'function' ? hashNumber(`champions-pool-age-${team.name}-${id}`, 13) : (id % 13))
      : 18 + (typeof hashNumber === 'function' ? hashNumber(`champions-pool-age-${team.name}-${id}`, 15) : (id % 15));
    const range = championsPoolMediaRange(team, rosterIndex);
    const nationality = championsPoolNationality(team, rosterIndex, id);
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
      nationalityOverride:nationality,
      localCountry:team.country || club.country || 'Alemania'
    });
    const nameCountry = championsPoolNameCountry(nationality);
    if(nameCountry !== nationality && typeof generatedPlayerName === 'function'){
      player.name = generatedPlayerName(id, club.name, nameCountry);
    }
    generated.push({
      ...player,
      nationality,
      clubId:club.id,
      championsPoolPlayer:true,
      specialCompetitionOnly:true,
      generatedForChampionsPool:true,
      championsRosterVersion:CHAMPIONS_TEAM_POOL_CONFIG.rosterVersion
    });
  }
  return generated;
}
function syncChampionsPoolPlayerState(players=[]){
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
function ensureChampionsTeamPoolData(options={}){
  if(!CHAMPIONS_TEAM_POOL_CONFIG.enabled || !seed?.clubs || !seed?.players) return { clubs:0, players:0, migrated:0, totalClubs:0 };
  const cfg = CHAMPIONS_TEAM_POOL_CONFIG;
  const existingByKey = new Map((seed.clubs || []).map(club => [championsPoolTeamKey(club.name), club]));
  const existingById = new Map((seed.clubs || []).map(club => [Number(club.id || 0), club]));
  let addedClubs = 0;
  let addedPlayers = 0;
  let migrated = 0;
  cfg.teams.forEach(team => {
    const key = championsPoolTeamKey(team.name);
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
        divisionOrder:97,
        prizeMultiplier:1,
        championsPoolClub:true,
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
      if(!club.championsPoolClub || String(club.divisionId || '') !== String(cfg.divisionId)) migrated += 1;
      club.name = team.name;
      club.country = team.country || club.country || '';
      club.city = team.city || club.city || '';
      club.reputation = Number(team.reputation || club.reputation || 50);
      club.primaryColor = team.primaryColor || club.primaryColor || '#888888';
      club.crestPath = team.crestPath || club.crestPath || '';
      club.divisionId = cfg.divisionId;
      club.divisionName = cfg.divisionName;
      club.divisionOrder = 97;
      club.championsPoolClub = true;
      club.specialCompetitionOnly = true;
      club.noOwnStadium = true;
    }
    club.clubWorldCupInvite = false;
    club.libertadoresPoolClub = false;
    const currentPlayers = championsPoolPlayersByClub(club.id).filter(player => !player.retired && !player.sold);
    currentPlayers.forEach(player => {
      player.championsPoolPlayer = true;
      player.specialCompetitionOnly = true;
      delete player.clubWorldCupInvitePlayer;
      delete player.generatedForClubWorldCup;
      delete player.libertadoresPoolPlayer;
      delete player.generatedForLibertadoresPool;
    });
    const needed = Math.max(0, Number(cfg.rosterSize || 25) - currentPlayers.length);
    if(needed > 0){
      const activePlayers = (seed.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
      const context = typeof createPlayerGenerationContext === 'function' ? createPlayerGenerationContext(activePlayers.length + needed, activePlayers) : null;
      const startId = typeof nextPlayerId === 'function' ? nextPlayerId() : Math.max(100000, ...seed.players.map(player => Number(player?.id || 0))) + 1;
      const generated = generateChampionsPoolPlayers(club, team, startId, currentPlayers.length, needed, context);
      seed.players.push(...generated);
      syncChampionsPoolPlayerState(generated);
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
function championsPoolClubIds(options={}){
  if(options.ensure) ensureChampionsTeamPoolData({ markAutosave:Boolean(options.markAutosave) });
  const keys = new Set(CHAMPIONS_TEAM_POOL_CONFIG.teams.map(team => championsPoolTeamKey(team.name)));
  return (seed?.clubs || [])
    .filter(club => club?.championsPoolClub && keys.has(championsPoolTeamKey(club.name)))
    .map(club => Number(club.id || 0))
    .filter(Boolean);
}
