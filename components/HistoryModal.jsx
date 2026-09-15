import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatLocalDate,
  getUserTimeZone,
  getLocalDayKey,
  addDaysToKey,
  formatDayShort,
  formatDayLong,
  formatDayLongNoYear,
} from '../lib/dateFormat';
import { displayOrderNumber, isValidOrderNumber } from '../lib/orderNumber';

const DAY_WINDOW_SIZE = 4;

export default function HistoryModal({ open, onClose, onReprint, onDelete }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'archived'
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ===== Navegación por día =====
  const [todayKey, setTodayKey] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // dayKey 'YYYY-MM-DD'
  const [windowEnd, setWindowEnd] = useState(null); // día más reciente mostrado en la barra
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [openMenuId, setOpenMenuId] = useState(null);
  const dateInputRef = useRef(null);

  const timeZone = useMemo(() => getUserTimeZone(), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPendingDeleteId(null); // reset al abrir
    setOpenMenuId(null);
    setSortOrder('desc');
    // El historial SIEMPRE abre en HOY, sin importar dónde se haya quedado
    // la última vez.
    const t = getLocalDayKey(new Date(), timeZone);
    setTodayKey(t);
    setSelectedDay(t);
    setWindowEnd(t);
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
  }, [open, timeZone]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Filtro por estado — cuenta y aplica sobre TODAS las órdenes (los tabs
  // muestran totales globales, no del día seleccionado).
  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (filter === 'active') return !o.archivedAt;
        if (filter === 'archived') return !!o.archivedAt;
        return true;
      }),
    [orders, filter]
  );

  // Órdenes del día seleccionado (sobre el filtro de estado ya aplicado).
  const dayOrders = useMemo(() => {
    if (!selectedDay) return [];
    return filtered.filter(
      (o) => getLocalDayKey(o.createdAt, timeZone) === selectedDay
    );
  }, [filtered, selectedDay, timeZone]);

  const sortedDayOrders = useMemo(() => {
    const arr = [...dayOrders];
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? ta - tb : tb - ta;
    });
    return arr;
  }, [dayOrders, sortOrder]);

  const daySummary = useMemo(
    () =>
      dayOrders.reduce(
        (acc, o) => {
          acc.orders += 1;
          acc.pallets += o.boxes.length;
          acc.meters += o.totalMeters;
          return acc;
        },
        { orders: 0, pallets: 0, meters: 0 }
      ),
    [dayOrders]
  );

  const windowDays = useMemo(() => {
    if (!windowEnd) return [];
    return Array.from({ length: DAY_WINDOW_SIZE }, (_, i) =>
      addDaysToKey(windowEnd, -i)
    );
  }, [windowEnd]);

  if (!open) return null;

  const yesterdayKey = todayKey ? addDaysToKey(todayKey, -1) : null;

  function dayChipLabel(dayKey) {
    if (dayKey === todayKey) return `Hoy · ${formatDayShort(dayKey)}`;
    if (dayKey === yesterdayKey) return `Ayer · ${formatDayShort(dayKey)}`;
    return formatDayShort(dayKey);
  }

  function dayCardLabel(dayKey) {
    const full = formatDayLong(dayKey);
    if (dayKey === todayKey) return `Hoy · ${full}`;
    if (dayKey === yesterdayKey) return `Ayer · ${full}`;
    return full;
  }

  function dayHeaderLabel(dayKey, count) {
    if (dayKey === todayKey) return `Órdenes de hoy (${count})`;
    if (dayKey === yesterdayKey) return `Órdenes de ayer (${count})`;
    return `Órdenes del ${formatDayLongNoYear(dayKey)} (${count})`;
  }

  function goOlder() {
    setWindowEnd((w) => addDaysToKey(w, -DAY_WINDOW_SIZE));
  }

  function goNewer() {
    setWindowEnd((w) => {
      const next = addDaysToKey(w, DAY_WINDOW_SIZE);
      return next > todayKey ? todayKey : next;
    });
  }

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
    el.click();
  }

  function pickDate(value) {
    if (!value) return;
    setSelectedDay(value);
    setWindowEnd(value);
  }

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
      <div className="modal modal-history" onClick={(e) => e.stopPropagation()}>
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

        <div className="day-nav-row">
          <button
            type="button"
            className="day-nav-arrow"
            onClick={goOlder}
            aria-label="Días anteriores"
          >
            ‹
          </button>

          <div className="day-nav-scroll">
            {windowDays.map((dayKey) => (
              <button
                key={dayKey}
                type="button"
                className={`day-chip ${
                  dayKey === selectedDay ? 'day-chip-active' : ''
                }`}
                onClick={() => setSelectedDay(dayKey)}
              >
                {dayKey === todayKey && (
                  <span className="day-chip-icon" aria-hidden="true">
                    📅
                  </span>
                )}
                {dayChipLabel(dayKey)}
              </button>
            ))}

            <button
              type="button"
              className="day-chip day-chip-picker"
              onClick={openDatePicker}
            >
              <span className="day-chip-icon" aria-hidden="true">
                📅
              </span>
              Seleccionar fecha
              <input
                ref={dateInputRef}
                type="date"
                className="day-date-input"
                max={todayKey || undefined}
                value={selectedDay || ''}
                onChange={(e) => pickDate(e.target.value)}
                aria-label="Elegir fecha"
              />
            </button>
          </div>

          <button
            type="button"
            className="day-nav-arrow"
            onClick={goNewer}
            disabled={windowEnd === todayKey}
            aria-label="Días más recientes"
          >
            ›
          </button>
        </div>

        <div className="day-summary-wrap">
          <div className="day-summary-card">
            <div className="day-summary-head">
              <span className="day-summary-icon" aria-hidden="true">
                📅
              </span>
              <div>
                <p className="day-summary-title">
                  {selectedDay ? dayCardLabel(selectedDay) : ''}
                </p>
                <p className="day-summary-sub">
                  Órdenes registradas en este día
                </p>
              </div>
            </div>
            <div className="day-summary-metrics">
              <div className="day-summary-metric">
                <span className="day-summary-metric-icon" aria-hidden="true">
                  📦
                </span>
                <span className="day-summary-metric-num">
                  {daySummary.orders}
                </span>
                <span className="day-summary-metric-lbl">órdenes</span>
              </div>
              <div className="day-summary-divider" aria-hidden="true" />
              <div className="day-summary-metric">
                <span className="day-summary-metric-icon" aria-hidden="true">
                  ▦
                </span>
                <span className="day-summary-metric-num">
                  {daySummary.pallets}
                </span>
                <span className="day-summary-metric-lbl">tarimas</span>
              </div>
              <div className="day-summary-divider" aria-hidden="true" />
              <div className="day-summary-metric">
                <span className="day-summary-metric-icon" aria-hidden="true">
                  📏
                </span>
                <span className="day-summary-metric-num">
                  {daySummary.meters.toFixed(2)}
                </span>
                <span className="day-summary-metric-lbl">m lineales</span>
              </div>
            </div>
          </div>
        </div>

        <div className="orders-list-head">
          <h3>{selectedDay ? dayHeaderLabel(selectedDay, dayOrders.length) : ''}</h3>
          <select
            className="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Ordenar órdenes"
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguas</option>
          </select>
        </div>

        <div className="modal-body" onClick={() => setOpenMenuId(null)}>
          {loading ? (
            <p className="empty">Cargando…</p>
          ) : sortedDayOrders.length === 0 ? (
            <div className="empty-day-card">
              <span className="empty-day-icon" aria-hidden="true">
                📅
              </span>
              <p className="empty-day-title">No hay órdenes registradas</p>
              <p className="empty-day-sub">
                No se encontraron órdenes para el{' '}
                {selectedDay ? formatDayLong(selectedDay) : ''}.
              </p>
            </div>
          ) : (
            <ul className="order-rows">
              {sortedDayOrders.map((o) => {
                const counts = {};
                o.boxes.forEach((b) => {
                  counts[b.inches] = (counts[b.inches] || 0) + 1;
                });
                const hora = formatLocalDate(o.createdAt, {
                  timeStyle: 'short',
                });
                const isPending = pendingDeleteId === o._id;
                const isMenuOpen = openMenuId === o._id;

                return (
                  <li
                    key={o._id}
                    className={`order-row ${
                      o.archivedAt ? 'order-row-archived' : ''
                    } ${isPending ? 'order-row-pending-delete' : ''}`}
                  >
                    <div className="order-row-left">
                      <div className="order-row-title">
                        <span className="order-row-num">
                          Orden {displayOrderNumber(o.orderNumber)}
                        </span>
                        {!isValidOrderNumber(o.orderNumber) && (
                          <span
                            className="history-badge history-badge-warn"
                            title={`Valor original guardado: "${o.orderNumber ?? ''}"`}
                          >
                            ⚠ revisar
                          </span>
                        )}
                        {o.archivedAt && (
                          <span className="history-badge">Archivada</span>
                        )}
                      </div>
                      <span className="order-row-time">{hora}</span>
                    </div>

                    <div className="order-row-mid">
                      <span>{o.boxes.length} tarimas</span>
                      <span className="order-row-dot">·</span>
                      <span>{o.totalMeters.toFixed(2)} m lineales</span>
                    </div>

                    <div className="order-row-chips">
                      {Object.entries(counts)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([inches, qty]) => (
                          <span className="chip-sm" key={inches}>
                            {qty}× {inches}"
                          </span>
                        ))}
                    </div>

                    <div className="order-row-actions">
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
                          <div className="row-menu-wrap">
                            <button
                              type="button"
                              className="row-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : o._id);
                              }}
                              aria-label="Más acciones"
                              aria-expanded={isMenuOpen}
                            >
                              ⋯
                            </button>
                            {isMenuOpen && (
                              <div
                                className="row-menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="row-menu-item row-menu-item-danger"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPendingDeleteId(o._id);
                                  }}
                                >
                                  Eliminar orden
                                </button>
                              </div>
                            )}
                          </div>
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
