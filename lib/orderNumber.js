// Validación y display del número de orden.
//
// El form histórico aceptaba cualquier string no vacío después de trim — eso
// dejó pasar valores corruptos como "-----------" o "1897-----------"
// (probablemente una tecla `-` que se quedó pegada o autorepetición del
// teclado del celular). Estos helpers:
//
//   - bloquean nuevos valores sin alfanumérico (cliente + servidor)
//   - muestran las órdenes viejas corruptas con un fallback legible
//
// No se modifica el dato en la base; solo se filtra en input y se reemplaza
// en el render para que la UI/PDF no muestren los guiones decorativos.

const HAS_ALNUM = /[a-zA-Z0-9]/;

export function normalizeOrderNumber(raw) {
  return String(raw ?? '').trim();
}

export function isValidOrderNumber(value) {
  const v = normalizeOrderNumber(value);
  return Boolean(v) && HAS_ALNUM.test(v);
}

// Para textos amplios (Historial, header del PDF, toasts).
export function displayOrderNumber(value) {
  return isValidOrderNumber(value) ? normalizeOrderNumber(value) : '(sin número)';
}

// Para etiquetas dentro de espacios reducidos (cajas del trailer en pantalla
// y en el PDF, donde "(sin número)" no entra).
export function displayOrderNumberShort(value) {
  return isValidOrderNumber(value) ? normalizeOrderNumber(value) : '—';
}

// Sanitiza un número de orden para usarlo como filename.
export function orderNumberToFilename(value) {
  const v = isValidOrderNumber(value) ? normalizeOrderNumber(value) : 'sin-numero';
  return v.replace(/[^\w-]+/g, '_');
}
