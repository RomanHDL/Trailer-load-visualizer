// Lógica de packing del trailer en 2 carriles.
// - Caja con lanes=1 → ocupa ancho completo del trailer; ambos carriles avanzan
//   al máximo entre los dos antes de colocar la caja, y luego suman su largo.
// - Caja con lanes=2 → va al carril menos lleno y solo ese carril avanza.
//
// El "metros usados" del trailer es el máximo entre los dos carriles
// (lo que físicamente determina si cabe o no).

import { SIZE_LANES } from '../data/sizeTable';

export function packBoxes(boxes) {
  let lane1 = 0;
  let lane2 = 0;

  const placed = boxes.map((b, i) => {
    const lanes = SIZE_LANES[b.inches] || 1;

    if (lanes === 1) {
      const start = Math.max(lane1, lane2);
      lane1 = start + b.meters;
      lane2 = start + b.meters;
      return {
        ...b,
        idx: i,
        start,
        end: start + b.meters,
        lane: 0, // 0 = ambos carriles
        full: true,
      };
    }

    // lanes === 2: al carril menos lleno (empate → arriba)
    if (lane1 <= lane2) {
      const start = lane1;
      lane1 = start + b.meters;
      return {
        ...b,
        idx: i,
        start,
        end: start + b.meters,
        lane: 1,
        full: false,
      };
    }
    const start = lane2;
    lane2 = start + b.meters;
    return {
      ...b,
      idx: i,
      start,
      end: start + b.meters,
      lane: 2,
      full: false,
    };
  });

  return {
    placed,
    totalUsed: Math.max(lane1, lane2),
    lane1,
    lane2,
    totalLinear: boxes.reduce((s, b) => s + b.meters, 0),
  };
}
