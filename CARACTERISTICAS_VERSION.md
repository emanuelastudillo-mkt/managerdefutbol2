# V5.29 - Pulido visual del menú de Táctica

## Cambios principales

- Reorganizada la pantalla de **Táctica y convocatoria** en una cuadrícula de dos zonas: bloque principal a la izquierda y panel de acciones/controles a la derecha.
- La pizarra táctica vuelve a quedar alineada como bloque principal, sin depender de una columna izquierda de visores.
- Los visores de **Defensa**, **Medios** y **Delantera** ahora están en el mismo panel que las **Instrucciones zonales**.
- Los botones de mayor uso (**Formación**, **Mejor once**, **Mejor condición física** y **Confirmar equipo**) pasan al panel derecho.
- En la lista de titulares, **Estado físico** y **Moral** se muestran como círculos compactos tipo reloj/torta, sin número interno.
- En suplentes y reservas se quitaron los textos numéricos de físico/moral y se reemplazaron por indicadores circulares compactos.
- Se ajustaron paddings, radios, columnas y gaps para que la pantalla se sienta más cercana a una cuadrícula de bloques conectados.

## Alcance técnico

- Se modificó únicamente la estructura visual del render de Táctica y estilos CSS asociados.
- No se cambiaron reglas de simulación, formación, selección, guardado de tácticas, cambios automáticos ni validación de alineación.

## Compatibilidad

Se implementa solo. No requiere reiniciar partida. Los cambios son visuales y mantienen los mismos IDs/eventos funcionales de formación, autoselección, guardado y selección de jugadores.
