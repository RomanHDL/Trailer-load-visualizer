import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatLocalDate,
  getUserTimeZone,
  getLocalDayKey,
  addDaysToKey,
  formatDayShort,
  formatDayLong,
  formatDayLongNoYear,
  dayKeyParts,
  getWeekStartKey,
  formatWeekRangeLabel,
} from '../lib/dateFormat';
import { displayOrderNumber, isValidOrderNumber } from '../lib/orderNumber';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { getSizeColor } from '../data/sizeColors';
import PeriodNavigator from './PeriodNavigator';

export default function HistoryModal({
  open,
  onClose,
  onReprint,
  onDelete,
  onViewSimulation,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'archived'
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ===== Navegación por día =====
  const [todayKey, setTodayKey] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // dayKey 'YYYY-MM-DD'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [weekStart, setWeekStart] = useState(null); // dayKey del lunes de la semana mostrada
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const dateInputRef = useRef(null);
  const menuRef = useRef(null);
  const modalBodyRef = useRef(null);
  const scrollPosRef = useRef(0);
  // Solo la PRIMERA apertura de la sesión resetea a "Hoy"/orden por defecto.
  // Reaperturas dentro de la misma sesión conservan día, filtro, búsqueda,
  // orden y modo Día/Semana exactamente donde el usuario los dejó — el
  // estado del componente ya persiste solo porque nunca se desmonta (`open`
  // solo controla si retorna null), así que alcanza con no pisarlo de nuevo.
  const hasOpenedRef = useRef(false);

  const timeZone = useMemo(() => getUserTimeZone(), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPendingDeleteId(null); // transitorio: siempre se reinicia al reabrir
    setOpenMenuId(null);
    const t = getLocalDayKey(new Date(), timeZone);
    setTodayKey(t);
    if (!hasOpenedRef.current) {
      // Primera vez en esta sesión: comportamiento de siempre, abrir en HOY.
      setSelectedDay(t);
      setSortOrder('desc');
      setSearchQuery('');
      setWeekStart(getWeekStartKey(t));
      hasOpenedRef.current = true;
    }
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

  useBodyScrollLock(open);

  // Restaura el scroll de la lista después de que los datos ya renderizaron
  // (evita el salto de restaurar contra un contenedor todavía vacío/"Cargando…").
  useEffect(() => {
    if (!open || loading || !modalBodyRef.current) return;
    modalBodyRef.current.scrollTop = scrollPosRef.current;
  }, [open, loading]);

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

  // ===== Resumen semanal (lunes → domingo) =====
  const weekEndKey = useMemo(
    () => (weekStart ? addDaysToKey(weekStart, 6) : null),
    [weekStart]
  );

  const weekOrders = useMemo(() => {
    if (!weekStart || !weekEndKey) return [];
    return filtered.filter((o) => {
      const k = getLocalDayKey(o.createdAt, timeZone);
      return k >= weekStart && k <= weekEndKey;
    });
  }, [filtered, weekStart, weekEndKey, timeZone]);

  const sortedWeekOrders = useMemo(() => {
    const arr = [...weekOrders];
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? ta - tb : tb - ta;
    });
    return arr;
  }, [weekOrders, sortOrder]);

  const weekSummary = useMemo(() => {
    const acc = weekOrders.reduce(
      (a, o) => {
        a.orders += 1;
        a.pallets += o.boxes.length;
        a.meters += o.totalMeters;
        return a;
      },
      { orders: 0, pallets: 0, meters: 0 }
    );
    acc.avgPallets = acc.orders > 0 ? acc.pallets / acc.orders : 0;
    return acc;
  }, [weekOrders]);

  const currentWeekStart = todayKey ? getWeekStartKey(todayKey) : null;
  const isCurrentWeek = weekStart === currentWeekStart;

  function goPrevWeek() {
    setWeekStart((w) => addDaysToKey(w, -7));
  }

  function goNextWeek() {
    setWeekStart((w) => {
      const next = addDaysToKey(w, 7);
      return currentWeekStart && next > currentWeekStart ? currentWeekStart : next;
    });
  }

  // ===== Búsqueda global =====
  // Trabaja sobre `filtered` (ya con Todas/Activas/Archivadas aplicado) y NO
  // sobre el día seleccionado — así encuentra una orden sin importar cuándo
  // se creó. El dataset completo del historial ya está en memoria (se cargó
  // entero al abrir el modal), así que alcanza con un filtro local.
  const trimmedQuery = searchQuery.trim();
  const searchActive = trimmedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    const q = trimmedQuery.toLowerCase();
    return filtered.filter((o) =>
      String(o.orderNumber ?? '').toLowerCase().includes(q)
    );
  }, [filtered, searchActive, trimmedQuery]);

  const sortedSearchResults = useMemo(() => {
    const arr = [...searchResults];
    arr.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? ta - tb : tb - ta;
    });
    return arr;
  }, [searchResults, sortOrder]);

  // Lista que realmente se muestra: resultados de búsqueda global si hay
  // texto (con prioridad sobre Día/Semana), o el modo Día/Semana activo.
  const visibleOrders = searchActive
    ? sortedSearchResults
    : viewMode === 'week'
    ? sortedWeekOrders
    : sortedDayOrders;
  // En semana o búsqueda, los resultados pueden ser de días distintos —
  // mostramos fecha + hora en la fila en vez de solo la hora.
  const showFullDateInRows = searchActive || viewMode === 'week';

  function clearSearch() {
    setSearchQuery('');
  }

  // "17 sep 2026 · 8:42 a.m." — en búsqueda global mostramos fecha completa
  // porque los resultados pueden ser de días distintos (en la vista por día
  // alcanza con la hora, porque la fecha ya está arriba).
  function fullDateTimeLabel(order) {
    const dayKey = getLocalDayKey(order.createdAt, timeZone);
    const { year } = dayKeyParts(dayKey);
    const hora = formatLocalDate(order.createdAt, { timeStyle: 'short' });
    return `${formatDayShort(dayKey)} ${year} · ${hora}`;
  }

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

  // Posiciona el menú "..." (portal, position: fixed) con su altura real ya
  // medida, y lo hace aparecer arriba del botón si no entra abajo.
  useLayoutEffect(() => {
    if (!openMenuId || !menuAnchorRect || !menuRef.current) {
      setMenuStyle(null);
      return;
    }
    const { offsetWidth: w, offsetHeight: h } = menuRef.current;
    const margin = 8;
    let left = menuAnchorRect.right - w;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    let top = menuAnchorRect.bottom + 6;
    if (top + h + margin > window.innerHeight) {
      top = menuAnchorRect.top - h - 6;
    }
    setMenuStyle({ top, left });
  }, [openMenuId, menuAnchorRect]);

  // Cierra el menú al hacer click afuera, scrollear o cambiar el tamaño de
  // ventana (evita que quede flotando en una posición ya desactualizada).
  useEffect(() => {
    if (!openMenuId) return;
    function handleOutside(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpenMenuId(null);
    }
    function handleClose() {
      setOpenMenuId(null);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('pointerdown', handleOutside, true);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [openMenuId]);

  if (!open) return null;

  const yesterdayKey = todayKey ? addDaysToKey(todayKey, -1) : null;

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

  function goPrevDay() {
    setSelectedDay((d) => addDaysToKey(d, -1));
  }

  function goNextDay() {
    setSelectedDay((d) => {
      const next = addDaysToKey(d, 1);
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

  // Abre/cierra el menú "..." de una fila. Guarda la posición real del botón
  // (getBoundingClientRect) para que el menú se dibuje vía portal, fixed,
  // fuera del overflow del modal — así nunca queda recortado.
  function toggleRowMenu(id, e) {
    e.stopPropagation();
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchorRect({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    });
    setOpenMenuId(id);
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

        <div className="modal-search-row">
          <div className="modal-search-box">
            <span className="modal-search-icon" aria-hidden="true">
              🔎
            </span>
            <input
              type="text"
              className="modal-search-input"
              placeholder="Buscar orden... Ej. 1800, PRUEBA, 36364"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                } else if (e.key === 'Escape' && searchQuery) {
                  e.stopPropagation();
                  clearSearch();
                }
              }}
              aria-label="Buscar orden"
            />
            {searchActive && (
              <button
                type="button"
                className="modal-search-clear"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="view-mode-row">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Día
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Semana
          </button>
        </div>

        {viewMode === 'day' ? (
          <>
            <PeriodNavigator
              label={selectedDay ? dayCardLabel(selectedDay) : ''}
              onPrev={goPrevDay}
              onNext={goNextDay}
              nextDisabled={selectedDay === todayKey}
              prevLabel="Día anterior"
              nextLabel="Día siguiente"
            />

            <div className="date-picker-row">
              <button
                type="button"
                className="date-picker-btn"
                onClick={openDatePicker}
                aria-label="Seleccionar fecha"
              >
                <span aria-hidden="true">📅</span>
                Seleccionar fecha
                <input
                  ref={dateInputRef}
                  type="date"
                  className="day-date-input"
                  max={todayKey || undefined}
                  value={selectedDay || ''}
                  onChange={(e) => pickDate(e.target.value)}
                  aria-label="Elegir fecha"
                  tabIndex={-1}
                />
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
          </>
        ) : (
          <>
            <PeriodNavigator
              label={`Semana · ${weekStart ? formatWeekRangeLabel(weekStart) : ''}`}
              onPrev={goPrevWeek}
              onNext={goNextWeek}
              nextDisabled={isCurrentWeek}
              prevLabel="Semana anterior"
              nextLabel="Semana siguiente"
            />

            <div className="day-summary-wrap">
              <div className="day-summary-card">
                <div className="day-summary-head">
                  <span className="day-summary-icon" aria-hidden="true">
                    📊
                  </span>
                  <div>
                    <p className="day-summary-title">
                      Semana · {weekStart ? formatWeekRangeLabel(weekStart) : ''}
                    </p>
                    <p className="day-summary-sub">
                      Promedio por orden: {weekSummary.avgPallets.toFixed(1)} tarimas
                    </p>
                  </div>
                </div>
                <div className="day-summary-metrics">
                  <div className="day-summary-metric">
                    <span className="day-summary-metric-icon" aria-hidden="true">
                      📦
                    </span>
                    <span className="day-summary-metric-num">
                      {weekSummary.orders}
                    </span>
                    <span className="day-summary-metric-lbl">órdenes</span>
                  </div>
                  <div className="day-summary-divider" aria-hidden="true" />
                  <div className="day-summary-metric">
                    <span className="day-summary-metric-icon" aria-hidden="true">
                      ▦
                    </span>
                    <span className="day-summary-metric-num">
                      {weekSummary.pallets}
                    </span>
                    <span className="day-summary-metric-lbl">tarimas</span>
                  </div>
                  <div className="day-summary-divider" aria-hidden="true" />
                  <div className="day-summary-metric">
                    <span className="day-summary-metric-icon" aria-hidden="true">
                      📏
                    </span>
                    <span className="day-summary-metric-num">
                      {weekSummary.meters.toFixed(2)}
                    </span>
                    <span className="day-summary-metric-lbl">m lineales</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="orders-list-head">
          <h3>
            {searchActive
              ? `Resultados de búsqueda (${sortedSearchResults.length})`
              : viewMode === 'week'
              ? `Órdenes de la semana (${weekOrders.length})`
              : selectedDay
              ? dayHeaderLabel(selectedDay, dayOrders.length)
              : ''}
          </h3>
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

        <div
          className="modal-body"
          ref={modalBodyRef}
          onClick={() => setOpenMenuId(null)}
          onScroll={(e) => {
            scrollPosRef.current = e.currentTarget.scrollTop;
          }}
        >
          {loading ? (
            <p className="empty">Cargando…</p>
          ) : visibleOrders.length === 0 ? (
            <div className="empty-day-card">
              <span className="empty-day-icon" aria-hidden="true">
                {searchActive ? '🔎' : '📅'}
              </span>
              <p className="empty-day-title">
                {searchActive ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
              </p>
              <p className="empty-day-sub">
                {searchActive
                  ? `No hay resultados para "${trimmedQuery}".`
                  : viewMode === 'week'
                  ? `No se encontraron órdenes para la semana del ${
                      weekStart ? formatWeekRangeLabel(weekStart) : ''
                    }.`
                  : `No se encontraron órdenes para el ${
                      selectedDay ? formatDayLong(selectedDay) : ''
                    }.`}
              </p>
            </div>
          ) : (
            <ul className="order-rows">
              {visibleOrders.map((o) => {
                const counts = {};
                o.boxes.forEach((b) => {
                  counts[b.inches] = (counts[b.inches] || 0) + 1;
                });
                const hora = showFullDateInRows
                  ? fullDateTimeLabel(o)
                  : formatLocalDate(o.createdAt, { timeStyle: 'short' });
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
                            <span
                              className="chip-swatch"
                              style={{ background: getSizeColor(Number(inches)).bg }}
                              aria-hidden="true"
                            />
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
                            className="btn-ghost btn-sm"
                            onClick={() => onViewSimulation(o)}
                          >
                            Ver simulación
                          </button>
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
                              onClick={(e) => toggleRowMenu(o._id, e)}
                              aria-label="Más acciones"
                              aria-expanded={isMenuOpen}
                            >
                              ⋯
                            </button>
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

      {openMenuId &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="row-menu row-menu-portal"
            style={menuStyle ? { ...menuStyle, visibility: 'visible' } : { visibility: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="row-menu-item row-menu-item-danger"
              onClick={() => {
                setPendingDeleteId(openMenuId);
                setOpenMenuId(null);
              }}
            >
              Eliminar orden
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
