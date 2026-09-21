// Lógica de packing del trailer en 2 carriles. Nunca hay "ancho completo /
// ambos carriles a la vez" — cada tarima siempre ocupa exactamente un
// carril. La orientación (data/sizeTable.js) es solo una etiqueta
// informativa que viaja con cada tarima, no cambia el packing por sí sola.
//
// - Modo ALL_VERTICAL (histórico, por defecto): cada tarima va al carril
//   con menos metros acumulados en ese momento (empate → carril superior).
//   Ya elige siempre el carril con más espacio libre, así que el fallback
//   de abajo no aplica aquí (no hay nada que "aprovechar" que este modo no
//   esté haciendo ya).
// - Modo MIXED ("Intercalado", regla obligatoria por pulgada): las grandes
//   (>= 65") y las chicas (< 65") se acomodan en rondas — 1 grande en un
//   carril, hasta 2 chicas en el otro — alternando en cada ronda cuál
//   carril recibe la grande. Confirmado explícitamente por el usuario.
//
//   Cada tarima que le toca colocar a Intercalado pasa por 2 capas, en este
//   orden (confirmado explícitamente por el usuario, 2026-09-21):
//
//   1) Aprovechamiento de huecos reales (findAvailableGaps/
//      findBestFittingGap/placePalletIntoGap): ANTES de mirar de quién era
//      el turno de ronda, se revisa el hueco real que le queda a cada
//      carril (su espacio hasta TRAILER_LENGTH). Si la tarima cabe en uno o
//      los dos, se usa el de mejor ajuste (best fit: el hueco más chico que
//      igual la acepta) — sin importar el turno de ronda. Esto aplica a
//      cualquier tarima, grande o chica.
//   2) Si NINGÚN hueco real la acepta, se cae a la lógica normal de
//      Intercalado (turno de ronda) + su propio fallback de "otro carril"
//      (resolveIntercaladoLane, mini mejora anterior — 2026-09-21): si el
//      carril de turno rebasaría TRAILER_LENGTH pero el otro sí cabe, se usa
//      el otro; si ninguno cabe, se mantiene el sobrecupo actual.
//
// El "metros usados" del trailer es el máximo entre los dos carriles
// (lo que físicamente determina si cabe o no).

import { getPalletOrientation, LOAD_MODES, DEFAULT_LOAD_MODE } from '../data/sizeTable';

// Mismo límite oficial del trailer que usa pages/index.js (idéntica fuente:
// la variable de entorno pública, con el mismo fallback de 15.9). No se
// inventa ninguna medida nueva — es el único límite real que ya existe en
// el proyecto, solo que packBoxes no lo conocía hasta ahora.
export const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

// Tolerancia mínima (unos pocos milímetros) solo para la comparación interna
// contra el límite, y así evitar falsos "no cabe" por arrastre de punto
// flotante (ej. 15.900000000000002 > 15.9). No cambia ninguna medida real
// mostrada al usuario, solo decide si "cabe" o "no cabe" en el fallback.
const LIMIT_EPSILON_M = 0.001;

function fitsWithinLimit(lengthMeters, trailerLength) {
  return lengthMeters <= trailerLength + LIMIT_EPSILON_M;
}

// ===== Aprovechamiento de huecos reales (mini mejora, 2026-09-21) =====
// En este modelo de 2 carriles secuenciales (cada tarima se apila al final
// de su carril, nunca hay huecos entre tarimas) el único "hueco real" que
// puede existir en un momento dado es el espacio que le queda a cada
// carril antes de TRAILER_LENGTH — como mucho 2 huecos, uno por carril.
//
// findAvailableGaps: los 2 huecos actuales (antes de colocar la tarima).
export function findAvailableGaps({ lane1, lane2, trailerLength = TRAILER_LENGTH }) {
  return [
    { lane: 1, size: trailerLength - lane1 },
    { lane: 2, size: trailerLength - lane2 },
  ];
}

// findBestFittingGap: de los huecos donde la tarima SÍ cabe físicamente,
// elige el más chico (best fit) — así se aprovecha el hueco más ajustado en
// vez de "gastar" uno más grande que podría hacer falta después. Empate →
// carril superior (misma convención que el resto del proyecto). Devuelve
// null si la tarima no cabe en ningún hueco real.
export function findBestFittingGap(gaps, palletMeters) {
  const compatible = gaps.filter((g) => fitsWithinLimit(palletMeters, g.size));
  if (compatible.length === 0) return null;
  return compatible.reduce((best, g) =>
    g.size < best.size - LIMIT_EPSILON_M ||
    (Math.abs(g.size - best.size) <= LIMIT_EPSILON_M && g.lane < best.lane)
      ? g
      : best
  );
}

// Decide en qué carril debe quedar una tarima bajo el modo Intercalado,
// dado el carril que su regla normal de rondas ya prefiere. Función pura
// (no muta nada) para poder testearla directo — packBoxes solo la consulta
// y aplica el resultado.
//
//   preferredLane: 1 o 2, el carril que la regla de rondas ya eligió.
//   lane1/lane2: metros ya acumulados en cada carril ANTES de esta tarima.
//   palletMeters: longitud efectiva real de la tarima (b.meters — la misma
//     que usa el resto del algoritmo, con orientación/márgenes ya
//     aplicados; nunca se recalcula aquí).
//   trailerLength: límite real del trailer (TRAILER_LENGTH por defecto).
//
// Devuelve { selectedLane, reason, ...campos de diagnóstico } — los campos
// de diagnóstico son los que pide validar el caso de prueba manual, y los
// usan los tests; no se imprimen en producción.
export function resolveIntercaladoLane({
  preferredLane,
  lane1,
  lane2,
  palletMeters,
  trailerLength = TRAILER_LENGTH,
}) {
  const alternateLane = preferredLane === 1 ? 2 : 1;
  const preferredCurrentLength = preferredLane === 1 ? lane1 : lane2;
  const alternateCurrentLength = alternateLane === 1 ? lane1 : lane2;
  const preferredProjectedLength = preferredCurrentLength + palletMeters;
  const alternateProjectedLength = alternateCurrentLength + palletMeters;

  const preferredFits = fitsWithinLimit(preferredProjectedLength, trailerLength);
  const alternateFits = fitsWithinLimit(alternateProjectedLength, trailerLength);

  const base = {
    preferredLane,
    alternateLane,
    preferredCurrentLength,
    alternateCurrentLength,
    palletEffectiveLength: palletMeters,
    preferredProjectedLength,
    alternateProjectedLength,
  };

  // Caso A: el carril preferido por Intercalado cabe — se respeta tal cual,
  // aunque el otro carril tenga más espacio libre (Intercalado sigue
  // mandando, esto NO es "elegir siempre el carril más corto").
  if (preferredFits) {
    return { ...base, selectedLane: preferredLane, reason: 'preferred_fits' };
  }
  // Caso B: el preferido se pasa del límite, pero el otro sí tiene espacio
  // real — se aprovecha ese hueco.
  if (alternateFits) {
    return {
      ...base,
      selectedLane: alternateLane,
      reason: 'preferred_over_limit_alternate_fits',
    };
  }
  // Caso C: ninguno cabe — se mantiene el comportamiento actual de
  // sobrecupo (igual que si este fallback no existiera).
  return { ...base, selectedLane: preferredLane, reason: 'neither_fits_overflow' };
}

export function packBoxes(boxes, loadMode = DEFAULT_LOAD_MODE) {
  let lane1 = 0;
  let lane2 = 0;
  const placed = [];

  function place(b, i, lane) {
    const orientation = getPalletOrientation(b.inches, loadMode);
    const start = lane === 1 ? lane1 : lane2;
    if (lane === 1) lane1 = start + b.meters;
    else lane2 = start + b.meters;
    placed.push({
      ...b,
      idx: i,
      start,
      end: start + b.meters,
      lane,
      full: false,
      orientation,
    });
  }

  // Coloca la tarima en el carril del hueco elegido por findBestFittingGap
  // — en este modelo de carriles secuenciales "meterla en el hueco" es
  // exactamente lo mismo que apilarla al final de ese carril (no hay huecos
  // intermedios donde insertar).
  function placePalletIntoGap(b, i, gap) {
    place(b, i, gap.lane);
  }

  // Antes de aplicar la preferencia de ronda de Intercalado, se revisan los
  // huecos reales de AMBOS carriles: si la tarima cabe en uno o los dos, se
  // usa el de mejor ajuste (best fit) sin importar de quién era el turno.
  // Solo si NINGÚN hueco real la acepta se cae a la lógica normal de
  // Intercalado — que a su vez conserva su propio fallback de "otro carril"
  // (resolveIntercaladoLane) para el caso de sobrecupo.
  function placeIntercalado(b, i, preferredLane) {
    const gaps = findAvailableGaps({ lane1, lane2 });
    const bestGap = findBestFittingGap(gaps, b.meters);
    if (bestGap) {
      placePalletIntoGap(b, i, bestGap);
      return;
    }
    const { selectedLane } = resolveIntercaladoLane({
      preferredLane,
      lane1,
      lane2,
      palletMeters: b.meters,
    });
    place(b, i, selectedLane);
  }

  if (loadMode === LOAD_MODES.MIXED) {
    const grandes = [];
    const chicas = [];
    boxes.forEach((b, i) => {
      const bucket =
        getPalletOrientation(b.inches, loadMode) === 'vertical' ? grandes : chicas;
      bucket.push({ b, i });
    });

    let gi = 0;
    let ci = 0;
    let round = 0;
    while (gi < grandes.length || ci < chicas.length) {
      const grandeLane = round % 2 === 0 ? 1 : 2;
      const chicaLane = grandeLane === 1 ? 2 : 1;
      if (gi < grandes.length) {
        placeIntercalado(grandes[gi].b, grandes[gi].i, grandeLane);
        gi++;
      }
      for (let k = 0; k < 2 && ci < chicas.length; k++) {
        placeIntercalado(chicas[ci].b, chicas[ci].i, chicaLane);
        ci++;
      }
      round++;
    }
  } else {
    boxes.forEach((b, i) => {
      place(b, i, lane1 <= lane2 ? 1 : 2);
    });
  }

  return {
    placed,
    totalUsed: Math.max(lane1, lane2),
    lane1,
    lane2,
    totalLinear: boxes.reduce((s, b) => s + b.meters, 0),
  };
}
