// Ventana flotante que bloquea el agregado de tarimas cuando ya no caben en
// el trailer. No se agrega nada parcial: o entra la cantidad completa, o se
// explica cuánto falta y cuántas sí caben.

import { useBodyScrollLock } from '../lib/useBodyScrollLock';

export default function LimitModal({ data, onClose }) {
  useBodyScrollLock(!!data);
  if (!data) return null;

  const {
    inches,
    metersPerUnit,
    requestedQty,
    availableM,
    neededM,
    missingM,
    stillFits = [],
  } = data;

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div
      className="alert-modal-overlay"
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="limit-modal-title"
    >
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-icon" aria-hidden="true">
          !
        </div>
        <h3 id="limit-modal-title" className="alert-modal-title">
          No hay espacio disponible
        </h3>
        <p className="alert-modal-text">
          {requestedQty === 1
            ? 'No se pudo agregar 1 pallet de'
            : `No se pudieron agregar ${requestedQty} pallets de`}{' '}
          <strong>{inches}"</strong> ({metersPerUnit.toFixed(2)} m c/u) — no caben
          completos en el trailer con lo que ya está cargado.
        </p>

        <div className="alert-modal-details">
          <div className="alert-modal-row">
            <span>Espacio que necesitás</span>
            <strong>{neededM.toFixed(2)} m</strong>
          </div>
          <div className="alert-modal-row">
            <span>Espacio disponible</span>
            <strong>{availableM.toFixed(2)} m</strong>
          </div>
          <div className="alert-modal-row alert-modal-row-danger">
            <span>Te faltan</span>
            <strong>{missingM.toFixed(2)} m</strong>
          </div>
        </div>

        {stillFits.length > 0 ? (
          <div className="alert-modal-fits">
            <p className="alert-modal-fits-label">
              Todavía podés agregar, sin pasarte del límite:
            </p>
            <div className="alert-modal-fits-chips">
              {stillFits.map((s) => (
                <span key={s.inches} className="alert-modal-fit-chip">
                  {plural(s.fits, 'pallet')} de {s.inches}"
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="alert-modal-hint">
            Ya no cabe ningún pallet de ninguna medida en este trailer.
          </p>
        )}

        <button className="btn-primary btn-block" onClick={onClose} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}
