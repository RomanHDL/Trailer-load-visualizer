// Tests de Intercalado: fallback de "otro carril" (mini mejora,
// 2026-09-21) + aprovechamiento de huecos reales (mejora, 2026-09-21).
// Todo corre contra las funciones reales del proyecto (resolveIntercaladoLane
// / findAvailableGaps / findBestFittingGap / packBoxes) — nada de lógica
// duplicada ni medidas inventadas: los metros siempre salen de SIZE_TABLE.

import { describe, test, expect } from 'vitest';
import {
  packBoxes,
  resolveIntercaladoLane,
  findAvailableGaps,
  findBestFittingGap,
  TRAILER_LENGTH,
} from './packing';
import { SIZE_TABLE, LOAD_MODES, getPalletOrientation } from '../data/sizeTable';

function realBox(inches, orderNumber = 'T') {
  return { inches, meters: SIZE_TABLE[inches], orderNumber };
}

describe('resolveIntercaladoLane — decide el carril del fallback de Intercalado', () => {
  test('TEST 1 — el carril preferido sí tiene espacio: se respeta tal cual', () => {
    const result = resolveIntercaladoLane({
      preferredLane: 1,
      lane1: 5,
      lane2: 3,
      palletMeters: 2,
    });
    expect(result.selectedLane).toBe(1);
    expect(result.reason).toBe('preferred_fits');
  });

  test('TEST 2 — preferido se pasa del límite, alterno sí cabe: usa el alterno', () => {
    const result = resolveIntercaladoLane({
      preferredLane: 1,
      lane1: 15,
      lane2: 10,
      palletMeters: 2, // 15+2=17 > 15.9 ; 10+2=12 <= 15.9
    });
    expect(result.selectedLane).toBe(2);
    expect(result.reason).toBe('preferred_over_limit_alternate_fits');
  });

  test('TEST 3 — ambos carriles caben: respeta la elección original de Intercalado (NO el más corto)', () => {
    // El alterno (lane2=1) tiene MÁS espacio libre que el preferido
    // (lane1=10), pero como el preferido sí cabe, debe ganar igual —
    // Intercalado sigue mandando, esto NO es "if (top < bottom) top".
    const result = resolveIntercaladoLane({
      preferredLane: 1,
      lane1: 10,
      lane2: 1,
      palletMeters: 2,
    });
    expect(result.selectedLane).toBe(1);
    expect(result.reason).toBe('preferred_fits');
  });

  test('TEST 4 — ningún carril cabe: mantiene el sobrecupo actual (carril preferido original)', () => {
    const result = resolveIntercaladoLane({
      preferredLane: 2,
      lane1: 15,
      lane2: 15,
      palletMeters: 3,
    });
    expect(result.selectedLane).toBe(2); // el preferido, sin cambios
    expect(result.reason).toBe('neither_fits_overflow');
  });

  test('TEST 5 — caso reportado (superior 15.09 / inferior 13.94): usa el hueco real de abajo', () => {
    const preferredCurrent = 15.09;
    const alternateCurrent = 13.94;
    // Longitud efectiva que NO entra arriba pero SÍ entra abajo
    // (15.09 + L > 15.9  y  13.94 + L <= 15.9  →  0.81 < L <= 1.96).
    const palletMeters = SIZE_TABLE[50]; // 1.02 m real, cae en ese rango

    const result = resolveIntercaladoLane({
      preferredLane: 1, // Intercalado eligió "arriba"
      lane1: preferredCurrent,
      lane2: alternateCurrent,
      palletMeters,
    });

    expect(result.preferredProjectedLength).toBeCloseTo(16.11, 5);
    expect(result.alternateProjectedLength).toBeCloseTo(14.96, 5);
    expect(result.selectedLane).toBe(2); // termina abajo
    expect(result.reason).toBe('preferred_over_limit_alternate_fits');
  });

  test('la tolerancia de punto flotante no permite cargas realmente fuera del límite', () => {
    // Un excedente real (no solo arrastre de flotantes) sigue sin caber.
    const result = resolveIntercaladoLane({
      preferredLane: 1,
      lane1: 15.9,
      lane2: 15.9,
      palletMeters: 0.01,
    });
    expect(result.selectedLane).toBe(1);
    expect(result.reason).toBe('neither_fits_overflow');
  });
});

describe('packBoxes en modo Intercalado — fallback integrado al packing real', () => {
  test('TEST 5/6/7 — aprovecha el hueco real, sigue recalculando normal después de agregar/quitar', () => {
    // Prefijo real (misma medida que ya usa el proyecto, 86") con cantidad
    // impar a propósito para dejar los 2 carriles con una diferencia real de
    // espacio, cerca del límite — el estado se lee del resultado real de
    // packBoxes, no se calcula a mano.
    const prefix = Array(13)
      .fill(86)
      .map((inches) => realBox(inches));

    const before = packBoxes(prefix, LOAD_MODES.MIXED);
    const fuller = before.lane1 >= before.lane2 ? 1 : 2;
    const emptier = fuller === 1 ? 2 : 1;
    const fullerLen = fuller === 1 ? before.lane1 : before.lane2;
    const emptierLen = fuller === 1 ? before.lane2 : before.lane1;

    // Entre las medidas grandes reales, buscamos una que NO quepa en el
    // carril más lleno pero SÍ quepa en el que tiene el hueco real. Si el
    // prefijo no produce esa condición para ninguna medida real, el test
    // falla de forma ruidosa en vez de dar un falso positivo.
    const critical = [65, 75, 86, 100]
      .map((inches) => ({ inches, meters: SIZE_TABLE[inches] }))
      .find(
        ({ meters }) =>
          fullerLen + meters > TRAILER_LENGTH + 1e-9 &&
          emptierLen + meters <= TRAILER_LENGTH + 1e-9
      );
    expect(critical).toBeTruthy();

    // TEST 5: el pallet crítico debe terminar en el carril con el hueco real.
    const withCritical = [...prefix, realBox(critical.inches)];
    const after = packBoxes(withCritical, LOAD_MODES.MIXED);
    const lastPlaced = after.placed[after.placed.length - 1];
    expect(lastPlaced.lane).toBe(emptier);
    expect(Math.max(after.lane1, after.lane2)).toBeLessThanOrEqual(
      TRAILER_LENGTH + 1e-9
    );

    // TEST 6: agregar otro pallet después vuelve a calcular todo con las
    // reglas normales (packBoxes es una función pura, sin estado
    // "recordado" entre llamadas — nunca se queda pegado en la excepción).
    const withAnother = [...withCritical, realBox(50)];
    const afterAnother = packBoxes(withAnother, LOAD_MODES.MIXED);
    expect(afterAnother.placed).toHaveLength(withAnother.length);
    expect(afterAnother.totalLinear).toBeCloseTo(
      withAnother.reduce((s, b) => s + b.meters, 0),
      5
    );

    // TEST 7: quitar el pallet agregado (simplemente no incluirlo) recalcula
    // correctamente — vuelve a dar exactamente el mismo resultado que antes
    // de agregarlo.
    const afterRemoving = packBoxes(withCritical, LOAD_MODES.MIXED);
    expect(afterRemoving.lane1).toBeCloseTo(after.lane1, 5);
    expect(afterRemoving.lane2).toBeCloseTo(after.lane2, 5);
    expect(afterRemoving.placed).toHaveLength(withCritical.length);
  });

  test('mezcla chica sin rozar el límite: cada tarima sigue en su carril, ningún carril se pasa', () => {
    // Con el aprovechamiento de huecos activo (2026-09-21) el carril exacto
    // de cada tarima puede diferir del turno de ronda "de libro" cuando eso
    // aprovecha mejor el espacio — eso es el comportamiento nuevo, a
    // propósito. Lo que SÍ debe seguir siendo cierto siempre: la tarima
    // termina en UN solo carril, con la orientación correcta, y ningún
    // carril se pasa del límite sin necesidad (hay de sobra para las 7).
    const boxes = [50, 55, 58, 65, 75, 86, 100].map((inches) => realBox(inches));
    const result = packBoxes(boxes, LOAD_MODES.MIXED);
    expect(result.placed).toHaveLength(boxes.length);
    result.placed.forEach((p) => {
      expect([1, 2]).toContain(p.lane);
    });
    const chica = result.placed.filter((p) => p.inches < 65);
    const grande = result.placed.filter((p) => p.inches >= 65);
    expect(chica.every((p) => p.orientation === 'horizontal')).toBe(true);
    expect(grande.every((p) => p.orientation === 'vertical')).toBe(true);
    expect(Math.max(result.lane1, result.lane2)).toBeLessThanOrEqual(
      TRAILER_LENGTH + 1e-9
    );
  });
});

describe('findAvailableGaps / findBestFittingGap — aprovechamiento de huecos reales', () => {
  test('CASO 1 — una tarima chica (50") sí cabe en un hueco real: debe colocarse ahí', () => {
    const gaps = findAvailableGaps({ lane1: 10, lane2: 14.5 });
    // hueco carril 1 = 5.9 m, hueco carril 2 = 1.4 m — el 50" (1.02 m) cabe
    // en los dos, pero el de abajo es el hueco real más chico que lo acepta.
    const best = findBestFittingGap(gaps, SIZE_TABLE[50]);
    expect(best).not.toBeNull();
    expect(best.lane).toBe(2);
  });

  test('CASO 2 — varios huecos válidos: elige el más chico que sí la acepta (best fit)', () => {
    const gaps = findAvailableGaps({ lane1: 12.9, lane2: 14.4 });
    // hueco carril 1 = 3.0 m, hueco carril 2 = 1.5 m — ambos aceptan un 50"
    // (1.02 m); debe ganar el de 1.5 m (más chico), no el de 3.0 m.
    const best = findBestFittingGap(gaps, SIZE_TABLE[50]);
    expect(best.lane).toBe(2);
    expect(best.size).toBeCloseTo(1.5, 5);
  });

  test('CASO 3 — ningún hueco es válido: findBestFittingGap devuelve null', () => {
    const gaps = findAvailableGaps({ lane1: 15.5, lane2: 15.6 });
    // huecos de 0.4 m y 0.3 m — un 65" (1.60 m) no cabe en ninguno.
    const best = findBestFittingGap(gaps, SIZE_TABLE[65]);
    expect(best).toBeNull();
  });

  test('CASO 1 (integrado) — una chica agregada a una carga con grandes va al hueco real, no al hueco más grande', () => {
    // 4 grandes (65") + 10 chicas (50") ya colocadas (números verificados
    // contra el packing real): deja el carril superior casi lleno
    // (15.58 m, hueco real de 0.32 m — NO le cabe un 50" más) y el inferior
    // con mucho hueco (1.02 m usado, hueco real de 14.88 m). Al agregar una
    // chica más, debe ir al inferior (el único hueco real que la acepta).
    const base = [...Array(4).fill(65), ...Array(10).fill(50)].map((inches) =>
      realBox(inches)
    );
    const before = packBoxes(base, LOAD_MODES.MIXED);
    expect(before.lane1).toBeCloseTo(15.58, 5);
    expect(before.lane2).toBeCloseTo(1.02, 5);

    const withChica = [...base, realBox(50)];
    const after = packBoxes(withChica, LOAD_MODES.MIXED);
    const lastPlaced = after.placed[after.placed.length - 1];
    expect(lastPlaced.lane).toBe(2);
    expect(after.lane2).toBeCloseTo(2.04, 5);
  });

  test('CASO 3 (integrado) — sin hueco compatible, Intercalado sigue su lógica normal', () => {
    // Carga vacía: ambos huecos son el trailer completo (15.9 m), best fit
    // no tiene nada que "ajustar" de forma distinta al turno normal — el
    // primer grande sigue yendo al carril superior, como siempre.
    const result = packBoxes([realBox(100)], LOAD_MODES.MIXED);
    expect(result.placed[0].lane).toBe(1);
  });

  test('CASO 4 — sin hueco en el carril de turno, pero el otro sí cabe: sigue usando la mejora existente', () => {
    // 6 pares [100",65"] uno tras otro (números verificados contra el
    // packing real, no calculados a mano): deja lane1=14.88, lane2=9.84.
    const alternating = [];
    for (let i = 0; i < 6; i++) {
      alternating.push(realBox(100), realBox(65));
    }
    const before = packBoxes(alternating, LOAD_MODES.MIXED);
    expect(before.lane1).toBeCloseTo(14.88, 5);
    expect(before.lane2).toBeCloseTo(9.84, 5);

    // Hueco real: lane1=1.02 (no le cabe un 100"=2.52), lane2=6.06 (sí le
    // cabe) — findBestFittingGap ya resuelve esto en la capa de huecos, que
    // en este modelo coincide exactamente con lo que resolvería el
    // fallback de "otro carril" si tuviera que intervenir (ambas capas
    // están de acuerdo en la misma respuesta).
    const withCritical = [...alternating, realBox(100)];
    const after = packBoxes(withCritical, LOAD_MODES.MIXED);
    const lastPlaced = after.placed[after.placed.length - 1];
    expect(lastPlaced.lane).toBe(2);
    expect(after.lane2).toBeCloseTo(12.36, 5);
    expect(Math.max(after.lane1, after.lane2)).toBeLessThanOrEqual(
      TRAILER_LENGTH + 1e-9
    );
  });

  test('CASO 5 — no cabe en ningún hueco ni en ningún carril: mantiene el sobrecupo actual', () => {
    // 19×65" (números verificados contra el packing real): termina en
    // lane1=16.00 / lane2=14.40 — el último 65" no cabía en ningún hueco
    // real (ambos huecos < 1.6 m) y el sistema NO lo bloquea, lo deja
    // exceder el límite tal como ya hacía antes de esta mejora.
    const seq = Array(19).fill(65).map((inches) => realBox(inches));
    const before18 = packBoxes(seq.slice(0, 18), LOAD_MODES.MIXED);
    const gapsBefore = findAvailableGaps({
      lane1: before18.lane1,
      lane2: before18.lane2,
    });
    expect(findBestFittingGap(gapsBefore, SIZE_TABLE[65])).toBeNull();

    const after = packBoxes(seq, LOAD_MODES.MIXED);
    expect(after.lane1).toBeCloseTo(16, 5);
    expect(after.lane2).toBeCloseTo(14.4, 5);
    expect(Math.max(after.lane1, after.lane2)).toBeGreaterThan(TRAILER_LENGTH);
  });
});

describe('TEST 8 — la orientación por pulgada no cambia con el fallback nuevo', () => {
  const expected = {
    50: 'horizontal',
    55: 'horizontal',
    58: 'horizontal',
    65: 'vertical',
    75: 'vertical',
    86: 'vertical',
    100: 'vertical',
  };

  Object.entries(expected).forEach(([inches, orientation]) => {
    test(`${inches}" → ${orientation}`, () => {
      expect(getPalletOrientation(Number(inches), LOAD_MODES.MIXED)).toBe(
        orientation
      );
    });
  });
});
