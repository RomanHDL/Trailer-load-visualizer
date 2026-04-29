// Tabla estándar de medidas (pulgadas -> metros que ocupa la caja en el trailer)
// Hardcodeada según especificación.
export const SIZE_TABLE = {
  50: 1.0,
  55: 1.45,
  58: 1.45,
  65: 1.58,
  75: 1.88,
  86: 2.13,
  100: 2.5,
};

// Todas las tarimas pairean lado-a-lado en el trailer (2 carriles). El trailer
// real permite 1 tarima a la izquierda + 1 a la derecha en cada posición.
// La cifra "meters" es la longitud que ocupa cada tarima en el sentido del
// trailer (no el ancho).
export const SIZE_LANES = {
  50: 2,
  55: 2,
  58: 2,
  65: 2,
  75: 2,
  86: 2,
  100: 2,
};

export const SIZE_OPTIONS = Object.entries(SIZE_TABLE)
  .map(([inches, meters]) => ({
    inches: Number(inches),
    meters,
    lanes: SIZE_LANES[Number(inches)] || 2,
    label: `${inches}" (${meters} m)`,
  }))
  .sort((a, b) => a.inches - b.inches);
