// Lógica de packing del trailer en 2 carriles. Nunca hay "ancho completo /
// ambos carriles a la vez" — cada tarima siempre ocupa exactamente un
// carril. La orientación (data/sizeTable.js) es solo una etiqueta
// informativa que viaja con cada tarima, no cambia el packing por sí sola.
//
// - Modo ALL_VERTICAL (histórico, por defecto): cada tarima va al carril
//   con menos metros acumulados en ese momento (empate → carril superior).
// - Modo MIXED ("Intercalado", regla obligatoria por pulgada): las grandes
//   (>= 65") y las chicas (< 65") se acomodan en rondas — 1 grande en un
//   carril, hasta 2 chicas en el otro — alternando en cada ronda cuál
//   carril recibe la grande. Confirmado explícitamente por el usuario.
//
// El "metros usados" del trailer es el máximo entre los dos carriles
// (lo que físicamente determina si cabe o no).

import { getPalletOrientation, LOAD_MODES, DEFAULT_LOAD_MODE } from '../data/sizeTable';

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
        place(grandes[gi].b, grandes[gi].i, grandeLane);
        gi++;
      }
      for (let k = 0; k < 2 && ci < chicas.length; k++) {
        place(chicas[ci].b, chicas[ci].i, chicaLane);
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
