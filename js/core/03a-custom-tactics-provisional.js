/* V8.49 provisoria · Táctica personalizada por casillas sin retirar las formaciones predefinidas. */

const CUSTOM_TACTIC_LAYOUT_MODE = 'custom';
const PRESET_TACTIC_LAYOUT_MODE = 'preset';
const CUSTOM_TACTIC_CELLS = (() => {
  const cells = [{ id:'gk-c', role:'POR', x:8, y:50, line:'gk', label:'POR' }];
  const rows = [16,33,50,67,84];
  const columns = [
    { key:'def', x:22, roles:['LI','DFC','DFC','DFC','LD'] },
    { key:'dm', x:36, roles:['LI','MCD','MCD','MCD','LD'] },
    { key:'mid', x:50, roles:['MI','MC','MC','MC','MD'] },
    { key:'am', x:64, roles:['MI','MCO','MCO','MCO','MD'] },
    { key:'att', x:78, roles:['EI','MCO','DC','MCO','ED'] },
    { key:'fwd', x:90, roles:['EI','DC','DC','DC','ED'] }
  ];
  columns.forEach(column => rows.forEach((y,index) => cells.push({
    id:`${column.key}-${index + 1}`,
    role:column.roles[index],
    x:column.x,
    y,
    line:slotGroup(column.roles[index]),
    label:column.roles[index]
  })));
  return cells;
})();
const CUSTOM_TACTIC_CELL_MAP = new Map(CUSTOM_TACTIC_CELLS.map(cell => [cell.id, cell]));

function normalizeTacticLayoutMode(value){
  const clean = String(value || '').trim().toLowerCase();
  return ['custom','personalizada','personalizada-prueba','personalizada prueba'].includes(clean)
    ? CUSTOM_TACTIC_LAYOUT_MODE
    : PRESET_TACTIC_LAYOUT_MODE;
}
function isCustomTactic(tactic){ return normalizeTacticLayoutMode(tactic?.layoutMode) === CUSTOM_TACTIC_LAYOUT_MODE; }
function customTacticCell(cellId){ return CUSTOM_TACTIC_CELL_MAP.get(String(cellId || '')) || null; }
function customTacticCellRole(cellId){ return customTacticCell(cellId)?.role || 'MC'; }
function customTacticCellIndex(cellId){ return CUSTOM_TACTIC_CELLS.findIndex(cell => cell.id === String(cellId || '')); }
function customTacticDistance(cell, target){
  if(!cell || !target) return 9999;
  const rolePenalty = cell.role === target.role ? 0 : (slotGroup(cell.role) === slotGroup(target.role) ? 120 : 500);
  return rolePenalty + Math.abs(Number(cell.x) - Number(target.x)) * 2 + Math.abs(Number(cell.y) - Number(target.y));
}
function customTacticSlotsFromPreset(tactic){
  const formation = FORMATIONS[tactic?.formation] ? tactic.formation : '4-4-2';
  const roles = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const coords = typeof formationCoordinates === 'function' ? formationCoordinates(formation) : roles.map((_,index) => ({ x:15 + index * 6, y:50 }));
  const used = new Set();
  const selected = [];
  roles.slice(0,11).forEach((role,index) => {
    const target = { role, x:coords[index]?.x ?? 50, y:coords[index]?.y ?? 50 };
    const candidates = CUSTOM_TACTIC_CELLS.filter(cell => !used.has(cell.id) && (role === 'POR' ? cell.role === 'POR' : cell.role !== 'POR'));
    candidates.sort((a,b) => customTacticDistance(a,target) - customTacticDistance(b,target) || customTacticCellIndex(a.id) - customTacticCellIndex(b.id));
    const pick = candidates[0];
    if(pick){ used.add(pick.id); selected.push(pick.id); }
  });
  return selected.slice(0,11);
}
function normalizeCustomTacticSlots(rawSlots, tactic=null){
  const unique = [];
  (Array.isArray(rawSlots) ? rawSlots : []).forEach(value => {
    const id = String(value || '');
    if(customTacticCell(id) && !unique.includes(id) && unique.length < 11) unique.push(id);
  });
  if(!unique.length) customTacticSlotsFromPreset(tactic || {}).forEach(id => unique.push(id));
  const fallback = customTacticSlotsFromPreset(tactic || {});
  fallback.concat(CUSTOM_TACTIC_CELLS.map(cell => cell.id)).forEach(id => {
    if(unique.length < 11 && !unique.includes(id)) unique.push(id);
  });
  return unique.slice(0,11);
}
function tacticRoleSlots(tactic){
  if(isCustomTactic(tactic)){
    return normalizeCustomTacticSlots(tactic?.customSlots, tactic).map(customTacticCellRole);
  }
  const formation = FORMATIONS[tactic?.formation] ? tactic.formation : '4-4-2';
  return (FORMATIONS[formation] || FORMATIONS['4-4-2']).slice(0,11);
}
function tacticSlotCoordinates(tactic){
  if(isCustomTactic(tactic)){
    return normalizeCustomTacticSlots(tactic?.customSlots, tactic).map(id => {
      const cell = customTacticCell(id);
      return { x:cell?.x ?? 50, y:cell?.y ?? 50, cellId:id };
    });
  }
  return (typeof formationCoordinates === 'function' ? formationCoordinates(tactic?.formation || '4-4-2') : []).map(item => ({ ...item }));
}
function customTacticPitchSlots(tactic){
  const roles = tacticRoleSlots(tactic);
  const coords = tacticSlotCoordinates(tactic);
  const starters = Array.isArray(tactic?.starters) ? tactic.starters : [];
  return roles.map((slot,index) => {
    const player = playerById(starters[index]);
    return { player, slot, index, x:coords[index]?.x ?? 50, y:coords[index]?.y ?? 50, cellId:coords[index]?.cellId || '', mentality:player ? playerMentality(player.id,tactic) : 'normal' };
  });
}
function tacticAssignedEntries(tactic, options={}){
  const sentOffIds = options?.sentOffIds instanceof Set ? options.sentOffIds : new Set();
  const roles = tacticRoleSlots(tactic);
  const coords = tacticSlotCoordinates(tactic);
  return (tactic?.starters || []).slice(0,11).map((id,index) => {
    const player = playerById(id);
    if(!player || sentOffIds.has(Number(player.id))) return null;
    const slot = roles[index] || player.position || 'MC';
    return { player, slot, factor:playerTacticFitFactor(player,slot), index, cellId:coords[index]?.cellId || '', x:coords[index]?.x ?? 50, y:coords[index]?.y ?? 50 };
  }).filter(Boolean);
}
function arrangePlayerIdsForRoleSlots(playerIds, roles){
  const remaining = (playerIds || []).map(playerById).filter(Boolean);
  const ordered = [];
  (roles || []).slice(0,11).forEach(slot => {
    if(!remaining.length){ ordered.push(0); return; }
    let bestIndex = -1;
    let bestScore = -Infinity;
    remaining.forEach((player,index) => {
      const allowed = canAssignPlayerToSlot(player,slot);
      const score = allowed ? botFormationPlayerScore(player,slot) : -100000;
      if(score > bestScore){ bestScore = score; bestIndex = index; }
    });
    if(bestIndex < 0){ ordered.push(0); return; }
    ordered.push(Number(remaining.splice(bestIndex,1)[0].id));
  });
  return ordered.slice(0,11);
}
function switchTacticLayoutMode(mode){
  if(!game?.tactic) return false;
  const target = normalizeTacticLayoutMode(mode);
  game.tactic = normalizeTactic(game.selectedClubId,game.tactic);
  if(target === CUSTOM_TACTIC_LAYOUT_MODE){
    game.tactic.layoutMode = CUSTOM_TACTIC_LAYOUT_MODE;
    game.tactic.customSlots = normalizeCustomTacticSlots(game.tactic.customSlots,game.tactic);
  }else{
    const ids = (game.tactic.starters || []).map(Number).filter(Boolean);
    game.tactic.layoutMode = PRESET_TACTIC_LAYOUT_MODE;
    const roles = FORMATIONS[game.tactic.formation] || FORMATIONS['4-4-2'];
    const reordered = arrangePlayerIdsForRoleSlots(ids,roles);
    while(reordered.length < 11) reordered.push(0);
    game.tactic.starters = reordered;
  }
  game.tactic = ensureTacticCaptain(applyStarterMentalities(game.tactic),game.selectedClubId);
  saveLocal(true);
  if(typeof renderTactics === 'function') renderTactics();
  return true;
}
function autoSelectStartersForTacticLayout(clubId,tactic){
  if(!isCustomTactic(tactic)) return autoSelectStarters(clubId,tactic);
  const squad = playersByClub(clubId).filter(player => !isUnavailable(player.id));
  const used = new Set();
  return tacticRoleSlots(tactic).map(slot => {
    const candidates = squad.filter(player => !used.has(player.id) && canAssignPlayerToSlot(player,slot));
    candidates.sort((a,b) => botFormationPlayerScore(b,slot) - botFormationPlayerScore(a,slot));
    const pick = candidates[0] || null;
    if(pick) used.add(pick.id);
    return pick;
  }).filter(Boolean);
}
function autoSelectByBestConditionForTactic(clubId,tactic){
  if(!isCustomTactic(tactic)) return autoSelectByBestCondition(clubId);
  const squad = playersByClub(clubId).filter(player => !isUnavailable(player.id));
  const used = new Set();
  return tacticRoleSlots(tactic).map(slot => {
    const candidates = squad.filter(player => !used.has(player.id) && canAssignPlayerToSlot(player,slot));
    candidates.sort((a,b) => conditionSelectionScoreForSlot(b,slot) - conditionSelectionScoreForSlot(a,slot));
    const pick = candidates[0] || null;
    if(pick) used.add(pick.id);
    return pick;
  }).filter(Boolean);
}
function customTacticSideCounts(roles){
  const leftRoles = new Set(['LI','MI','EI']);
  const rightRoles = new Set(['LD','MD','ED']);
  return {
    left:(roles || []).filter(role => leftRoles.has(role)).length,
    right:(roles || []).filter(role => rightRoles.has(role)).length
  };
}
function customTacticBalanceProfile(tactic){
  const inactive = { active:false, score:100, label:'Formación predefinida', defenseMultiplier:1, midfieldMultiplier:1, attackMultiplier:1, chanceMultiplier:1, possessionAdd:0, conditionDelta:0, counts:{gk:1,def:4,mid:4,att:2}, warnings:[], bonuses:[] };
  if(!isCustomTactic(tactic)) return inactive;
  const roles = tacticRoleSlots(tactic);
  const counts = { gk:0, def:0, mid:0, att:0 };
  roles.forEach(role => { const group = slotGroup(role); if(Object.prototype.hasOwnProperty.call(counts,group)) counts[group] += 1; });
  const side = customTacticSideCounts(roles);
  const dfc = roles.filter(role => role === 'DFC').length;
  const centralMid = roles.filter(role => ['MCD','MC','MCO'].includes(role)).length;
  const dc = roles.filter(role => role === 'DC').length;
  let defenseMultiplier = 1;
  let midfieldMultiplier = 1;
  let attackMultiplier = 1;
  let chanceMultiplier = 1;
  let possessionAdd = 0;
  let conditionDelta = 0;
  const warnings = [];
  const bonuses = [];
  const penalize = (key,text,value) => { warnings.push({ key,text,value }); };
  if(counts.def < 3){ const missing=3-counts.def; defenseMultiplier-=0.10*missing; midfieldMultiplier-=0.03*missing; penalize('few-def',`Sólo ${counts.def} defensores: fragilidad defensiva.`,10*missing); }
  if(counts.def > 5){ const extra=counts.def-5; attackMultiplier-=0.05*extra; midfieldMultiplier-=0.025*extra; chanceMultiplier-=0.035*extra; penalize('many-def',`${counts.def} defensores: salida ofensiva limitada.`,5*extra); }
  if(counts.mid < 3){ const missing=3-counts.mid; midfieldMultiplier-=0.10*missing; defenseMultiplier-=0.035*missing; attackMultiplier-=0.045*missing; possessionAdd-=4*missing; penalize('few-mid',`Sólo ${counts.mid} mediocampistas: líneas desconectadas.`,10*missing); }
  if(counts.mid > 5){ const extra=counts.mid-5; defenseMultiplier-=0.02*extra; attackMultiplier-=0.025*extra; penalize('many-mid',`${counts.mid} mediocampistas: falta presencia en otras líneas.`,3*extra); }
  if(counts.att < 1){ attackMultiplier-=0.18; chanceMultiplier-=0.15; penalize('no-att','Sin atacantes: muy poca presencia en el área.',18); }
  if(counts.att > 4){ const extra=counts.att-4; defenseMultiplier-=0.075*extra; midfieldMultiplier-=0.045*extra; conditionDelta-=0.7*extra; penalize('many-att',`${counts.att} atacantes: el equipo queda partido.`,8*extra); }
  if(dfc < 2){ const missing=2-dfc; defenseMultiplier-=0.09*missing; penalize('few-dfc',`${dfc} defensores centrales: el área queda expuesta.`,9*missing); }
  if(side.left === 0){ defenseMultiplier-=0.045; midfieldMultiplier-=0.04; attackMultiplier-=0.035; penalize('no-left','Banda izquierda sin cobertura.',7); }
  if(side.right === 0){ defenseMultiplier-=0.045; midfieldMultiplier-=0.04; attackMultiplier-=0.035; penalize('no-right','Banda derecha sin cobertura.',7); }
  if(centralMid === 0){ midfieldMultiplier-=0.12; possessionAdd-=6; penalize('no-center','Sin presencia central en el mediocampo.',12); }
  if(dc === 0 && counts.att > 0){ attackMultiplier-=0.05; chanceMultiplier-=0.04; penalize('no-dc','Sin referencia central de ataque.',5); }
  const balanced = counts.def >= 3 && counts.def <= 5 && counts.mid >= 3 && counts.mid <= 5 && counts.att >= 1 && counts.att <= 3 && dfc >= 2 && side.left > 0 && side.right > 0 && centralMid > 0;
  if(balanced){ defenseMultiplier+=0.02; midfieldMultiplier+=0.025; attackMultiplier+=0.02; possessionAdd+=2; bonuses.push('Estructura equilibrada: +2% a +3% por línea.'); }
  defenseMultiplier = clamp(defenseMultiplier,0.70,1.05);
  midfieldMultiplier = clamp(midfieldMultiplier,0.70,1.05);
  attackMultiplier = clamp(attackMultiplier,0.70,1.05);
  chanceMultiplier = clamp(chanceMultiplier,0.72,1.05);
  possessionAdd = clamp(possessionAdd,-12,4);
  conditionDelta = clamp(conditionDelta,-4,1);
  const score = clamp(Math.round(avg([defenseMultiplier,midfieldMultiplier,attackMultiplier,chanceMultiplier]) * 100 + possessionAdd * 0.35),0,100);
  const label = score >= 96 ? 'Equilibrada' : score >= 88 ? 'Levemente descompensada' : score >= 76 ? 'Descompensada' : 'Muy desequilibrada';
  return { active:true,score,label,defenseMultiplier,midfieldMultiplier,attackMultiplier,chanceMultiplier,possessionAdd,conditionDelta,counts:{...counts,dfc,left:side.left,right:side.right,centralMid,dc},warnings,bonuses };
}
function customTacticBalanceCompact(tactic){
  const profile = customTacticBalanceProfile(tactic);
  return {
    active:profile.active,
    score:profile.score,
    label:profile.label,
    defenseMultiplier:Number(profile.defenseMultiplier.toFixed(4)),
    midfieldMultiplier:Number(profile.midfieldMultiplier.toFixed(4)),
    attackMultiplier:Number(profile.attackMultiplier.toFixed(4)),
    chanceMultiplier:Number(profile.chanceMultiplier.toFixed(4)),
    possessionAdd:Number(profile.possessionAdd.toFixed(2)),
    conditionDelta:Number(profile.conditionDelta.toFixed(2))
  };
}
function customTacticMoveSelectedToCell(cellId){
  if(!game?.tactic || !tacticClickSelection?.playerId) return false;
  const cell = customTacticCell(cellId);
  if(!cell) return false;
  game.tactic = normalizeTactic(game.selectedClubId,game.tactic);
  if(!isCustomTactic(game.tactic)) return false;
  const playerId = Number(tacticClickSelection.playerId || 0);
  const player = playerById(playerId);
  if(!player) return false;
  const existingTargetIndex = game.tactic.customSlots.indexOf(cell.id);
  const source = tacticLocationOfPlayer(playerId);
  if(existingTargetIndex >= 0){
    return swapTacticClickTargets(source,{ type:'custom',index:existingTargetIndex,cellId:cell.id,playerId:Number(game.tactic.starters[existingTargetIndex] || 0) });
  }
  if(!canBeStarter(playerId)){ showNotice('Los lesionados o suspendidos no pueden ocupar una casilla titular.'); return false; }
  if(!canAssignPlayerToSlot(player,cell.role)){ showNotice(cell.role === 'POR' ? 'La casilla de portero sólo acepta un portero, salvo emergencia real.' : 'Un portero no puede ocupar una casilla de campo.'); return false; }
  if(source.type === 'custom' || source.type === 'starter'){
    const index = Number(source.index);
    game.tactic.customSlots[index] = cell.id;
  }else{
    const emptyIndex = game.tactic.starters.findIndex(id => !Number(id));
    if(emptyIndex < 0){ showNotice('Ya hay 11 titulares. Intercambiá este jugador con uno del once antes de asignarle otra casilla.'); return false; }
    clearTacticLocation(source);
    game.tactic.customSlots[emptyIndex] = cell.id;
    game.tactic.starters[emptyIndex] = playerId;
  }
  cleanupTacticAfterClickSwap();
  tacticClickSelection = null;
  saveLocal(true);
  showNotice(`${playerLastName(player.name)} fue ubicado como ${cell.role}. Guardá la táctica para confirmar.`);
  renderTactics();
  return true;
}

/* pitchSlots se mantiene como API pública, pero en personalizado usa las casillas nuevas. */
const presetPitchSlotsV849 = pitchSlots;
pitchSlots = function(tactic){
  return isCustomTactic(tactic) ? customTacticPitchSlots(tactic) : presetPitchSlotsV849(tactic);
};
