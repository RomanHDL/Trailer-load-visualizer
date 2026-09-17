import TrailerView from './TrailerView';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { displayOrderNumber } from '../lib/orderNumber';
import { formatLocalDate } from '../lib/dateFormat';

// Modal de SOLO LECTURA: reconstruye el acomodo exacto del trailer al
// momento de guardar una orden (order.simulationSnapshot), reutilizando el
// mismo TrailerView del simulador en vivo. No permite arrastrar, agregar,
// quitar tarimas ni guardar — solo visualizar y, si hace falta, regenerar el
// PDF (que a su vez usa ese mismo snapshot, no el estado actual del trailer).
export default function SimulationModal({ order, onClose, onReprint }) {
  useBodyScrollLock(!!order);
  if (!order) return null;

  const snapshot = order.simulationSnapshot;
  const hasSnapshot = !!(snapshot && Array.isArray(snapshot.placed) && snapshot.placed.length);
  const fecha = formatLocalDate(order.createdAt, {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal modal-simulation" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Simulación guardada · Orden {displayOrderNumber(order.orderNumber)}</h2>
            <p className="modal-sub">{fecha}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="sim-meta-row">
            <span className="chip-sm">{order.boxes.length} tarimas</span>
            <span className="chip-sm">{order.totalMeters.toFixed(2)} m lineales</span>
            <span className="history-badge">
              {order.archivedAt ? 'Archivada' : 'Activa'}
            </span>
          </div>

          {hasSnapshot ? (
            <TrailerView
              orders={[]}
              draft={null}
              trailerLength={snapshot.trailerLength}
              capacityLimit={snapshot.capacityLimit}
              snapshot={snapshot}
            />
          ) : (
            <div className="sim-unavailable">
              <span className="empty-day-icon" aria-hidden="true">
                🗺️
              </span>
              <p className="empty-day-title">Vista de simulación no disponible</p>
              <p className="empty-day-sub">
                Esta orden fue creada antes de guardar el acomodo visual del
                trailer. El PDF de esta orden sigue disponible.
              </p>
            </div>
          )}
        </div>

        <div className="sim-footer">
          <button className="btn-primary btn-sm" onClick={() => onReprint(order)}>
            PDF
          </button>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
