/* V9.73 · FACES persistentes, únicas y reutilizables tras el retiro. */
(() => {
  'use strict';

  const FACE_SYSTEM_VERSION = 973;
  const FACE_FILENAME_PREFIX = '1 (';
  const FACE_FILENAME_SUFFIX = ')';
  const FACE_EXTENSIONS = ['.webp','.png','.jpg','.jpeg'];
  const FACE_POOL_MAX_PROBE = 10000;
  const FACE_POOL_DEFINITIONS = [
    { id:'01_cono_sur', initialCount:1100 },
    { id:'02_brasil', initialCount:80 },
    { id:'03_resto_america', initialCount:0 },
    { id:'04_europa_occidental', initialCount:0 },
    { id:'05_europa_oriental_balcanes', initialCount:0 },
    { id:'06_africa', initialCount:0 },
    { id:'07_asia_oceania', initialCount:0 },
    { id:'08_reserva_mixta', initialCount:0 }
  ];
  const FACE_POOL_BY_ID = new Map(FACE_POOL_DEFINITIONS.map(item => [item.id, item]));

  const REGION_NATIONALITIES = {
    '01_cono_sur': new Set(['argentina','uruguay','paraguay']),
    '02_brasil': new Set(['brasil','brazil']),
    '03_resto_america': new Set([
      'chile','bolivia','peru','ecuador','colombia','venezuela','mexico','estados-unidos','canada',
      'costa-rica','panama','honduras','guatemala','el-salvador','nicaragua','republica-dominicana',
      'cuba','haiti','jamaica','trinidad-y-tobago'
    ]),
    '04_europa_occidental': new Set([
      'espana','italia','inglaterra','francia','alemania','portugal','paises-bajos','belgica','suiza','austria',
      'irlanda','escocia','gales','dinamarca','noruega','suecia','finlandia','islandia','luxemburgo'
    ]),
    '05_europa_oriental_balcanes': new Set([
      'rumania','serbia','croacia','bosnia-y-herzegovina','bosnia','bulgaria','hungria','polonia','republica-checa',
      'chequia','eslovaquia','ucrania','rusia','albania','eslovenia','montenegro','macedonia-del-norte','macedonia',
      'moldavia','moldova','grecia','turquia','georgia','armenia','azerbaiyan'
    ]),
    '06_africa': new Set([
      'nigeria','ghana','senegal','camerun','costa-de-marfil','marruecos','argelia','tunez','egipto','mali','sudafrica',
      'guinea','gambia','burkina-faso','benin','togo','gabon','republica-democratica-del-congo','rd-congo','congo',
      'angola','mozambique','zambia','zimbabue','kenia','uganda','tanzania','etiopia','cabo-verde'
    ]),
    '07_asia_oceania': new Set([
      'japon','corea-del-sur','corea','china','australia','nueva-zelanda','arabia-saudita','iran','irak','qatar',
      'emiratos-arabes-unidos','uzbekistan','kazajistan','india','tailandia','vietnam','indonesia','malasia','filipinas'
    ])
  };

  let saveTimer = null;
  let discoveryStarted = false;
  let bootstrapAttempts = 0;

  function facesNumber(value, fallback=0){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function facesHash(text, max=1000000){
    if(typeof hashNumber === 'function') return Math.abs(Number(hashNumber(String(text), max)) || 0) % Math.max(1, max);
    let hash = 2166136261;
    const source = String(text || '');
    for(let i=0;i<source.length;i++){
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % Math.max(1, max);
  }
  function facesNationalitySlug(value){
    if(typeof playerNationalityImageSlug === 'function') return playerNationalityImageSlug(value);
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function facesPlayerId(player){ return Math.max(0, Math.round(facesNumber(player?.id, 0))); }
  function facesCareerKey(){
    return String(game?.careerId || game?.saveCode || game?.startedAt || game?.managerName || game?.selectedClubId || 'career');
  }
  function facesState(){
    if(!game) return null;
    const raw = game.playerFacesV973 && typeof game.playerFacesV973 === 'object' && !Array.isArray(game.playerFacesV973)
      ? game.playerFacesV973
      : {};
    raw.version = FACE_SYSTEM_VERSION;
    raw.assignments = raw.assignments && typeof raw.assignments === 'object' && !Array.isArray(raw.assignments) ? raw.assignments : {};
    raw.poolCounts = raw.poolCounts && typeof raw.poolCounts === 'object' && !Array.isArray(raw.poolCounts) ? raw.poolCounts : {};
    raw.releasedCount = Math.max(0, Math.round(facesNumber(raw.releasedCount, 0)));
    raw.assignedCount = Math.max(0, Math.round(facesNumber(raw.assignedCount, 0)));
    FACE_POOL_DEFINITIONS.forEach(pool => {
      const stored = Math.max(0, Math.round(facesNumber(raw.poolCounts[pool.id], pool.initialCount)));
      raw.poolCounts[pool.id] = Math.max(pool.initialCount, stored);
    });
    game.playerFacesV973 = raw;
    return raw;
  }
  function facesPoolCount(poolId){
    const pool = FACE_POOL_BY_ID.get(String(poolId || ''));
    if(!pool) return 0;
    const state = facesState();
    return Math.max(0, Math.round(facesNumber(state?.poolCounts?.[pool.id], pool.initialCount)));
  }
  function facesBasePath(poolId, index){
    return `FACES/${poolId}/${FACE_FILENAME_PREFIX}${Math.max(1, Math.round(facesNumber(index, 1)))}${FACE_FILENAME_SUFFIX}`;
  }
  function facesPoolIdFromBase(base){
    const match = String(base || '').match(/^FACES\/([^/]+)\/1 \(\d+\)$/);
    return match ? match[1] : '';
  }
  function facesPoolIndexFromBase(base){
    const match = String(base || '').match(/\/1 \((\d+)\)$/);
    return match ? Math.max(0, Math.round(Number(match[1] || 0))) : 0;
  }
  function facesPrimaryPool(player){
    const slug = facesNationalitySlug(player?.nationality);
    for(const [poolId, set] of Object.entries(REGION_NATIONALITIES)){
      if(set.has(slug)) return poolId;
    }
    return '08_reserva_mixta';
  }
  function facesPoolPreference(player){
    const primary = facesPrimaryPool(player);
    const list = [primary];
    const slug = facesNationalitySlug(player?.nationality);
    if(slug === 'chile') list.push('01_cono_sur');
    list.push('08_reserva_mixta');
    return Array.from(new Set(list));
  }
  function facesCurrentProfessionalPlayers(){
    const list = Array.isArray(seed?.players) ? seed.players : [];
    const seen = new Set();
    return list.filter(player => {
      const id = facesPlayerId(player);
      if(!id || player?.retired || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  function facesActiveProfessionalIds(){
    return new Set(facesCurrentProfessionalPlayers().map(player => facesPlayerId(player)));
  }
  function facesPruneRetiredAssignments(){
    const state = facesState();
    if(!state) return 0;
    const activeIds = facesActiveProfessionalIds();
    const retiredIds = new Set((Array.isArray(game?.retiredPlayerPool) ? game.retiredPlayerPool : [])
      .map(item => Math.max(0, Math.round(facesNumber(item?.previousPlayerId, 0))))
      .filter(Boolean));
    let removed = 0;
    Object.keys(state.assignments).forEach(key => {
      const id = Math.max(0, Math.round(Number(key || 0)));
      if(id && retiredIds.has(id) && !activeIds.has(id)){
        delete state.assignments[key];
        removed++;
      }
    });
    if(removed) state.releasedCount += removed;
    return removed;
  }
  function facesRepairDuplicates(){
    const state = facesState();
    if(!state) return 0;
    const activeIds = facesActiveProfessionalIds();
    const entries = Object.entries(state.assignments)
      .map(([key, base]) => [Math.max(0, Math.round(Number(key || 0))), String(base || '')])
      .filter(([id, base]) => id && base && activeIds.has(id))
      .sort((a,b) => a[0] - b[0]);
    const used = new Set();
    let removed = 0;
    entries.forEach(([id, base]) => {
      const poolId = facesPoolIdFromBase(base);
      const index = facesPoolIndexFromBase(base);
      const valid = poolId && FACE_POOL_BY_ID.has(poolId) && index > 0 && index <= facesPoolCount(poolId);
      if(!valid || used.has(base)){
        delete state.assignments[String(id)];
        removed++;
        return;
      }
      used.add(base);
    });
    return removed;
  }
  function facesUsedSet(){
    const state = facesState();
    if(!state) return new Set();
    const activeIds = facesActiveProfessionalIds();
    return new Set(Object.entries(state.assignments)
      .filter(([key, base]) => activeIds.has(Math.max(0, Math.round(Number(key || 0)))) && String(base || ''))
      .map(([,base]) => String(base)));
  }
  function facesAvailableByPool(usedSet=facesUsedSet()){
    const result = new Map();
    FACE_POOL_DEFINITIONS.forEach(pool => {
      const available = [];
      const count = facesPoolCount(pool.id);
      for(let index=1; index<=count; index++){
        const base = facesBasePath(pool.id, index);
        if(!usedSet.has(base)) available.push(base);
      }
      result.set(pool.id, available);
    });
    return result;
  }
  function facesPickFromPool(player, poolId, availableByPool){
    const list = availableByPool.get(poolId) || [];
    if(!list.length) return '';
    const pickIndex = facesHash(`${facesCareerKey()}|${facesPlayerId(player)}|${poolId}|face`, list.length);
    return list.splice(pickIndex, 1)[0] || '';
  }
  function facesScheduleSave(){
    if(saveTimer || typeof saveLocal !== 'function') return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      Promise.resolve(saveLocal(true)).catch(error => console.warn('No se pudieron guardar las FACES asignadas.', error));
    }, 300);
  }
  function assignFacesToMissingPlayers(options={}){
    const state = facesState();
    if(!state || !seed?.players) return { assigned:0, released:0, repaired:0 };
    const released = facesPruneRetiredAssignments();
    const repaired = facesRepairDuplicates();
    const players = facesCurrentProfessionalPlayers()
      .filter(player => !String(state.assignments[String(facesPlayerId(player))] || ''))
      .sort((a,b) => {
        const ah = facesHash(`${facesCareerKey()}|${facesPlayerId(a)}|order`, 1000000000);
        const bh = facesHash(`${facesCareerKey()}|${facesPlayerId(b)}|order`, 1000000000);
        return ah - bh || facesPlayerId(a) - facesPlayerId(b);
      });
    const available = facesAvailableByPool();
    let assigned = 0;
    players.forEach(player => {
      let selected = '';
      for(const poolId of facesPoolPreference(player)){
        selected = facesPickFromPool(player, poolId, available);
        if(selected) break;
      }
      if(!selected) return;
      state.assignments[String(facesPlayerId(player))] = selected;
      assigned++;
    });
    if(assigned) state.assignedCount += assigned;
    state.lastAssignmentSeason = Math.max(1, Math.round(facesNumber(game?.seasonNumber, 1)));
    state.lastAssignmentDate = String(game?.currentDate || '');
    if((assigned || released || repaired) && options.save !== false) facesScheduleSave();
    return { assigned, released, repaired };
  }
  function assignedFaceBaseForPlayer(player){
    if(!game || !player) return '';
    const id = facesPlayerId(player);
    if(!id || player.retired) return '';
    const state = facesState();
    if(!state) return '';
    const existing = String(state.assignments[String(id)] || '');
    if(existing) return existing;
    assignFacesToMissingPlayers({ save:true });
    return String(state.assignments[String(id)] || '');
  }
  function releasePlayerFaceAssignment(playerId, options={}){
    const state = facesState();
    const id = Math.max(0, Math.round(facesNumber(playerId, 0)));
    if(!state || !id || !state.assignments[String(id)]) return false;
    delete state.assignments[String(id)];
    state.releasedCount += 1;
    if(options.save !== false) facesScheduleSave();
    return true;
  }
  function releaseRetiredPlayerFaces(players=[]){
    let released = 0;
    (Array.isArray(players) ? players : []).forEach(player => {
      if(releasePlayerFaceAssignment(facesPlayerId(player), { save:false })) released++;
    });
    if(released) facesScheduleSave();
    return released;
  }

  function faceProbeExists(base){
    if(typeof Image === 'undefined') return Promise.resolve(false);
    const tryExt = index => new Promise(resolve => {
      if(index >= FACE_EXTENSIONS.length){ resolve(false); return; }
      const img = new Image();
      let settled = false;
      const finish = value => {
        if(settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), 1800);
      img.onload = () => { clearTimeout(timer); finish(true); };
      img.onerror = () => { clearTimeout(timer); tryExt(index + 1).then(resolve); };
      img.src = `${base}${FACE_EXTENSIONS[index]}?face-probe=${FACE_SYSTEM_VERSION}`;
    });
    return tryExt(0);
  }
  async function discoverFacePoolCount(poolId, currentCount){
    let current = Math.max(0, Math.round(facesNumber(currentCount, 0)));
    const firstCandidate = current + 1;
    if(firstCandidate > FACE_POOL_MAX_PROBE || !(await faceProbeExists(facesBasePath(poolId, firstCandidate)))) return current;
    let lastExisting = firstCandidate;
    let step = 1;
    let firstMissing = Math.min(FACE_POOL_MAX_PROBE + 1, firstCandidate + step);
    while(firstMissing <= FACE_POOL_MAX_PROBE && await faceProbeExists(facesBasePath(poolId, firstMissing))){
      lastExisting = firstMissing;
      step *= 2;
      firstMissing = Math.min(FACE_POOL_MAX_PROBE + 1, firstCandidate + step);
    }
    let low = lastExisting + 1;
    let high = Math.min(FACE_POOL_MAX_PROBE, firstMissing - 1);
    while(low <= high){
      const mid = Math.floor((low + high) / 2);
      if(await faceProbeExists(facesBasePath(poolId, mid))){ lastExisting = mid; low = mid + 1; }
      else high = mid - 1;
    }
    return lastExisting;
  }
  async function discoverNewFaceAssets(){
    if(discoveryStarted || !game) return { grown:0, pools:[] };
    discoveryStarted = true;
    const state = facesState();
    const changes = [];
    for(const pool of FACE_POOL_DEFINITIONS){
      const current = facesPoolCount(pool.id);
      const detected = await discoverFacePoolCount(pool.id, current);
      if(detected > current){
        state.poolCounts[pool.id] = detected;
        changes.push({ poolId:pool.id, before:current, after:detected });
      }
    }
    if(changes.length){
      const result = assignFacesToMissingPlayers({ save:false });
      state.lastDiscoveryDate = String(game?.currentDate || '');
      state.lastDiscoveryVersion = FACE_SYSTEM_VERSION;
      facesScheduleSave();
      return { grown:changes.reduce((sum,item)=>sum + item.after-item.before,0), pools:changes, assigned:result.assigned };
    }
    state.lastDiscoveryVersion = FACE_SYSTEM_VERSION;
    return { grown:0, pools:[] };
  }

  function installRetirementFaceReleaseHook(){
    if(typeof window === 'undefined' || typeof window.retireSeasonVeterans !== 'function' || window.retireSeasonVeterans.__facesV973Wrapped) return;
    const original = window.retireSeasonVeterans;
    const wrapped = function(...args){
      const retirees = original.apply(this, args) || [];
      if(Array.isArray(retirees) && retirees.length){
        releaseRetiredPlayerFaces(retirees);
        assignFacesToMissingPlayers({ save:true });
      }
      return retirees;
    };
    wrapped.__facesV973Wrapped = true;
    window.retireSeasonVeterans = wrapped;
  }
  function bootstrapPlayerFaces(){
    bootstrapAttempts += 1;
    installRetirementFaceReleaseHook();
    if(!game || !seed?.players){
      if(bootstrapAttempts < 40) setTimeout(bootstrapPlayerFaces, 250);
      return;
    }
    assignFacesToMissingPlayers({ save:true });
    setTimeout(() => { discoverNewFaceAssets().catch(error => console.warn('No se pudo comprobar crecimiento de FACES.', error)); }, 700);
  }

  if(typeof window !== 'undefined'){
    window.assignedFaceBaseForPlayer = assignedFaceBaseForPlayer;
    window.assignFacesToMissingPlayers = assignFacesToMissingPlayers;
    window.releasePlayerFaceAssignment = releasePlayerFaceAssignment;
    window.releaseRetiredPlayerFaces = releaseRetiredPlayerFaces;
    window.discoverNewFaceAssets = discoverNewFaceAssets;
    window.playerFacePoolsV973 = FACE_POOL_DEFINITIONS.map(item => ({ ...item }));
    setTimeout(bootstrapPlayerFaces, 0);
  }
})();
