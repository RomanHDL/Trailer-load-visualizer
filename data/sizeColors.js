// Color identificable y consistente por medida (pulgadas), para distinguir
// tarimas de un vistazo en el trailer, los chips de la orden activa y el
// historial. Los 7 tamaños de SIZE_TABLE tienen cada uno un color fijo.
export const SIZE_COLORS = {
  50: { bg: '#3b82f6', name: 'Azul' },
  55: { bg: '#38bdf8', name: 'Celeste' },
  58: { bg: '#14b8a6', name: 'Turquesa' },
  65: { bg: '#22c55e', name: 'Verde' },
  75: { bg: '#f59e0b', name: 'Ámbar' },
  86: { bg: '#f97316', name: 'Naranja' },
  100: { bg: '#a855f7', name: 'Morado' },
};

const FALLBACK_COLOR = { bg: '#64748b', name: 'Gris' };

export function getSizeColor(inches) {
  return SIZE_COLORS[inches] || SIZE_COLORS[Number(inches)] || FALLBACK_COLOR;
}

// Orden fijo (igual a SIZE_OPTIONS) para la leyenda visual.
export const SIZE_COLOR_LEGEND = Object.entries(SIZE_COLORS)
  .map(([inches, c]) => ({ inches: Number(inches), ...c }))
  .sort((a, b) => a.inches - b.inches);
