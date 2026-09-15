import { CHANGELOG, CURRENT_VERSION, PREVIOUS_VERSION } from '../data/changelog';

export default function ChangelogModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal modal-changelog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Historial de actualizaciones</h2>
            <p className="modal-sub">
              {PREVIOUS_VERSION
                ? `Versión anterior v${PREVIOUS_VERSION} → versión actual v${CURRENT_VERSION}`
                : `Versión actual v${CURRENT_VERSION}`}
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <ul className="changelog-list">
            {CHANGELOG.map((entry, i) => (
              <li key={entry.version} className="changelog-entry">
                <div className="changelog-entry-head">
                  <span className="changelog-version">v{entry.version}</span>
                  {i === 0 && (
                    <span className="changelog-badge">Actual</span>
                  )}
                  <span className="changelog-date">{entry.date}</span>
                </div>
                <h3 className="changelog-title">{entry.title}</h3>
                <ul className="changelog-changes">
                  {entry.changes.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
