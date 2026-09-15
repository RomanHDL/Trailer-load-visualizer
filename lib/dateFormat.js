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

// ===== Helpers de "día calendario" para agrupar órdenes por fecha local =====
// Todo lo de abajo trabaja con un "dayKey" string 'YYYY-MM-DD' que representa
// un día calendario, no un instante. Evita el bug clásico de
// `new Date(x).toISOString().split('T')[0]`, que trunca en UTC y puede
// mover una orden de las 11:30pm al día siguiente.

const MONTHS_SHORT_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const MONTHS_LONG_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// 'YYYY-MM-DD' del día calendario que corresponde a `date` en la zona
// horaria dada (por defecto, la del usuario). `en-CA` da formato ISO nativo.
export function getLocalDayKey(date, timeZone = getUserTimeZone()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

export function dayKeyParts(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return { year, month, day };
}

// Suma/resta días calendario a un dayKey (aritmética en UTC-mediodía para
// no toparse con saltos de horario de verano).
export function addDaysToKey(dayKey, delta) {
  const { year, month, day } = dayKeyParts(dayKey);
  const base = new Date(Date.UTC(year, month - 1, day, 12));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

export function formatDayShort(dayKey) {
  const { month, day } = dayKeyParts(dayKey);
  return `${day} ${MONTHS_SHORT_ES[month - 1]}`;
}

export function formatDayLong(dayKey) {
  const { year, month, day } = dayKeyParts(dayKey);
  return `${day} de ${MONTHS_LONG_ES[month - 1]} de ${year}`;
}

export function formatDayLongNoYear(dayKey) {
  const { month, day } = dayKeyParts(dayKey);
  return `${day} de ${MONTHS_LONG_ES[month - 1]}`;
}
