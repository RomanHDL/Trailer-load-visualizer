import { displayOrderNumber } from '../lib/orderNumber';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

// Ventana flotante que confirma que la orden se guardó (con datos reales),
// y deja al usuario decidir: arrancar otra orden o volver a bajar el PDF.
// No se cierra hasta que el usuario elige una de las dos — así nunca se
// pierde el contexto de lo que se acaba de guardar.
export default function SavedConfirmationModal({ data, onStartNew, onViewPdf }) {
  useBodyScrollLock(!!data);
  if (!data) return null;

  return (
    <div
      className="alert-modal-overlay"
      onClick={onStartNew}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="saved-confirm-title"
    >
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="saved-confirm-icon" aria-hidden="true">
          ✓
        </div>
        <h3 id="saved-confirm-title" className="saved-confirm-title">
          Orden {displayOrderNumber(data.orderNumber)} guardada correctamente
        </h3>
        <p className="saved-confirm-stats">
          {data.palletCount} {data.palletCount === 1 ? 'tarima' : 'tarimas'} ·{' '}
          {data.totalMeters.toFixed(2)} m
        </p>
        <div className="saved-confirm-actions">
          <button
            type="button"
            className="btn-primary saved-confirm-btn"
            onClick={onStartNew}
            autoFocus
          >
            Nueva orden
          </button>
          <button
            type="button"
            className="btn-ghost saved-confirm-btn"
            onClick={onViewPdf}
          >
            Ver PDF
          </button>
        </div>
      </div>
    </div>
  );
}
