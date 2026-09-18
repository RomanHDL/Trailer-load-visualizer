// Aviso NO bloqueante: agregar esto haría que la carga pase de <=100% a
// >100% de la capacidad oficial del trailer. A diferencia de LimitModal
// (que bloquea porque ya no cabe nada más), esto es solo informativo — el
// usuario decide si continúa cubicando por encima del límite.

import { useBodyScrollLock } from '../lib/useBodyScrollLock';

export default function OverCapacityModal({
  data,
  trailerLength,
  onCancel,
  onConfirm,
}) {
  useBodyScrollLock(!!data);
  if (!data) return null;

  const { currentTotal, resultingTotal } = data;
  const resultingPct = (resultingTotal / trailerLength) * 100;

  return (
    <div
      className="alert-modal-overlay"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="over-capacity-title"
    >
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-icon alert-modal-icon-warning" aria-hidden="true">
          !
        </div>
        <h3 id="over-capacity-title" className="alert-modal-title">
          Límite de capacidad superado
        </h3>
        <p className="alert-modal-text">
          Esta carga supera el 100% de la capacidad del camión.
        </p>

        <div className="alert-modal-details">
          <div className="alert-modal-row">
            <span>Capacidad máxima</span>
            <strong>{trailerLength.toFixed(1)} m</strong>
          </div>
          <div className="alert-modal-row">
            <span>Carga actual</span>
            <strong>{currentTotal.toFixed(2)} m</strong>
          </div>
          <div className="alert-modal-row">
            <span>Nueva carga</span>
            <strong>{resultingTotal.toFixed(2)} m</strong>
          </div>
          <div className="alert-modal-row alert-modal-row-danger">
            <span>Capacidad resultante</span>
            <strong>{resultingPct.toFixed(0)}%</strong>
          </div>
        </div>

        <p className="alert-modal-hint">
          Puedes continuar agregando pallets si deseas realizar el cubicaje
          por encima del límite.
        </p>

        <div className="alert-modal-actions">
          <button
            type="button"
            className="btn-ghost alert-modal-btn"
            onClick={onCancel}
            autoFocus
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary alert-modal-btn"
            onClick={onConfirm}
          >
            Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
