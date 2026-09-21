// Tests del fallback de aprovechamiento de espacio del modo Intercalado
// (mini mejora, 2026-09-21). Todo corre contra las funciones reales del
// proyecto (resolveIntercaladoLane / packBoxes) — nada de lógica duplicada
// ni medidas inventadas: los metros siempre salen de SIZE_TABLE.

import { describe, test, expect } from 'vitest';
import {
  packBoxes,
  resolveIntercaladoLane,
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

  test('el modo Intercalado sin conflicto de límite sigue funcionando exactamente igual que antes', () => {
    // Mezcla chica del test original de la funcionalidad Intercalado (sin
    // rozar el límite) — el fallback no debe alterar en nada el patrón
    // 1 grande / hasta 2 chicas alternando de carril.
    const boxes = [50, 55, 58, 65, 75, 86, 100].map((inches) => realBox(inches));
    const result = packBoxes(boxes, LOAD_MODES.MIXED);
    const orientationsByLane = result.placed.map((p) => ({
      inches: p.inches,
      lane: p.lane,
      orientation: p.orientation,
    }));
    // Chicas (<65") comparten carril de a 2; grandes (>=65") van solas.
    const chica = orientationsByLane.filter((p) => p.inches < 65);
    const grande = orientationsByLane.filter((p) => p.inches >= 65);
    expect(chica.every((p) => p.orientation === 'horizontal')).toBe(true);
    expect(grande.every((p) => p.orientation === 'vertical')).toBe(true);
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
