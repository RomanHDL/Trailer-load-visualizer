import { useEffect, useState } from 'react';

export default function HistoryModal({ open, onClose, onReprint, onDelete }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'archived'
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPendingDeleteId(null); // reset al abrir
    fetch('/api/orders?history=1')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const filtered = orders.filter((o) => {
    if (filter === 'active') return !o.archivedAt;
    if (filter === 'archived') return !!o.archivedAt;
    return true;
  });

  async function confirmDelete(id) {
    if (deleting) return;
    setDeleting(true);
    try {
      const ok = await onDelete(id);
      // Solo remover del estado local SI realmente se eliminó en el server.
      // Si onDelete retorna false (cancelado o error), la orden queda.
      if (ok) {
        setOrders((prev) => prev.filter((o) => o._id !== id));
      }
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Historial de órdenes</h2>
            <p className="modal-sub">{orders.length} órdenes en total</p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({orders.length})
          </button>
          <button
            className={`modal-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Activas ({orders.filter((o) => !o.archivedAt).length})
          </button>
          <button
            className={`modal-tab ${filter === 'archived' ? 'active' : ''}`}
            onClick={() => setFilter('archived')}
          >
            Archivadas ({orders.filter((o) => !!o.archivedAt).length})
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="empty">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="empty">No hay órdenes en esta vista.</p>
          ) : (
            <ul className="history-list">
              {filtered.map((o) => {
                const counts = {};
                o.boxes.forEach((b) => {
                  counts[b.inches] = (counts[b.inches] || 0) + 1;
                });
                const fecha = new Date(o.createdAt).toLocaleString('es-MX', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                });
                const isPending = pendingDeleteId === o._id;

                return (
                  <li
                    key={o._id}
                    className={`${o.archivedAt ? 'history-archived' : ''} ${
                      isPending ? 'history-pending-delete' : ''
                    }`}
                  >
                    <div className="history-head">
                      <span className="history-num">
                        Orden {o.orderNumber}
                      </span>
                      {o.archivedAt && (
                        <span className="history-badge">Archivada</span>
                      )}
                      <span className="history-date">{fecha}</span>
                    </div>

                    <div className="history-meta">
                      <span>{o.boxes.length} tarimas</span>
                      <span>·</span>
                      <span>{o.totalMeters.toFixed(2)} m lineales</span>
                    </div>

                    <div className="history-chips">
                      {Object.entries(counts)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([inches, qty]) => (
                          <span className="chip-sm" key={inches}>
                            {qty}× {inches}"
                          </span>
                        ))}
                    </div>

                    <div className="history-actions">
                      {isPending ? (
                        <>
                          <span className="confirm-label">
                            ¿Eliminar definitivamente?
                          </span>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={cancelDelete}
                            disabled={deleting}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => confirmDelete(o._id)}
                            disabled={deleting}
                          >
                            {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => onReprint(o)}
                          >
                            PDF
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => setPendingDeleteId(o._id)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
