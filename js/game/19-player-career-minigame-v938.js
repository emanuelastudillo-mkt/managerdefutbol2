/*
  V9.38 · Ser jugador
  - El retiro ya no puede producirse cerca de la mejor Media ni con una temporada casi completa.
  - Desde los 32 años disminuyen progresivamente la Media y la participación anual.
  - La carrera termina cuando el jugador acumula una caída deportiva clara y casi deja de jugar.
*/

const pcV938BaseCreatePlayerCareer = pcCreatePlayerCareer;
const pcV938BaseNormalizeCareer = pcNormalizeCareer;
const pcV938BaseSimulateMatch = pcSimulateMatch;
const pcV938BaseFinalizeSeason = pcFinalizeSeason;
const pcV938BaseRetireCareer = pcRetireCareer;
const pcV938BaseRenderPlayerCareer = renderPlayerCareer;

function pcV938HistoricalPeak(state){
  const player = state?.player || {};
  const values = [Number(player.overall || 0),Number(player.careerPeakOverall || 0)];
  (state?.history?.seasons || []).forEach(season => {
    values.push(Number(season?.overallStart || 0),Number(season?.overallEnd || 0));
  });
  return Math.max(35,...values.filter(Number.isFinite));
}

function pcV938EnsureLateCareer(state){
  if(!state || !state.player) return null;
  state.player.careerPeakOverall = Math.max(Number(state.player.careerPeakOverall || 0),pcV938HistoricalPeak(state));
  state.lateCareer = state.lateCareer && typeof state.lateCareer === 'object' ? state.lateCareer : {};
  state.lateCareer.lowParticipationSeasons = Math.max(0,Math.round(Number(state.lateCareer.lowParticipationSeasons || 0)));
  state.lateCareer.lastSeasonMatches = Math.max(0,Math.round(Number(state.lateCareer.lastSeasonMatches || 0)));
  state.lateCareer.lastSeasonMedia = Number(state.lateCareer.lastSeasonMedia || state.player.overall || 0);
  state.lateCareer.startedAtAge = Math.max(32,Math.round(Number(state.lateCareer.startedAtAge || 32)));
  return state.lateCareer;
}

pcCreatePlayerCareer = function(form){
  const state = pcV938BaseCreatePlayerCareer(form);
  state.schemaVersion = Math.max(13,Number(state.schemaVersion || 0));
  state.viewVersion = 'V9.38';
  pcV938EnsureLateCareer(state);
  return state;
};

pcNormalizeCareer = function(raw){
  const normalized = pcV938BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(13,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.38';
  pcV938EnsureLateCareer(normalized);
  return normalized;
};

function pcV938AvailabilityByAge(age){
  if(age < 32) return 1;
  const table = {
    32:0.90,
    33:0.80,
    34:0.68,
    35:0.54,
    36:0.40,
    37:0.27,
    38:0.15,
    39:0.08,
    40:0.04,
    41:0.02
  };
  return Number(table[Math.min(41,Math.max(32,Math.round(age)))] || 0.015);
}

function pcV938LateCareerAvailability(state){
  const age = Number(state?.player?.age || 18);
  if(age < 32) return 1;
  const peak = pcV938HistoricalPeak(state);
  const current = Number(state?.player?.overall || peak);
  const drop = Math.max(0,peak-current);
  const declineFactor = pcClamp(1-drop*0.032,0.34,1);
  const mediaFactor = current < 70 ? 0.58 : current < 76 ? 0.72 : current < 82 ? 0.86 : 1;
  return pcClamp(pcV938AvailabilityByAge(age)*declineFactor*mediaFactor,0.01,0.92);
}

pcSimulateMatch = function(state){
  if(!state || Number(state?.player?.age || 18) < 32) return pcV938BaseSimulateMatch(state);
  pcV938EnsureLateCareer(state);
  const availability = pcV938LateCareerAvailability(state);
  if(!state.injury && !pcChance(state,availability)){
    state.player.trust = pcClamp(Number(state.player.trust || 50)-0.28,0,100);
    const teamResult = typeof pcTeamMatchResult === 'function' ? pcTeamMatchResult(state,0) : 0;
    return { delta:pcEmptyStats(),teamResult,played:false,manOfMatch:false,lateCareerOmission:true };
  }
  return pcV938BaseSimulateMatch(state);
};

function pcV938MinimumDropByAge(age){
  if(age < 32) return 0;
  if(age === 32) return 1;
  if(age === 33) return 3;
  if(age === 34) return 5;
  if(age === 35) return 7;
  if(age === 36) return 9;
  if(age === 37) return 11;
  if(age === 38) return 13;
  if(age === 39) return 15;
  return 18+Math.max(0,age-40)*2;
}

function pcV938LastCompletedSeason(state){
  const rows = Array.isArray(state?.history?.seasons) ? state.history.seasons : [];
  return rows.slice().sort((a,b) => Number(b?.season || 0)-Number(a?.season || 0))[0] || null;
}

function pcV938RetirementProfile(state){
  pcV938EnsureLateCareer(state);
  const latest = pcV938LastCompletedSeason(state);
  const age = Number(latest?.age ?? state?.player?.age ?? 18);
  const peak = pcV938HistoricalPeak(state);
  const current = Number(state?.player?.overall || peak);
  const matches = Math.max(0,Math.round(Number(latest?.stats?.matches ?? state?.lateCareer?.lastSeasonMatches ?? 99)));
  const drop = Math.max(0,peak-current);
  const requiredDrop = peak >= 95 ? 13 : peak >= 90 ? 12 : peak >= 85 ? 10 : 8;
  const lowMedia = drop >= requiredDrop && current <= peak-requiredDrop;
  const almostNoMatches = matches <= 8;
  const ageEligible = age >= 35;
  return { eligible:ageEligible&&lowMedia&&almostNoMatches,age,peak,current,matches,drop,requiredDrop,lowMedia,almostNoMatches };
}

pcRetireCareer = function(state,reason='Fin del ciclo profesional'){
  if(!state || state.status === 'retired') return state;
  const profile = pcV938RetirementProfile(state);
  if(!profile.eligible){
    state.retirementBlocked = {
      year:Number(state?.season?.year || 0),
      age:profile.age,
      media:profile.current,
      peak:profile.peak,
      seasonMatches:profile.matches,
      reason:String(reason || '')
    };
    return state;
  }
  state.retirementBlocked = null;
  const finalReason = `Retiro tras perder protagonismo: Media ${Math.round(profile.current)}, ${profile.matches} partidos en su última temporada y una caída de ${Math.round(profile.drop)} puntos desde su mejor nivel`;
  return pcV938BaseRetireCareer(state,finalReason);
};

function pcV938ApplyMandatoryDecline(state,summary){
  if(!state || !summary) return;
  const completedAge = Number(summary.age ?? Number(state.player?.age || 18)-1);
  if(completedAge < 32) return;
  const lateCareer = pcV938EnsureLateCareer(state);
  const peak = pcV938HistoricalPeak(state);
  const minimumDrop = pcV938MinimumDropByAge(completedAge);
  const targetMaximum = Math.max(35,peak-minimumDrop);
  if(Number(state.player.overall || 0) > targetMaximum){
    state.player.overall = pcRound(targetMaximum,1);
    state.player.growthProgress = Math.min(0,Number(state.player.growthProgress || 0));
  }
  summary.overallEnd = Number(state.player.overall || summary.overallEnd || 0);
  const row = (state.history?.seasons || []).find(item => Number(item?.season || 0)===Number(summary.season || 0));
  if(row) row.overallEnd = summary.overallEnd;
  const matches = Math.max(0,Math.round(Number(summary?.stats?.matches || 0)));
  lateCareer.lastSeasonMatches = matches;
  lateCareer.lastSeasonMedia = Number(state.player.overall || 0);
  lateCareer.lowParticipationSeasons = matches <= 8 ? lateCareer.lowParticipationSeasons+1 : 0;
  state.player.value = pcCalculateValue(state);
}

pcFinalizeSeason = function(state){
  if(!state) return pcV938BaseFinalizeSeason(state);
  pcV938EnsureLateCareer(state);
  state.player.careerPeakOverall = Math.max(Number(state.player.careerPeakOverall || 0),Number(state.player.overall || 0));
  const summary = pcV938BaseFinalizeSeason(state);
  if(!summary) return summary;
  pcV938ApplyMandatoryDecline(state,summary);
  if(state.status === 'active'){
    const profile = pcV938RetirementProfile(state);
    if(profile.eligible) pcRetireCareer(state,'Fin natural de la carrera');
  }
  return summary;
};

pcManualRetire = function(){
  if(typeof showNotice === 'function') showNotice('El retiro se produce cuando la Media cae y el jugador deja de participar regularmente.');
};

renderPlayerCareer = function(){
  pcV938BaseRenderPlayerCareer();
  const shell = document.querySelector('.player-career-shell');
  if(!shell) return;
  shell.classList.add('player-career-v938');
  const state = typeof pcCareerState === 'function' ? pcCareerState() : null;
  if(state?.status === 'active' && Number(state?.player?.age || 18) >= 32){
    const profile = pcV938RetirementProfile(state);
    const footer = shell.querySelector('.pc-v930-footer-actions>span');
    if(footer) footer.textContent = `Etapa final · Mejor Media ${Math.round(profile.peak)} · Media actual ${Math.round(profile.current)} · Última temporada ${profile.matches} PJ`;
  }
};
