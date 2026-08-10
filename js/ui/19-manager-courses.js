/* V8.81 · Licencias progresivas actualizadas para carrera, vestuario, contratos y copas. */

const MANAGER_COURSE_REWARD_POINTS = 1000;
const MANAGER_COURSE_ORDER = ['basic','national','international'];
const MANAGER_COURSE_LICENSES = {
  basic:{
    id:'basic',
    title:'Licencia de manager Básica',
    actionLabel:'Obtener licencia de manager Básica',
    level:'Nivel inicial',
    intro:'Un recorrido inicial para ordenar táctica, plantel, vestuario, contratos y decisiones diarias durante las primeras semanas de una carrera.',
    topics:[
      { id:'tactics', title:'Táctica predefinida o personalizada', text:'Podés utilizar formaciones predefinidas o distribuir libremente a once jugadores en la táctica personalizada, siempre con un portero. Cada casilla aplica un rol y puede generar bonificaciones o penalizaciones según el equilibrio del equipo.', example:'Comprobá la compatibilidad de cada jugador con su casilla antes de confirmar el once.' },
      { id:'positions', title:'Puestos naturales y adaptación', text:'Un jugador suele rendir mejor en su posición natural. Puede cubrir puestos compatibles, pero cuanto más se aleja de su función habitual, menor será su ajuste táctico.', example:'Un extremo puede cambiar de banda con menos riesgo que un delantero utilizado como defensor central.' },
      { id:'lineup', title:'Titulares, suplentes y grupos', text:'Además del once y el banco, la pestaña Grupos separa referentes, titulares, rotación, suplentes y juveniles. Esta clasificación ayuda a entender expectativas de minutos e influencia interna.', example:'Antes de rotar, revisá qué suplentes necesitan participación y qué referentes sostienen al vestuario.' },
      { id:'captaincy', title:'Capitanía y referentes', text:'El capitán debe ser un titular confiable, pero no es la única voz del plantel. Los referentes se determinan por liderazgo, experiencia, rendimiento e influencia acumulada.', example:'Cambiar al capitán o declarar transferible a un referente puede afectar la confianza de otros jugadores.' },
      { id:'fitness', title:'Estado físico y calendario', text:'La forma física baja con partidos y entrenamientos. Liga, copas nacionales, Champions, Libertadores y el Mundial de Clubes cuatrienal pueden generar semanas exigentes, por lo que la rotación debe planificarse con anticipación.', example:'Reservá a un titular cansado antes de una semifinal o final, no después de que se lesione.' },
      { id:'morale', title:'Moral, cohesión y confianza', text:'Moral y cohesión describen al equipo; la confianza es individual y también se resume por grupos. Minutos, resultados, promesas y decisiones modifican el respaldo al mánager y la predisposición a renovar.', example:'Usá Vestuario para ordenar por confianza e influencia y detectar tensiones antes de que se conviertan en conflictos.' },
      { id:'pitch', title:'Campo e instalaciones del club', text:'El estado del campo influye en circulación, ocasiones, desgaste y riesgo físico. Estadio, césped y calefacción pertenecen al club; el Predio juvenil se administra por separado desde Carrera → Mejoras.', example:'Si el campo está deteriorado, compará el calendario antes de elegir parcheo o replantado.' },
      { id:'training', title:'Entrenamiento y recuperación', text:'El entrenamiento mejora al plantel, pero las cargas intensas pueden reducir forma y moral. La mejor sesión depende de los días disponibles, las lesiones y la próxima competencia.', example:'Después de varios partidos seguidos puede ser mejor recuperar que insistir con otra sesión intensa.' },
      { id:'availability', title:'Lesiones, suspensiones y plantel mínimo', text:'Un jugador lesionado o suspendido no puede considerarse disponible. Además, al inicio de temporada el club dirigido debe reunir suficientes jugadores por línea; desde el día 10 recibe advertencias y el día 29 puede despedir al mánager si el plantel sigue incompleto.', example:'Revisá Contratos y Mercado antes de que termine la pretemporada, especialmente si vencieron varios vínculos.' },
      { id:'routine', title:'Rutina diaria del mánager', text:'Revisá Inicio, Mensajes, Táctica, Grupos, Vestuario, Contratos y Calendario antes de avanzar. Controlá por separado las finanzas del club y la Cuenta Bancaria personal.', example:'No avances varios días sin comprobar decisiones pendientes, vencimientos de ofertas o próximos partidos de copa.' }
    ]
  },
  national:{
    id:'national',
    title:'Licencia de manager Nacional',
    actionLabel:'Obtener licencia de manager Nacional',
    level:'Nivel intermedio',
    intro:'Profundiza en la planificación de una temporada con liga y copas, el armado de plantel, las renovaciones y la administración de recursos del club.',
    topics:[
      { id:'identity', title:'Identidad y alternativas tácticas', text:'Un equipo necesita una idea principal y una alternativa preparada. Las tácticas guardadas permiten cambiar formación, roles o mentalidad sin reconstruir el planteo desde cero.', example:'Conservá un plan equilibrado y otro para perseguir un resultado en partidos de eliminación directa.' },
      { id:'instructions', title:'Mentalidad e instrucciones en vivo', text:'Las instrucciones modifican riesgos, ritmo y comportamiento colectivo. Deben responder al marcador, al cansancio y al tipo de partido; una copa que exige ganador puede terminar en penales.', example:'En una final empatada, no expongas al equipo innecesariamente si los mejores ejecutantes siguen en cancha.' },
      { id:'rotation', title:'Rotación entre liga y copas', text:'Las copas nacionales se juegan en fechas mensuales y en sedes neutrales. La rotación debe considerar días de descanso, importancia de la ronda y profundidad del banco.', example:'Prepará la semana anterior al primer miércoles de cada mes cuando haya una ronda de copa programada.' },
      { id:'training-plan', title:'Plan de entrenamiento por etapa', text:'El desarrollo funciona mejor cuando se combinan carga, descanso y objetivos por posición. La pretemporada, las semanas de doble competencia y el cierre anual requieren planes distintos.', example:'Reducí cargas antes de una final y recuperá después, en lugar de usar siempre la sesión más exigente.' },
      { id:'scouting', title:'Ojeo y decisiones con incertidumbre', text:'El ojeo reduce dudas antes de invertir. Media, habilidades, edad, sueldo, cláusula, interés y encaje en el grupo son variables distintas.', example:'Compará al objetivo con el titular actual y con el costo de renovar a un jugador propio.' },
      { id:'market', title:'Mercado y renovación de jugadores', text:'Los contratos del plantel se negocian manualmente en el club dirigido. La confianza modifica salario exigido, probabilidad de aceptación y duración máxima. Un rechazo bloquea temporalmente otra propuesta y los contratos vencidos pasan a libres.', example:'Antes de fichar un reemplazo caro, revisá si recuperar la confianza del titular permite una renovación más conveniente.' },
      { id:'academy', title:'Tu Academia como patrimonio personal', text:'Juveniles, Predio, residencias y Preparador pertenecen al mánager y continúan con él aunque cambie de club. Sus gastos se pagan desde la Cuenta Bancaria personal.', example:'Antes de ampliar el Predio, conservá saldo para becas, residencias y futuras captaciones.' },
      { id:'staff', title:'Empleados y Segundo entrenador', text:'Psicólogo, Kinesiólogo, Segundo entrenador y estructura de ojeo pertenecen al club. El Segundo entrenador genera informes periódicos con tres prioridades sobre plantel, táctica, vestuario, contratos, finanzas y calendario; no ejecuta cambios automáticamente.', example:'Usá el informe como diagnóstico y después decidí qué recomendación merece recursos inmediatos.' },
      { id:'club-finance', title:'Finanzas, entradas y dos patrimonios', text:'El club paga salarios, empleados, fichajes e instalaciones. En copas nacionales, el ganador recibe la recaudación del estadio neutral según el precio de la ronda. La Cuenta Bancaria personal sigue separada.', example:'No presupuestes una recaudación de copa antes de superar la eliminatoria.' },
      { id:'objectives', title:'Contrato del mánager y mercado laboral', text:'Los objetivos anuales condicionan continuidad, prestigio y futuras propuestas. Podés recibir ofertas mientras trabajás; duran entre 10 y 30 días y aceptarlas termina inmediatamente el vínculo actual.', example:'Compará proyecto, sueldo, exigencia y momento deportivo antes de abandonar un club a mitad de temporada.' }
    ]
  },
  international:{
    id:'international',
    title:'Licencia de manager Internacional',
    actionLabel:'Obtener licencia de manager Internacional',
    level:'Nivel avanzado',
    intro:'Prepara al mánager para construir una carrera entre clubes y países, responder ofertas laborales, gestionar figuras y competir en copas nacionales e internacionales.',
    topics:[
      { id:'career-mobility', title:'Ofertas laborales y continuidad de carrera', text:'Los clubes pueden buscarte aunque tengas empleo. Las propuestas aparecen en Carrera → Ofertas laborales, tienen vencimiento y se basan en prestigio, rendimiento, capacidades y urgencia del equipo. Cambiar de club conserva Academia, saldo personal y derechos económicos.', example:'No esperes al último día para decidir una oferta si antes necesitás revisar plantel, tabla y objetivo del club interesado.' },
      { id:'adaptation', title:'Adaptación a un nuevo club', text:'Al asumir existe un período de adaptación antes de ciertos eventos especiales. Debés revisar táctica, capitanía, grupos, contratos próximos a vencer y profundidad del plantel sin esperar que las jerarquías anteriores se mantengan.', example:'Durante las primeras semanas evitá promesas masivas hasta comprender quiénes son los referentes reales.' },
      { id:'squad-building', title:'Plantel, confianza y contratos sostenibles', text:'Un plantel competitivo necesita cobertura por línea, jerarquías claras y vínculos contractuales escalonados. Acumular muchos vencimientos en la misma temporada aumenta el riesgo de perder jugadores o pagar renovaciones bajo presión.', example:'Renová anticipadamente a quienes estén predispuestos y planificá salidas para los casos con confianza fracturada.' },
      { id:'world-cup', title:'Copas nacionales y Mundial de Clubes', text:'Las copas nacionales usan eliminación directa y las supercopas se juegan al cierre del año. El Mundial de Clubes se disputa cada cuatro años con ocho clubes de Champions, ocho de Libertadores y dieciséis invitados.', example:'Separá las cargas de octubre y del cierre anual para no llegar al Mundial con el plantel agotado.' },
      { id:'neutral-matches', title:'Sedes neutrales, público y recaudación', text:'En copas no existe localía para los participantes. Se intenta repartir la capacidad entre ambas hinchadas y el ganador recibe la recaudación. En supercopas se utiliza el estadio más grande del país.', example:'La reputación del club anfitrión importa para elegir una sede, pero no entrega ventaja deportiva a ninguno de los participantes.' },
      { id:'global-scouting', title:'Ojeo internacional y mercado juvenil', text:'El Centro de Ojeo sirve al club profesional, mientras Tu Academia puede recibir ofertas nacionales o extranjeras por juveniles de 17 años. En ambos casos importan nivel, edad, necesidad y reputación del comprador.', example:'Compará el ingreso neto de una venta juvenil con la posibilidad de promoverlo y conservar derechos económicos.' },
      { id:'stars', title:'Figuras, cláusulas y renovaciones difíciles', text:'Las figuras atraen ofertas y suelen tener mayor influencia en el vestuario. Ignorar una cláusula o dejar vencer el contrato puede provocar una salida; una confianza baja encarece y limita la renovación.', example:'Atendé primero a un referente próximo a vencer antes de iniciar una negociación secundaria.' },
      { id:'opponent-analysis', title:'Análisis del Segundo entrenador', text:'El análisis avanzado relaciona calidad del equipo, ajuste táctico, estado físico, confianza de grupos, vencimientos contractuales y próximo rival. El Segundo entrenador prioriza tres problemas y ofrece accesos directos a las áreas correspondientes.', example:'Antes de una eliminatoria, revisá si recomienda recuperar jugadores, corregir roles o resolver contratos que estén afectando al vestuario.' },
      { id:'special-resources', title:'Cartas y recursos especiales', text:'Las cartas aplican efectos limitados sobre áreas concretas. Conviene activarlas con un objetivo y un calendario definidos, porque cada activación y ciclo consume usos.', example:'Una carta preventiva de lesiones tiene más valor antes de una seguidilla de copas que durante una semana libre.' },
      { id:'legacy', title:'Títulos, cartera y legado', text:'Los títulos de liga, copas nacionales y competiciones internacionales fortalecen el legado. Las supercopas cuentan como títulos oficiales de valor menor. Los derechos de juveniles promovidos persisten después de cambiar de club.', example:'Una etapa puede ser valiosa por un título importante, una mejora institucional o una cartera de derechos, aunque no sea la más larga de la carrera.' }
    ]
  }
};

function createInitialManagerCoursesState(){
  return {
    version:'V8.27',
    checked:{ basic:[], national:[], international:[] },
    completed:{ basic:false, national:false, international:false },
    completedAt:{ basic:null, national:null, international:null },
    rewardClaimed:false,
    rewardClaimedAt:null
  };
}
function managerCourseTopicIds(licenseId=''){
  return (MANAGER_COURSE_LICENSES[String(licenseId || '')]?.topics || []).map(item => String(item.id || '')).filter(Boolean);
}
function normalizeManagerCoursesState(value=null){
  const base = createInitialManagerCoursesState();
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const checkedSrc = src.checked && typeof src.checked === 'object' && !Array.isArray(src.checked) ? src.checked : {};
  const completedSrc = src.completed && typeof src.completed === 'object' && !Array.isArray(src.completed) ? src.completed : {};
  const completedAtSrc = src.completedAt && typeof src.completedAt === 'object' && !Array.isArray(src.completedAt) ? src.completedAt : {};
  const clean = createInitialManagerCoursesState();
  MANAGER_COURSE_ORDER.forEach(id => {
    const valid = new Set(managerCourseTopicIds(id));
    clean.checked[id] = Array.from(new Set(Array.isArray(checkedSrc[id]) ? checkedSrc[id].map(String).filter(item => valid.has(item)) : []));
    clean.completed[id] = Boolean(completedSrc[id]);
    clean.completedAt[id] = completedAtSrc[id] || null;
  });
  if(clean.completed.international){ clean.completed.national = true; clean.completed.basic = true; }
  if(clean.completed.national) clean.completed.basic = true;
  MANAGER_COURSE_ORDER.forEach(id => {
    if(clean.completed[id]) clean.checked[id] = managerCourseTopicIds(id);
  });
  clean.rewardClaimed = Boolean(src.rewardClaimed && clean.completed.international);
  clean.rewardClaimedAt = clean.rewardClaimed ? (src.rewardClaimedAt || clean.completedAt.international || null) : null;
  clean.version = 'V8.27';
  return clean;
}
function managerCoursesHasProgress(value=null){
  const state = normalizeManagerCoursesState(value);
  return MANAGER_COURSE_ORDER.some(id => state.completed[id] || state.checked[id].length > 0) || state.rewardClaimed;
}
function managerCourseLicenseUnlocked(licenseId='', stateInput=null){
  const id = String(licenseId || '');
  const state = normalizeManagerCoursesState(stateInput);
  if(id === 'basic') return true;
  if(id === 'national') return Boolean(state.completed.basic);
  if(id === 'international') return Boolean(state.completed.national);
  return false;
}
function managerCourseLicenseProgress(licenseId='', stateInput=null){
  const id = String(licenseId || '');
  const state = normalizeManagerCoursesState(stateInput);
  const total = managerCourseTopicIds(id).length;
  const checked = Math.min(total, state.checked[id]?.length || 0);
  return { checked, total, percent:total ? Math.round((checked / total) * 100) : 0, complete:Boolean(state.completed[id]) };
}
function managerCourseReadState(){
  const profile = typeof readManagerGlobalProfileState === 'function' ? readManagerGlobalProfileState() : {};
  return normalizeManagerCoursesState(profile?.managerCourses);
}
function managerCourseWriteState(stateInput=null, profilePatch={}){
  if(typeof readManagerGlobalProfileState !== 'function' || typeof writeManagerGlobalProfileState !== 'function') return null;
  const profile = readManagerGlobalProfileState();
  const state = normalizeManagerCoursesState(stateInput);
  return writeManagerGlobalProfileState({ ...profile, ...profilePatch, managerCourses:state });
}
function managerCourseAddRewardPoints(stateInput=null){
  const state = normalizeManagerCoursesState(stateInput);
  if(state.rewardClaimed) return { state, awarded:0, total:Number(game?.special?.puntos_habilidad || 0) };
  const profile = typeof readManagerGlobalProfileState === 'function' ? readManagerGlobalProfileState() : { skillPoints:0 };
  let currentPoints = Math.max(0, Math.round(Number(profile?.skillPoints || 0)));
  if(typeof ensureSpecialState === 'function' && game){
    const special = ensureSpecialState();
    currentPoints = Math.max(currentPoints, Math.max(0, Math.round(Number(special?.puntos_habilidad || 0))));
    special.puntos_habilidad = currentPoints + MANAGER_COURSE_REWARD_POINTS;
    const rewardLog = {
      actionId:'licencia_manager_internacional',
      points:MANAGER_COURSE_REWARD_POINTS,
      puntos_antes:currentPoints,
      puntos_despues:special.puntos_habilidad,
      fecha:typeof currentCalendarDate === 'function' ? currentCalendarDate() : null,
      createdAt:new Date().toISOString()
    };
    if(typeof appendSpecialPointsLog === 'function') appendSpecialPointsLog(special, rewardLog);
    else {
      special.puntos_log = Array.isArray(special.puntos_log) ? special.puntos_log : [];
      special.puntos_log.push(rewardLog);
      special.puntos_log = special.puntos_log.slice(-80);
    }
    game.special = special;
    currentPoints = special.puntos_habilidad;
  } else {
    currentPoints += MANAGER_COURSE_REWARD_POINTS;
  }
  state.rewardClaimed = true;
  state.rewardClaimedAt = new Date().toISOString();
  managerCourseWriteState(state, { skillPoints:currentPoints });
  if(game){
    if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame();
    if(typeof saveLocal === 'function') saveLocal(true);
  }
  return { state, awarded:MANAGER_COURSE_REWARD_POINTS, total:currentPoints };
}
function managerCourseCompleteLicense(licenseId=''){
  const id = String(licenseId || '');
  const definition = MANAGER_COURSE_LICENSES[id];
  let state = managerCourseReadState();
  if(!definition || !managerCourseLicenseUnlocked(id, state) || state.completed[id]) return { state, completed:false, awarded:0 };
  const progress = managerCourseLicenseProgress(id, state);
  if(progress.checked < progress.total) return { state, completed:false, awarded:0 };
  state.completed[id] = true;
  state.completedAt[id] = new Date().toISOString();
  state.checked[id] = managerCourseTopicIds(id);
  let awarded = 0;
  if(id === 'international'){
    const reward = managerCourseAddRewardPoints(state);
    state = reward.state;
    awarded = reward.awarded;
  } else {
    managerCourseWriteState(state);
  }
  return { state, completed:true, awarded };
}
function managerCourseToggleTopic(licenseId='', topicId='', checked=false){
  const id = String(licenseId || '');
  const topic = String(topicId || '');
  let state = managerCourseReadState();
  if(!managerCourseLicenseUnlocked(id, state) || state.completed[id] || !managerCourseTopicIds(id).includes(topic)) return { state, completed:false, awarded:0 };
  const selected = new Set(state.checked[id] || []);
  if(checked) selected.add(topic); else selected.delete(topic);
  state.checked[id] = Array.from(selected);
  managerCourseWriteState(state);
  const progress = managerCourseLicenseProgress(id, state);
  if(progress.total > 0 && progress.checked >= progress.total) return managerCourseCompleteLicense(id);
  return { state, completed:false, awarded:0 };
}
function managerCourseStatusLabel(licenseId='', stateInput=null){
  const state = normalizeManagerCoursesState(stateInput);
  if(state.completed[licenseId]) return 'Aprobada';
  if(!managerCourseLicenseUnlocked(licenseId, state)) return 'Bloqueada';
  const progress = managerCourseLicenseProgress(licenseId, state);
  return progress.checked ? 'En curso' : 'Disponible';
}
function managerCourseNextLicenseId(licenseId=''){
  const index = MANAGER_COURSE_ORDER.indexOf(String(licenseId || ''));
  return index >= 0 && index < MANAGER_COURSE_ORDER.length - 1 ? MANAGER_COURSE_ORDER[index + 1] : '';
}
function managerCourseTopicMarkup(licenseId, topic, state){
  const checked = state.checked[licenseId]?.includes(topic.id) || state.completed[licenseId];
  const disabled = state.completed[licenseId] ? 'disabled' : '';
  return `<article class="manager-course-topic ${checked ? 'is-checked' : ''}">
    <div class="manager-course-topic-copy">
      <h4>${escapeHtml(topic.title)}</h4>
      <p>${escapeHtml(topic.text)}</p>
      ${topic.example ? `<div class="manager-course-example"><strong>Ejemplo útil</strong><span>${escapeHtml(topic.example)}</span></div>` : ''}
    </div>
    <label class="manager-course-check">
      <input type="checkbox" data-manager-course-license="${escapeHtml(licenseId)}" data-manager-course-topic="${escapeHtml(topic.id)}" ${checked ? 'checked' : ''} ${disabled}>
      <span>Ya entiendo cómo funciona</span>
    </label>
  </article>`;
}
function managerCourseLicenseMarkup(licenseId, state, focus=''){
  const definition = MANAGER_COURSE_LICENSES[licenseId];
  const unlocked = managerCourseLicenseUnlocked(licenseId, state);
  const progress = managerCourseLicenseProgress(licenseId, state);
  const completed = state.completed[licenseId];
  const status = managerCourseStatusLabel(licenseId, state);
  const shouldOpen = focus === licenseId || (!focus && licenseId === 'basic' && !completed);
  const previousId = licenseId === 'national' ? 'basic' : licenseId === 'international' ? 'national' : '';
  const previousTitle = previousId ? MANAGER_COURSE_LICENSES[previousId]?.title : '';
  return `<details class="manager-course-license ${completed ? 'is-completed' : ''} ${unlocked ? '' : 'is-locked'}" ${shouldOpen ? 'open' : ''}>
    <summary>
      <div class="manager-course-license-title">
        <span class="manager-course-medal" aria-hidden="true">${completed ? '✓' : licenseId === 'basic' ? 'B' : licenseId === 'national' ? 'N' : 'I'}</span>
        <div><small>${escapeHtml(definition.level)}</small><strong>${escapeHtml(definition.title)}</strong></div>
      </div>
      <div class="manager-course-license-meta"><span class="pill ${completed ? 'ok' : unlocked ? 'warn' : ''}">${escapeHtml(status)}</span><b>${progress.checked}/${progress.total}</b></div>
    </summary>
    <div class="manager-course-license-body">
      ${unlocked ? `<p class="manager-course-intro">${escapeHtml(definition.intro)}</p>
        <div class="manager-course-progress"><span style="width:${progress.percent}%"></span></div>
        <div class="manager-course-topics">${definition.topics.map(topic => managerCourseTopicMarkup(licenseId, topic, state)).join('')}</div>
        <div class="manager-course-license-footer ${completed ? 'is-completed' : ''}">
          <strong>${completed ? 'Licencia aprobada' : definition.actionLabel}</strong>
          <span>${completed ? `Completada${state.completedAt[licenseId] ? ` · ${new Date(state.completedAt[licenseId]).toLocaleDateString('es-AR')}` : ''}` : `Marcá los ${progress.total} controles para aprobarla.`}</span>
        </div>` : `<div class="manager-course-locked-copy"><strong>Licencia todavía bloqueada</strong><p>Primero debés aprobar la ${escapeHtml(previousTitle)}.</p></div>`}
    </div>
  </details>`;
}
function openManagerCoursesModal(options={}){
  const state = managerCourseReadState();
  const completedCount = MANAGER_COURSE_ORDER.filter(id => state.completed[id]).length;
  const focus = String(options.focus || '');
  const body = `<div class="manager-courses-modal">
    <div class="manager-courses-hero card">
      <div><p class="eyebrow">Formación progresiva</p><h2>Cursos de manager</h2><p>Completá cada checklist en orden. Las explicaciones enseñan el funcionamiento general del juego sin revelar fórmulas internas.</p></div>
      <div class="manager-course-overall"><strong>${completedCount}/3</strong><span>licencias aprobadas</span></div>
    </div>
    <div class="manager-course-sequence"><span class="${state.completed.basic ? 'done' : 'active'}">Básica</span><i></i><span class="${state.completed.national ? 'done' : state.completed.basic ? 'active' : ''}">Nacional</span><i></i><span class="${state.completed.international ? 'done' : state.completed.national ? 'active' : ''}">Internacional</span></div>
    <div class="manager-course-license-list">${MANAGER_COURSE_ORDER.map(id => managerCourseLicenseMarkup(id, state, focus)).join('')}</div>
    <div class="card manager-course-reward ${state.rewardClaimed ? 'is-claimed' : ''}">
      <div><p class="label">Premio final</p><strong>${state.rewardClaimed ? 'Licencia Internacional aprobada' : '+1.000 puntos de habilidad'}</strong><p>${state.rewardClaimed ? 'La recompensa ya fue acreditada a este perfil de manager.' : 'Se entrega una sola vez al completar la tercera licencia.'}</p></div>
      <span>${state.rewardClaimed ? '✓' : '1000'}</span>
    </div>
  </div>`;
  openModal(body);
  document.querySelectorAll('[data-manager-course-license][data-manager-course-topic]').forEach(input => {
    input.addEventListener('change', event => {
      const licenseId = event.target.dataset.managerCourseLicense || '';
      const topicId = event.target.dataset.managerCourseTopic || '';
      const result = managerCourseToggleTopic(licenseId, topicId, event.target.checked);
      if(result.completed){
        openManagerCourseCompletionModal(licenseId, result.awarded);
      } else {
        openManagerCoursesModal({ focus:licenseId });
      }
    });
  });
}
function openManagerCourseCompletionModal(licenseId='', awarded=0){
  const id = String(licenseId || '');
  const definition = MANAGER_COURSE_LICENSES[id];
  const nextId = managerCourseNextLicenseId(id);
  const final = id === 'international';
  const body = `<div class="manager-course-completion">
    <div class="manager-course-certificate">
      <span class="manager-course-certificate-mark">✓</span>
      <p class="eyebrow">Licencia aprobada</p>
      <h2>${escapeHtml(definition?.title || 'Curso completado')}</h2>
      <p>${final ? 'Completaste el recorrido de formación y ya podés aplicar estos conceptos en carreras nacionales e internacionales.' : `Terminaste todos los contenidos. La ${escapeHtml(MANAGER_COURSE_LICENSES[nextId]?.title || 'siguiente licencia')} quedó habilitada.`}</p>
      ${final ? `<div class="manager-course-prize"><span>Premio único</span><strong>+${formatPlainNumber(awarded || MANAGER_COURSE_REWARD_POINTS)} puntos de habilidad</strong></div>` : ''}
    </div>
    <div class="row message-actions">
      ${nextId ? `<button id="btnContinueManagerCourses" class="primary">Continuar con la siguiente licencia</button>` : `<button id="btnContinueManagerCourses" class="primary">Volver a los cursos</button>`}
      <button class="ghost" data-close-modal>Cerrar</button>
    </div>
  </div>`;
  openModal(body);
  $('btnContinueManagerCourses')?.addEventListener('click', () => openManagerCoursesModal({ focus:nextId || 'international' }));
}
