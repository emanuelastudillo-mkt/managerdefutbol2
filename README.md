# V9.77 · Relatos con jugadores y ritmo de lectura x2

Ajuste de presentación del motor continuo de 360 fases.

- Cada fase del motor puede alimentar el Relato en vivo con los jugadores concretos que intervienen.
- Se narran pase corto, pase largo, pase profundo, centro, regate y remate.
- En acciones fallidas se identifica al defensor que intercepta, bloquea o gana el duelo cuando existe.
- En remates al arco se identifica al arquero cuando corresponde.
- Los relatos de las cuatro fases de cada minuto aparecen sincronizados con el reloj en :15, :30, :45 y :00; no se muestran todos de golpe.
- El avance automático pasa de 840 ms a 1680 ms por minuto simulado: exactamente 2× más lento.
- El reloj sigue avanzando segundo a segundo y las 360 fases siguen representando 90 minutos.
- No cambia ninguna probabilidad, cansancio, tarjetas, lesiones, goles, posesión ni lógica del motor.
- No modifica Worker, API ni D1.

Ver `AJUSTES-V9.77.md`.

# V9.76 · Reloj MM:SS sincronizado con las 360 fases

Ajuste visual del simulador en vivo sobre V9.74.

- El encabezado del partido muestra un reloj `MM:SS`.
- Cada fase interna representa 15 segundos: `00:15`, `00:30`, `00:45`, `01:00`... hasta `90:00`.
- El contador de fase visible usa ahora las 360 fases reales del motor continuo.
- Durante el entretiempo el reloj de partido queda congelado en `45:00`.
- El avance visual del reloj se anima rápidamente entre las cuatro fases que componen cada minuto simulado.
- Terminar partido salta correctamente a `90:00`.
- No cambia ninguna probabilidad, acción, cansancio, tarjetas, lesiones, goles ni lógica del motor.
- No modifica Worker, API ni D1.

Ver `AJUSTES-V9.75.md`.


## V9.76 · Simulador continuo
- Reloj visible segundo a segundo, acelerado y sincronizado con las fases de 15 segundos.
- El partido arranca en reproducción automática; desaparece `Simular 1 minuto`.
- Botón `Pausa` / `Reanudar` para detener o continuar el avance.
- Relato en vivo convertido en historial con el mismo formato compacto de Eventos.
- Relatos y eventos muestran hasta 5 filas visibles y luego usan scroll vertical.
