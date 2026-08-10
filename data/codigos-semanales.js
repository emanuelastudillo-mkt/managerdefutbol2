/*
  Códigos promocionales semanales de Una vida de manager.

  Publicar este archivo normalmente vacío. Para una campaña semanal:
  1. Definir activo: true.
  2. Completar semana, validoDesde y validoHasta con fechas YYYY-MM-DD.
  3. Agregar solamente huellas SHA-256 y beneficios dentro de codigos.
  4. Al terminar la campaña, volver a dejar activo: false y codigos: [].

  IMPORTANTE:
  - No escribir el código real en este archivo público.
  - La huella debe generarse con la misma función utilizada por el juego:
      specialCodeFingerprint('CODIGO-REAL')
  - validoDesde y validoHasta se evalúan con la fecha real del dispositivo.
*/
window.GAME_WEEKLY_CODES = {
  version: 1,
  activo: false,
  semana: '',
  validoDesde: '',
  validoHasta: '',
  codigos: [
    /*
    {
      huella: 'PEGAR_HUELLA_SHA256_AQUI',
      nombre: 'Código semanal',
      descripcion: 'Descripción del beneficio.',
      reutilizable: false,
      beneficios: {
        prestigio: 0,
        puntosHabilidad: 0,
        dineroClub: 0
      }
    }
    */
  ]
};
