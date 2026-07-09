# Historial de versiones

## V5.27 - Pizarra táctica y visores restaurados

- Restaura los visores tácticos de porcentaje en Táctica: Defensa, Medios y Delantera.
- Mantiene eliminados los textos explicativos largos pedidos en V5.26.
- Ajusta el layout para que la pizarra vuelva a ocupar el bloque central y no quede reducida.
- Amplía el ancho máximo de la pizarra táctica y ajusta visores a un formato compacto.

## V5.26 - Desgaste, tarjetas y limpieza táctica

- Aumenta en 1 punto el desgaste de partido.
- Reduce al 50% las tarjetas generadas por el simulador.
- Agrega suspensión automática por 5 expulsiones de un mismo equipo, con derrota 0-3.
- Elimina textos explicativos redundantes del apartado Tácticas.

# Fútbol Manager MVP

## V5.25 - Texto dirigir partido

- Cambiado el texto del botón **Ver partido** por **Dirigir partido** antes de abrir partidos propios y amistosos.
- No modifica lógica de simulación, resultado directo, calendario, fatiga ni estadísticas.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.25.

## V5.24 - Resultado directo y terminar partido

- Agregado botón **Ver solo resultados** antes de abrir partidos propios y amistosos.
- El botón saltea la simulación visual, resuelve el partido con el motor vivo y muestra estadísticas completas.
- Agregado botón **Terminar partido** dentro del simulador vivo.
- Terminar partido simula todos los minutos restantes sin más intervenciones y habilita guardar el resultado.
- El resultado directo conserva goles, asistencias, tarjetas, lesiones, cambios, tapadas, errores, contexto y estadísticas del partido.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.24.

## V5.23 - Lesiones fantasma y reemplazos bot

- El simulador vivo ahora distingue lesiones activas durante el partido.
- Si un jugador bot se lesiona y el equipo todavía no hizo 3 cambios, el bot intenta reemplazarlo automáticamente con un suplente coherente para el rol.
- Si un jugador del manager se lesiona, el partido se pausa automáticamente.
- El lesionado del manager queda en cancha como jugador fantasma: visible, clickeable, sin aporte ofensivo, defensivo ni táctico.
- El manager puede tocar al lesionado y luego a un suplente para confirmar el reemplazo si todavía tiene cambios.
- Si no quedan cambios, el lesionado queda visible pero sin aportar nada al equipo.
- Los lesionados ya no siguen participando en goles, asistencias, tarjetas, errores ni cálculos de fuerza del equipo.
- Se agregan etiquetas visuales `LES` para distinguir lesionados bloqueados o fantasmas.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.23.

## V5.22 - Controles del simulador centrados

- Los botones de instrucciones del simulador vivo quedan centrados en una primera línea.
- Los botones de acción quedan centrados en una segunda línea: **Táctica**, **Auto/Pausar**, **Simular 1 minuto** y **Cerrar y guardar**.
- Se reduce el ancho ocupado por la botonera inferior para evitar cortes y desbordes en pantalla horizontal.
- No modifica lógica del partido, fatiga, cambios, expulsiones ni calendario.

## V5.21 - Pizarra táctica integrada al simulador

- El botón **Táctica** del simulador vivo ahora abre una pizarra interna en primer plano.
- Ya no se intenta usar la pantalla general de tácticas por detrás del modal del partido.
- Los titulares se muestran como círculos por zona de cancha.
- Clic en un círculo y luego en otro intercambia posiciones.
- Si hay un hueco por expulsión, se puede mover un jugador a ese espacio para cubrir el rol perdido.
- El selector de formación queda disponible dentro de la pizarra.
- Los expulsados permanecen visibles junto al banco, con roja y bloqueados.

## V5.20 - Ojeo persistente en fichas

- Los informes del Centro de Ojeo ya no se pierden al quitar jugadores de la lista activa.
- Las habilidades ocultas reveladas quedan guardadas en la ficha del jugador.
- Aplica a jugadores propios, libres y contratados por otros clubes.
- Cambiar de club vacía lista activa, jefe, oficinas y ojeadores, pero conserva informes ya revelados como progreso del manager.
- Agregado contador de informes guardados y archivados en el Centro de Ojeo.


## Historial de versiones

### V5.19 - Táctica viva, expulsados reales e instrucción ajustada

- Agregado botón **Táctica** dentro del simulador vivo.
- El botón pausa el modo automático y abre una ayuda de táctica rápida para reacomodar jugadores durante el partido.
- Se mantiene el flujo de listas clickeables: titular + titular intercambia roles; titular + suplente confirma sustitución.
- Los expulsados ya no desaparecen: pasan visualmente junto al banco con tarjeta roja, etiqueta **EXP** y quedan bloqueados para volver a entrar.
- Los expulsados dejan de participar realmente en la simulación: no aportan fuerza de equipo, no pueden recibir nuevas tarjetas, no pueden asistir ni convertir goles.
- El equipo con uno o más expulsados queda en desventaja numérica real para los minutos siguientes.
- Ajustada la instrucción **PONGAN HUEVO!!!**: ahora da +10% en ataque y defensa y consume 20% extra de estado físico.
- Se conserva el `config.js` editado por el usuario como base y se actualiza la versión a V5.19.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.19.

### V5.18 - Fatiga reforzada y cambios bot

- Duplicada la pérdida de estado físico por minuto en el simulador vivo para ambos equipos.
- La fatiga sigue dependiendo de resistencia, genética, posición e instrucción activa.
- Agregado parámetro editable `GAME_CONFIG.simulador.fatigaVivaMultiplicador: 2`.
- El bot ahora intenta usar con más decisión los 3 cambios disponibles.
- La lógica de cambios bot prioriza jugadores cansados, con mal puntaje, mal ubicados o afectados por el resultado parcial.
- El bot evalúa ventanas de cambio en entretiempo, 60, 70, 78 y 84 minutos.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.18.



### V5.17 - Simulador compacto con descanso real

- El simulador vivo reduce tipografía, alto de filas y espacios verticales en listas de jugadores y eventos para evitar cortes en pantalla horizontal.
- El partido vivo ahora tiene 105 fases: 45 minutos del primer tiempo, 15 fases de descanso y 45 minutos del segundo tiempo.
- Al llegar al entretiempo, el modo automático se pausa para permitir cambios, ajuste de formación o instrucciones.
- Durante las 15 fases de descanso no se generan eventos de partido: los jugadores recuperan parte de su estado físico.
- La recuperación depende de resistencia, genética y posición, sin superar el estado físico con el que cada jugador llegó al partido.
- La barra de fases diferencia primer tiempo, descanso y segundo tiempo.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.17.


**V5.16 - Avance diario unificado y cooldown de 20 segundos**


### V5.16 - Avance diario unificado y cooldown de 20 segundos

- Unificados los botones **Avanzar día** e **Ir a próximo partido** en un solo botón principal.
- El botón ahora avanza un día calendario por vez o abre el partido propio si el compromiso ya está pendiente ese día.
- Cooldown único de **20 segundos** después de cada avance, amistoso, partido propio o día de postemporada.
- Durante el avance se procesan verificaciones diarias, academia, scouting, contratos, lesiones, préstamos, sponsors y partidos bot pendientes.
- Se eliminan los saltos automáticos largos hacia el próximo partido desde la oficina para evitar inconsistencias de bloqueo y fechas.
- La barra de progreso queda asociada al único botón de avance.
- Si una partida traía un bloqueo viejo más largo, se normaliza al nuevo cooldown máximo.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.16.

### V5.15 - Entrenamiento temporal, academia y cartas limpias

- Rehecho el ajuste de entrenamiento profesional de V5.14.
- Los jugadores profesionales ya no suben habilidades base de forma permanente por entrenamiento.
- El entrenamiento intensivo suma **boosts temporales de temporada** sobre habilidades existentes.
- Dos turnos de entrenamiento intensivo deberían generar normalmente entre **1 y 2 puntos temporales** en habilidades entrenables.
- Al cerrar temporada, los boosts de entrenamiento se reducen al **30%**.
- Se mantiene quitado el botón **Tratar · $50.000** de Academia.
- Los juveniles lesionados se tratan desde **Empleados** con kinesiólogo contratado y sin costo para juveniles.
- Se mantienen los 20 consejos del asistente con reemplazo de `#usuario#` por el nombre del manager.
- Apartado **Cartas** revisado: menos bloques duplicados, información más compacta, resumen de bonus activo integrado y cartas más minimalistas.
- Actualizado `VERSION.md`, `config.js`, `index.html`, cache-busting y documentación a V5.15.

### V5.14 - Academia y consejos del asistente

- Quitado el botón **Tratar · $50.000** de las tarjetas de juveniles lesionados en Academia.
- Los juveniles lesionados se tratan desde **Empleados** con kinesiólogo contratado, sin costo para juveniles.
- Agregados 20 consejos del asistente sin especificidades duras, con reemplazo de `#usuario#` por el nombre del manager.
- El asistente envía un consejo al iniciar carrera y luego mensajes periódicos durante la partida.

### V5.13 - Auto más pausado, puntajes e iconos de partido

- El botón **Auto** del simulador vivo ahora avanza más lento: tarda el doble entre minuto y minuto.
- Se agrega puntaje vivo de partido para titulares de ambos equipos.
- El puntaje se calcula de forma coherente según media, moral, físico, encaje de rol, resultado parcial y eventos.
- Se agregan iconos acumulables junto al apellido del jugador: ⚽, 👟, 🟨, 🟥 y ✚.
- Los iconos se muestran tanto para el equipo del manager como para el bot.
- Se mantiene el formato compacto de lista para ahorrar espacio horizontal.

### V5.12 - Simulador vivo compacto, fatiga real y cambios bot

- Rediseño del simulador vivo en formato horizontal más compacto.
- Las estadísticas del partido ahora se muestran en una sola tarjeta comparativa, con ambos equipos en la misma línea.
- El equipo del manager y el equipo bot usan el mismo formato visual de lista.
- Titulares y suplentes se muestran como filas compactas clickeables, similar al menú de táctica.
- Las instrucciones de campo pasan a botones inferiores centrados, sin explicación visible.
- Los jugadores de ambos equipos pierden estado físico minuto a minuto.
- El bot ahora tiene banco visible y realiza cambios automáticos coherentes.

### V5.11 - Simulador táctico horizontal y cambios por clic

- Rediseño del simulador vivo en formato más horizontal y compacto.
- Se agrega tablero táctico propio con titulares y banco.
- Las sustituciones ahora se hacen por clic con confirmación.
- Se puede reacomodar jugadores intercambiando titulares.
- Se agrega selector de formación dentro del partido.
- Las instrucciones pasan a botones activables.
- Agregada instrucción **Sin instrucciones**.

### V5.10 - Simulación viva minuto a minuto

- La simulación viva pasa de bloques de 15 minutos a 90 fases de 1 minuto.
- Se agregan estadísticas en vivo, relato, eventos y barra de fases.

## Instalación incremental

Subir los archivos del ZIP respetando carpetas. Después usar **Control + F5** para evitar caché del navegador.
