// Tabla estándar de medidas (pulgadas -> metros que ocupa la caja en el trailer)
// Hardcodeada según especificación
export const SIZE_TABLE = {
  50: 1.0,
  55: 1.45,
  58: 1.45,
  65: 1.58,
  75: 1.88,
  86: 2.13,
  100: 2.5,
};

// Lista ordenada para usar en el <select>
export const SIZE_OPTIONS = Object.entries(SIZE_TABLE)
  .map(([inches, meters]) => ({
    inches: Number(inches),
    meters,
    label: `${inches}" (${meters} m)`,
  }))
  .sort((a, b) => a.inches - b.inches);
