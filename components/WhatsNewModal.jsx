// Aviso compacto de "hay una actualización nueva" — muestra solo los datos
// de CHANGELOG[0] (la versión actual), no el historial completo. Para ver
// todas las versiones, el usuario puede abrir el historial completo desde
// acá o desde el botón "Actualizaciones" del topbar (que usa ChangelogModal).
import { CHANGELOG } from '../data/changelog';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

export default function WhatsNewModal({ open, onClose, onViewFullHistory }) {
  useBodyScrollLock(open);
  if (!open) return null;

  const latest = CHANGELOG[0];

  return (
    <div
      className="alert-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
    >
      <div
        className="alert-modal whatsnew-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-modal-icon" aria-hidden="true">
          ✦
        </div>

        <div className="whatsnew-header">
          <span className="whatsnew-version">v{latest.version}</span>
          <span className="changelog-badge">Nuevo</span>
          <span className="whatsnew-date">{latest.date}</span>
        </div>

        <h3 id="whatsnew-title" className="whatsnew-title">
          {latest.title}
        </h3>

        <ul className="whatsnew-changes">
          {latest.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>

        <div className="whatsnew-actions">
          <button className="btn-primary btn-block" onClick={onClose} autoFocus>
            Entendido
          </button>
          <button
            className="btn-ghost btn-block"
            onClick={() => {
              onClose();
              onViewFullHistory();
            }}
          >
            Ver todo el historial
          </button>
        </div>
      </div>
    </div>
  );
}
