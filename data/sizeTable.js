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

// Carriles que ocupa cada medida en el ancho del trailer (1 = ancho completo, 2 = mitad).
// Las cajas chicas (50–65") caben de a dos lado-a-lado. Las grandes (75"+) usan
// el ancho completo del trailer.
export const SIZE_LANES = {
  50: 2,
  55: 2,
  58: 2,
  65: 2,
  75: 1,
  86: 1,
  100: 1,
};

export const SIZE_OPTIONS = Object.entries(SIZE_TABLE)
  .map(([inches, meters]) => ({
    inches: Number(inches),
    meters,
    lanes: SIZE_LANES[Number(inches)] || 1,
    label: `${inches}" (${meters} m${SIZE_LANES[Number(inches)] === 2 ? ' · 2 carriles' : ''})`,
  }))
  .sort((a, b) => a.inches - b.inches);
