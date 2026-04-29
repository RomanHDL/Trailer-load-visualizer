import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import OrderForm from '../components/OrderForm';
import TrailerView from '../components/TrailerView';
import OrderList from '../components/OrderList';
import { SIZE_TABLE } from '../data/sizeTable';
import { packBoxes } from '../lib/packing';

const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

const DRAFT_STORAGE_KEY = 'trailer:draft:v1';

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const draftHydrated = useRef(false);

  // Restaurar draft de localStorage en el primer mount
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
      // ignore
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  // Persistir draft en localStorage cada vez que cambia (evita perder trabajo)
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
      // ignore
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
      showToast('No se pudo cargar las órdenes guardadas', 'error');
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
    const newBoxes = Array.from({ length: n }, () => ({ inches, meters }));
    setDraft((d) => ({ ...d, boxes: [...d.boxes, ...newBoxes] }));
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

    // ---- Paso 1: guardar en servidor (lo más importante) ----
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: draft.orderNumber,
          // Solo mandamos inches; el server recomputa meters desde SIZE_TABLE
          // para asegurar consistencia de datos.
          boxes: draft.boxes.map((b) => ({ inches: b.inches })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status} al guardar`);
      }

      savedOrder = await res.json();

      // Verificación: la orden volvió completa (todas las cajas)
      if (
        !savedOrder._id ||
        !Array.isArray(savedOrder.boxes) ||
        savedOrder.boxes.length !== draft.boxes.length
      ) {
        throw new Error(
          `La orden se guardó incompleta (${
            savedOrder.boxes?.length ?? 0
          }/${draft.boxes.length} tarimas). Revisar.`
        );
      }

      // Persistir en estado ANTES de intentar PDF — si PDF falla, la orden ya está
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
      return; // draft preservado
    }

    // ---- Paso 2: generar PDF (no bloquea la persistencia) ----
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
        `Orden ${savedOrder.orderNumber} guardada. El PDF falló — usá el botón "PDF" en la lista para reintentar.`,
        'warn',
        7000
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(id) {
    if (!confirm('¿Eliminar esta orden?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Error al eliminar');
      setOrders((prev) => prev.filter((o) => o._id !== id));
      showToast('Orden eliminada', 'success');
    } catch (e) {
      showToast('No se pudo eliminar: ' + e.message, 'error');
    }
  }

  async function reprintPdf(order) {
    try {
      const { generateOrderPdf } = await import('../lib/pdfGenerator');
      await generateOrderPdf({
        order,
        trailerLength: TRAILER_LENGTH,
        allOrders: orders,
      });
      showToast('PDF regenerado', 'success', 2500);
    } catch (e) {
      showToast('No se pudo generar el PDF: ' + e.message, 'error');
    }
  }

  async function resetAll() {
    if (!confirm('¿Borrar TODAS las órdenes guardadas?')) return;
    try {
      await fetch('/api/orders', { method: 'DELETE' });
      setOrders([]);
      setDraft(null);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      showToast('Trailer reseteado', 'success', 2500);
    } catch (e) {
      showToast('Error al resetear: ' + e.message, 'error');
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
          <h2 className="section-title">
            <span className="section-dot" /> Trailer
          </h2>
          <TrailerView
            orders={orders}
            draft={draft}
            trailerLength={TRAILER_LENGTH}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="section-title">
              <span className="section-dot" /> Órdenes guardadas
              <span className="count-badge">{orders.length}</span>
            </h2>
            {orders.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={resetAll}>
                Borrar todas
              </button>
            )}
          </div>
          {loading ? (
            <p className="empty">Cargando…</p>
          ) : (
            <OrderList
              orders={orders}
              onDelete={deleteOrder}
              onReprint={reprintPdf}
            />
          )}
        </section>
      </main>

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
