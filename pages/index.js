import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import OrderForm from '../components/OrderForm';
import TrailerView from '../components/TrailerView';
import HistoryModal from '../components/HistoryModal';
import LimitModal from '../components/LimitModal';
import ChangelogModal from '../components/ChangelogModal';
import WhatsNewModal from '../components/WhatsNewModal';
import SimulationModal from '../components/SimulationModal';
import { SIZE_TABLE } from '../data/sizeTable';
import { packBoxes } from '../lib/packing';
import { CURRENT_VERSION } from '../data/changelog';

const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

// Tolerancia real interna: el trailer en la práctica admite bastante más de
// lo que se muestra como "límite" en pantalla. Todo lo que decide si algo
// cabe o no (bloqueo al agregar, "% de capacidad", colores de overflow)
// usa este valor; el número que se imprime en la UI/PDF sigue siendo
// TRAILER_LENGTH, sin cambios.
const CAPACITY_LIMIT = TRAILER_LENGTH * 2;

const DRAFT_STORAGE_KEY = 'trailer:draft:v1';
const CHANGELOG_SEEN_KEY = 'trailer:changelog:lastSeenVersion';
const THEME_KEY = 'trailer:theme';
const THEME_COLORS = { dark: '#0b1220', light: '#f8fafc' };

export default function Home() {
  const [orders, setOrders] = useState([]); // solo activas
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [simulationOrder, setSimulationOrder] = useState(null);
  const draftHydrated = useRef(false);

  // Aplica el tema lo antes posible (primer render en cliente) para evitar
  // flash de tema incorrecto: respeta lo guardado en localStorage, si no hay
  // nada guardado usa prefers-color-scheme, y si tampoco eso es concluyente
  // el fallback histórico de la app siempre fue oscuro.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let initial = 'dark';
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        initial = saved;
      } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        initial = 'light';
      }
    } catch (e) {
      /* ignore */
    }
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  }

  // Muestra el aviso de novedades (solo la versión nueva) una sola vez por
  // versión (por navegador). El historial completo sigue en ChangelogModal,
  // accesible desde el botón "Actualizaciones".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
      if (seen !== CURRENT_VERSION) {
        setShowWhatsNew(true);
        localStorage.setItem(CHANGELOG_SEEN_KEY, CURRENT_VERSION);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.orderNumber === 'string' &&
          Array.isArray(parsed.boxes)
        ) {
          setDraft(parsed);
        }
      }
    } catch (e) {
      /* ignore */
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!draftHydrated.current) return;
    try {
      if (draft) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (e) {
      /* ignore */
    }
  }, [draft]);

  function showToast(msg, type = 'success', durationMs = 4500) {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => {
      setToast((t) => (t && Date.now() - t.id >= durationMs ? null : t));
    }, durationMs);
  }

  async function load() {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Error al cargar órdenes');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      showToast('No se pudo cargar las órdenes activas', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startDraft(orderNumber) {
    setDraft({ orderNumber, boxes: [] });
  }

  // Simula de a una tarima cuántas de esta medida caben sobre `baseBoxes`
  // antes de pasar el límite del trailer.
  function maxFitCount(baseBoxes, inches, meters, cap = 60) {
    let fits = 0;
    const probe = [...baseBoxes];
    for (let i = 0; i < cap; i++) {
      probe.push({ inches, meters });
      if (packBoxes(probe).totalUsed > CAPACITY_LIMIT) break;
      fits++;
    }
    return fits;
  }

  function addBoxesToDraft(inches, qty = 1) {
    const meters = SIZE_TABLE[inches];
    if (!meters) return;
    const n = Math.max(1, Math.floor(qty));

    // Todo lo que ya ocupa espacio real en el trailer: órdenes activas +
    // las tarimas que el draft ya trae.
    const existingBoxes = [
      ...orders.flatMap((o) => o.boxes),
      ...(draft ? draft.boxes : []),
    ];

    // Todo o nada: si la medida pedida no cabe completa, no se agrega nada.
    const fits = maxFitCount(existingBoxes, inches, meters, n);

    if (fits < n) {
      const { totalUsed: currentUsed } = packBoxes(existingBoxes);
      const availableM = Math.max(0, CAPACITY_LIMIT - currentUsed);
      const neededM = n * meters;

      // Qué otras medidas (y cuántas) sí caben todavía en el espacio restante.
      const stillFits = Object.entries(SIZE_TABLE)
        .map(([inchesKey, m]) => ({
          inches: Number(inchesKey),
          meters: m,
          fits: maxFitCount(existingBoxes, Number(inchesKey), m),
        }))
        .filter((s) => s.fits > 0)
        .sort((a, b) => a.inches - b.inches);

      setLimitInfo({
        inches,
        metersPerUnit: meters,
        requestedQty: n,
        fits,
        availableM,
        neededM,
        missingM: Math.max(0, (n - fits) * meters),
        stillFits,
      });
      return;
    }

    const newBoxes = Array.from({ length: n }, () => ({ inches, meters }));
    setDraft((d) => ({ ...d, boxes: [...d.boxes, ...newBoxes] }));
  }

  // Intercambia dos cajas del draft directamente (drop exacto sobre otra
  // tarima) — a diferencia de reorderDraftBox, no desplaza el resto.
  function swapDraftBoxes(idxA, idxB) {
    setDraft((d) => {
      if (!d || !Array.isArray(d.boxes)) return d;
      if (
        idxA < 0 ||
        idxA >= d.boxes.length ||
        idxB < 0 ||
        idxB >= d.boxes.length ||
        idxA === idxB
      ) {
        return d;
      }
      const newBoxes = [...d.boxes];
      [newBoxes[idxA], newBoxes[idxB]] = [newBoxes[idxB], newBoxes[idxA]];
      return { ...d, boxes: newBoxes };
    });
  }

  // Reordenar una caja del draft de fromIdx → toIdx (drag-and-drop)
  function reorderDraftBox(fromIdx, toIdx) {
    setDraft((d) => {
      if (!d || !Array.isArray(d.boxes)) return d;
      if (
        fromIdx < 0 ||
        fromIdx >= d.boxes.length ||
        toIdx < 0 ||
        toIdx > d.boxes.length ||
        fromIdx === toIdx
      ) {
        return d;
      }
      const newBoxes = [...d.boxes];
      const [moved] = newBoxes.splice(fromIdx, 1);
      // Si el target estaba a la derecha del removido, ajustamos índice
      const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx;
      newBoxes.splice(adjustedTo, 0, moved);
      return { ...d, boxes: newBoxes };
    });
  }

  function removeOneBoxOfSize(inches) {
    setDraft((d) => {
      let lastIdx = -1;
      for (let i = d.boxes.length - 1; i >= 0; i--) {
        if (d.boxes[i].inches === inches) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx === -1) return d;
      return { ...d, boxes: d.boxes.filter((_, i) => i !== lastIdx) };
    });
  }

  function cancelDraft() {
    if (
      draft.boxes.length > 0 &&
      !confirm('¿Descartar esta orden? Se perderán las cajas agregadas.')
    )
      return;
    setDraft(null);
  }

  // Snapshot del acomodo (carril + posición ya resueltos) tal como lo
  // muestra el simulador en este instante: órdenes activas actuales + el
  // draft, en su orden final (después de cualquier drag & drop / swap).
  // Se guarda junto con la orden para poder reconstruir EXACTAMENTE esta
  // vista más adelante, sin volver a calcular nada con el packing de ese
  // momento (que podría cambiar si el trailer ya tiene otras órdenes).
  function buildSimulationSnapshot() {
    const sequence = [];
    orders.forEach((o) => {
      o.boxes.forEach((b) => {
        sequence.push({
          inches: b.inches,
          meters: b.meters,
          orderNumber: o.orderNumber,
        });
      });
    });
    draft.boxes.forEach((b) => {
      sequence.push({
        inches: b.inches,
        meters: b.meters,
        orderNumber: draft.orderNumber,
      });
    });
    const { placed, totalUsed, lane1, lane2 } = packBoxes(sequence);
    return {
      trailerLength: TRAILER_LENGTH,
      capacityLimit: CAPACITY_LIMIT,
      totalUsed,
      lane1,
      lane2,
      placed: placed.map(({ inches, meters, orderNumber, lane, start, end, full }) => ({
        inches,
        meters,
        orderNumber,
        lane,
        start,
        end,
        full,
      })),
    };
  }

  async function saveDraft() {
    if (!draft || draft.boxes.length === 0) return;
    setSaving(true);

    let savedOrder = null;
    let nextOrders = null;

    try {
      const simulationSnapshot = buildSimulationSnapshot();
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: draft.orderNumber,
          boxes: draft.boxes.map((b) => ({ inches: b.inches })),
          simulationSnapshot,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status} al guardar`);
      }

      savedOrder = await res.json();

      if (
        !savedOrder._id ||
        !Array.isArray(savedOrder.boxes) ||
        savedOrder.boxes.length !== draft.boxes.length
      ) {
        throw new Error(
          `La orden se guardó incompleta (${
            savedOrder.boxes?.length ?? 0
          }/${draft.boxes.length} tarimas).`
        );
      }

      nextOrders = [...orders, savedOrder];
      setOrders(nextOrders);
      setDraft(null);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
    } catch (e) {
      console.error('Error al guardar:', e);
      showToast(
        `No se pudo guardar la orden: ${e.message}. Tu draft está intacto.`,
        'error',
        7000
      );
      setSaving(false);
      return;
    }

    try {
      const { generateOrderPdf } = await import('../lib/pdfGenerator');
      await generateOrderPdf({
        order: savedOrder,
        trailerLength: TRAILER_LENGTH,
        capacityLimit: CAPACITY_LIMIT,
        allOrders: nextOrders,
      });
      showToast(
        `Orden ${savedOrder.orderNumber} guardada · PDF descargado`,
        'success'
      );
    } catch (e) {
      console.error('Error al generar PDF:', e);
      showToast(
        `Orden ${savedOrder.orderNumber} guardada. PDF falló — usá el botón "PDF" en Historial.`,
        'warn',
        7000
      );
    } finally {
      setSaving(false);
    }
  }

  // La confirmación se maneja inline en el modal del historial.
  // Devuelve true si la orden fue eliminada, false si hubo error.
  async function deleteOrder(id) {
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Error al eliminar');
      setOrders((prev) => prev.filter((o) => o._id !== id));
      showToast('Orden eliminada', 'success');
      return true;
    } catch (e) {
      showToast('No se pudo eliminar: ' + e.message, 'error');
      return false;
    }
  }

  async function reprintPdf(order) {
    try {
      const { generateOrderPdf } = await import('../lib/pdfGenerator');
      // Si la orden está archivada (ya no está en `orders`, que solo trae
      // activas), la agregamos al contexto del PDF para que sus tarimas
      // aparezcan en el camión. Sin esto, el camión sale vacío al reimprimir
      // desde el historial.
      const allOrders = orders.some((o) => o._id === order._id)
        ? orders
        : [...orders, order];
      await generateOrderPdf({
        order,
        trailerLength: TRAILER_LENGTH,
        capacityLimit: CAPACITY_LIMIT,
        allOrders,
      });
      showToast('PDF regenerado', 'success', 2500);
    } catch (e) {
      showToast('No se pudo generar el PDF: ' + e.message, 'error');
    }
  }

  // Refrescar trailer: archiva órdenes activas (van al historial), limpia el
  // draft local. Las órdenes NO se borran del historial.
  async function refreshTrailer() {
    if (orders.length === 0 && !draft) {
      showToast('El trailer ya está vacío', 'success', 2000);
      return;
    }
    const msg =
      orders.length > 0
        ? `¿Refrescar trailer? Las ${orders.length} orden(es) actuales pasarán al historial.`
        : '¿Descartar el draft en curso?';
    if (!confirm(msg)) return;

    setRefreshing(true);
    try {
      if (orders.length > 0) {
        const res = await fetch('/api/orders/archive', { method: 'POST' });
        if (!res.ok) throw new Error('Error al archivar');
      }
      setOrders([]);
      setDraft(null);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      showToast('Trailer reseteado · listo para nueva carga', 'success');
    } catch (e) {
      showToast('Error al refrescar: ' + e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }

  // Cálculos globales con packing 2-carriles
  const allBoxes = [];
  orders.forEach((o) => o.boxes.forEach((b) => allBoxes.push(b)));
  if (draft) draft.boxes.forEach((b) => allBoxes.push(b));
  const { totalUsed: totalAll } = packBoxes(allBoxes);

  // overflow real: solo se activa al pasar la tolerancia interna
  // (CAPACITY_LIMIT). Mientras tanto, "Disponible" y "Capacidad" se
  // muestran como si el tope siguiera siendo TRAILER_LENGTH (se topan en
  // 0 / 100%) para que no se note la tolerancia extra.
  const overflow = totalAll > CAPACITY_LIMIT;
  const remaining = overflow
    ? CAPACITY_LIMIT - totalAll
    : Math.max(0, TRAILER_LENGTH - totalAll);
  const capacityPct = overflow
    ? (totalAll / CAPACITY_LIMIT) * 100
    : Math.min(100, (totalAll / TRAILER_LENGTH) * 100);
  const usedPct = Math.min(100, capacityPct);

  return (
    <>
      <Head>
        <title>Trailer Load Visualizer</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content={THEME_COLORS[theme]} />
      </Head>

      <main className="page">
        <header className="topbar">
          <div className="brand">
            <h1>
              Trailer <span className="brand-accent">Load</span> Visualizer
            </h1>
            <p className="subtitle">
              Vista superior · Largo {TRAILER_LENGTH} m · v{CURRENT_VERSION}
            </p>
          </div>
          <div className="topbar-actions">
            <button
              className="btn-history"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark'
                  ? 'Cambiar a tema claro'
                  : 'Cambiar a tema oscuro'
              }
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            </button>
            <button
              className="btn-history"
              onClick={() => setShowChangelog(true)}
              aria-label="Ver historial de actualizaciones"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Actualizaciones</span>
            </button>
            <button
              className="btn-history"
              onClick={() => setShowHistory(true)}
              aria-label="Ver historial"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Historial</span>
            </button>
          </div>
        </header>

        <section className="hero-stats">
          <div className="hero-card">
            <span className="hero-lbl">Total usado</span>
            <span className="hero-num">
              {totalAll.toFixed(2)}
              <small>m</small>
            </span>
          </div>
          <div className="hero-card">
            <span className="hero-lbl">
              {overflow ? 'Sobresale' : 'Disponible'}
            </span>
            <span
              className={`hero-num ${
                overflow ? 'hero-num-red' : 'hero-num-green'
              }`}
            >
              {Math.abs(remaining).toFixed(2)}
              <small>m</small>
            </span>
          </div>
          <div className="hero-card hero-card-wide">
            <div className="progress-row">
              <span className="hero-lbl">Capacidad</span>
              <span
                className={`hero-pct ${overflow ? 'pct-red' : 'pct-green'}`}
              >
                {capacityPct.toFixed(0)}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${
                  overflow ? 'pf-red' : 'pf-green'
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <OrderForm
            draft={draft}
            onStart={startDraft}
            onAddBoxes={addBoxesToDraft}
            onRemoveBoxOfSize={removeOneBoxOfSize}
            onSave={saveDraft}
            onCancel={cancelDraft}
            saving={saving}
          />
        </section>

        <section className="panel panel-trailer">
          <div className="panel-header">
            <h2 className="section-title">
              <span className="section-dot" /> Vista superior del camión
              <span className="count-badge">{orders.length}</span>
            </h2>
            <button
              className="btn-refresh"
              onClick={refreshTrailer}
              disabled={refreshing}
              title="Vacía el trailer y conserva el historial"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {refreshing ? 'Refrescando…' : 'Refrescar'}
            </button>
          </div>
          <TrailerView
            orders={orders}
            draft={draft}
            trailerLength={TRAILER_LENGTH}
            capacityLimit={CAPACITY_LIMIT}
            onReorderDraft={reorderDraftBox}
            onSwapDraft={swapDraftBoxes}
          />
          {!loading && orders.length === 0 && !draft && (
            <p className="empty empty-trailer">
              Trailer vacío · iniciá una orden arriba ↑
            </p>
          )}
        </section>
      </main>

      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onReprint={reprintPdf}
        onDelete={deleteOrder}
        onViewSimulation={setSimulationOrder}
      />

      <SimulationModal
        order={simulationOrder}
        onClose={() => setSimulationOrder(null)}
        onReprint={reprintPdf}
      />

      <LimitModal data={limitInfo} onClose={() => setLimitInfo(null)} />

      <ChangelogModal
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
      />

      <WhatsNewModal
        open={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        onViewFullHistory={() => setShowChangelog(true)}
      />

      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role="status"
          aria-live="polite"
          onClick={() => setToast(null)}
          key={toast.id}
        >
          <span className="toast-icon">
            {toast.type === 'success'
              ? '✓'
              : toast.type === 'warn'
              ? '!'
              : '✕'}
          </span>
          <span className="toast-msg">{toast.msg}</span>
        </div>
      )}
    </>
  );
}
