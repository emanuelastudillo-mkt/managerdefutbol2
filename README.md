# Una Vida de Mánager · V9.81

## Simulador vivo · ritmo, relato ampliable y posesión prolongada

- El avance visual del partido vuelve a duplicar su duración: `simulacionVivaAutoMs` pasa de 1680 ms a 3360 ms por minuto simulado.
- El reloj continúa avanzando segundo a segundo y las 540 fases internas siguen representando 10 segundos cada una.
- El bloque `Relato en vivo` limita cada fila a dos líneas en la vista normal para evitar tarjetas visualmente demasiado altas.
- Se agrega `Pantalla completa` para ampliar únicamente el historial de relatos. La vista ampliada conserva scroll, jugadores clickeables, escudos e iconos finales.
- El motor incorpora control de posesión prolongada. La cantidad de pases que un equipo intenta encadenar antes de acelerar depende de calidad de pase, visión, serenidad, superioridad técnica, cantidad real de jugadores en zona media y estilo/instrucciones.
- `Posesión`, `Cuidar el resultado` y el planteo de bajar ritmo favorecen secuencias largas; no conceden precisión automática.
- Los equipos de baja calidad siguen expuestos a errores técnicos, presión, intercepciones y robos. Elegir una instrucción conservadora por sí sola no garantiza dominar la pelota.
- La posesión visible puede llegar a 92% en diferencias extremas de capacidad y control, permitiendo defenderse con balón cuando el contexto lo justifica.
- No se modifican las 540 fases, el volumen ofensivo base de V9.79, cansancio, tarjetas, lesiones, ventaja local ni Worker/API/D1.
