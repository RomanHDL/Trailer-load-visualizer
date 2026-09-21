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
//   Fallback de aprovechamiento de espacio (mini mejora, 2026-09-21): si el
//   carril que Intercalado prefiere para una tarima ya rebasaría
//   TRAILER_LENGTH pero el OTRO carril sí tiene espacio real para ella, se
//   usa el otro carril en su lugar — ver resolveIntercaladoLane. Intercalado
//   sigue mandando: si ambos carriles caben, o si ninguno cabe, se respeta
//   la preferencia original (Caso A / Caso C respectivamente). Esto NUNCA
//   se vuelve "elegir siempre el carril más corto" — solo se activa cuando
//   el preferido específicamente se pasa del límite.
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

  // Aplica el fallback de aprovechamiento de espacio antes de colocar: el
  // carril de la ronda es solo la "preferencia", el carril final puede
  // cambiar si esa preferencia ya no cabe y el otro sí.
  function placeIntercalado(b, i, preferredLane) {
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
