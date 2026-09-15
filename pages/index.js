import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import OrderForm from '../components/OrderForm';
import TrailerView from '../components/TrailerView';
import HistoryModal from '../components/HistoryModal';
import LimitModal from '../components/LimitModal';
import { SIZE_TABLE } from '../data/sizeTable';
import { packBoxes } from '../lib/packing';

const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

const DRAFT_STORAGE_KEY = 'trailer:draft:v1';

export default function Home() {
  const [orders, setOrders] = useState([]); // solo activas
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null);
  const draftHydrated = useRef(false);

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

    // Simulamos de a una tarima cuántas caben antes de pasar el límite —
    // todo o nada, no se agrega una cantidad parcial.
    let fits = 0;
    const probe = [...existingBoxes];
    for (let i = 0; i < n; i++) {
      probe.push({ inches, meters });
      if (packBoxes(probe).totalUsed > TRAILER_LENGTH) {
        probe.pop();
        break;
      }
      fits++;
    }

    if (fits < n) {
      const { totalUsed: currentUsed } = packBoxes(existingBoxes);
      const availableM = Math.max(0, TRAILER_LENGTH - currentUsed);
      const neededM = n * meters;
      setLimitInfo({
        inches,
        metersPerUnit: meters,
        requestedQty: n,
        fits,
        availableM,
        neededM,
        missingM: Math.max(0, (n - fits) * meters),
      });
      return;
    }

    const newBoxes = Array.from({ length: n }, () => ({ inches, meters }));
    setDraft((d) => ({ ...d, boxes: [...d.boxes, ...newBoxes] }));
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

  async function saveDraft() {
    if (!draft || draft.boxes.length === 0) return;
    setSaving(true);

    let savedOrder = null;
    let nextOrders = null;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: draft.orderNumber,
          boxes: draft.boxes.map((b) => ({ inches: b.inches })),
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
  const remaining = TRAILER_LENGTH - totalAll;
  const overflow = totalAll > TRAILER_LENGTH;
  const usedPct = Math.min(100, (totalAll / TRAILER_LENGTH) * 100);

  return (
    <>
      <Head>
        <title>Trailer Load Visualizer</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0b1220" />
      </Head>

      <main className="page">
        <header className="topbar">
          <div className="brand">
            <h1>
              Trailer <span className="brand-accent">Load</span> Visualizer
            </h1>
            <p className="subtitle">
              Vista superior · Largo {TRAILER_LENGTH} m
            </p>
          </div>
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
                {((totalAll / TRAILER_LENGTH) * 100).toFixed(0)}%
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
            onReorderDraft={reorderDraftBox}
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
      />

      <LimitModal data={limitInfo} onClose={() => setLimitInfo(null)} />

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
