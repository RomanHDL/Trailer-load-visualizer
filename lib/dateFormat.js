// Helper para formatear fechas usando la zona horaria del navegador
// del usuario. Si por algún motivo el browser reporta UTC (mal
// configurado, VM, etc.), cae a "America/Mexico_City" que es el
// contexto operativo principal de esta app.

export function getUserTimeZone() {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz !== 'UTC') return tz;
    }
  } catch {
    /* ignore */
  }
  return 'America/Mexico_City';
}

export function formatLocalDate(date, opts = {}) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString('es-MX', {
      timeZone: getUserTimeZone(),
      ...opts,
    });
  } catch {
    return new Date(date).toLocaleString();
  }
}
