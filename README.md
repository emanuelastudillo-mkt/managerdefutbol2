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
