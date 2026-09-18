// Tabla estándar de medidas (pulgadas -> metros que ocupa la caja en el trailer)
// Hardcodeada según especificación.
const BASE_SIZE_TABLE = {
  50: 1.0,
  55: 1.45,
  58: 1.45,
  65: 1.58,
  75: 1.88,
  86: 2.13,
  100: 2.5,
};

// Margen extra por esquineros de flejado, 1 cm de cada lado de la tarima.
// El cm de margen que ya trae la medida base es tolerancia general de
// medición y no alcanza a cubrir el espacio físico que ocupan los
// esquineros — sin este extra el cubicaje puede quedar corto en la vida real.
export const CORNER_PROTECTOR_MARGIN_CM = 1; // por lado
export const CORNER_PROTECTOR_MARGIN_M =
  (CORNER_PROTECTOR_MARGIN_CM * 2) / 100;

export const SIZE_TABLE = Object.fromEntries(
  Object.entries(BASE_SIZE_TABLE).map(([inches, meters]) => [
    inches,
    Number((meters + CORNER_PROTECTOR_MARGIN_M).toFixed(4)),
  ])
);

// ===== Orientación por pulgada — fuente única de verdad =====
// La orientación es una ETIQUETA informativa (tooltip, PDF, snapshot):
//   < 65"  -> horizontal
//   >= 65" -> vertical (65" ya pertenece a este grupo)
//
// Modos de carga del contenedor (seleccionables por el usuario arriba del
// simulador, aplican a la orden/carga completa) — solo 2, a propósito:
//   ALL_VERTICAL -> comportamiento histórico del proyecto: cada tarima al
//                   carril con menos metros acumulados (empate → carril
//                   superior), sin importar la medida. Todas se etiquetan
//                   "Vertical". Es el modo por defecto.
//   MIXED        -> "Intercalado" (regla obligatoria por pulgada, no la
//                   elige el usuario tarima por tarima): las grandes
//                   (>= 65") y las chicas (< 65") se acomodan en rondas —
//                   1 grande en un carril, hasta 2 chicas en el otro —
//                   alternando en cada ronda cuál carril recibe la grande
//                   (ver packBoxes en lib/packing.js). Nunca hay ancho
//                   completo / ambos carriles a la vez.
export const LOAD_MODES = {
  ALL_VERTICAL: 'allVertical',
  MIXED: 'mixed',
};

export const DEFAULT_LOAD_MODE = LOAD_MODES.ALL_VERTICAL;

export const LOAD_MODE_OPTIONS = [
  { value: LOAD_MODES.ALL_VERTICAL, label: 'Todas verticales' },
  { value: LOAD_MODES.MIXED, label: 'Intercalado' },
];

// Única función que decide la etiqueta de orientación — cualquier componente
// (simulador, tooltip, PDF, snapshot) debe consultarla en vez de repetir la
// condición.
export function getPalletOrientation(sizeInches, loadMode = DEFAULT_LOAD_MODE) {
  if (loadMode === LOAD_MODES.ALL_VERTICAL) return 'vertical';
  return Number(sizeInches) < 65 ? 'horizontal' : 'vertical';
}

export const SIZE_OPTIONS = Object.entries(SIZE_TABLE)
  .map(([inches, meters]) => ({
    inches: Number(inches),
    meters,
    label: `${inches}" (${meters} m)`,
  }))
  .sort((a, b) => a.inches - b.inches);
