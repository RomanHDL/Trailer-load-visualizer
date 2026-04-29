import { useEffect, useState } from 'react';
import Head from 'next/head';
import OrderForm from '../components/OrderForm';
import TrailerView from '../components/TrailerView';
import OrderList from '../components/OrderList';
import { SIZE_TABLE } from '../data/sizeTable';

const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
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

  // Quita la última caja agregada de esa medida (afecta visualmente la posición más a la derecha)
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
        alert(err.error || 'Error al guardar');
        return;
      }
      const created = await res.json();

      const { generateOrderPdf } = await import('../lib/pdfGenerator');
      await generateOrderPdf({
        order: created,
        trailerLength: TRAILER_LENGTH,
        allOrders: [...orders, created],
      });

      setOrders((prev) => [...prev, created]);
      setDraft(null);
    } catch (e) {
      console.error(e);
      alert('Error al guardar/generar PDF: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(id) {
    if (!confirm('¿Eliminar esta orden?')) return;
    await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    setOrders((prev) => prev.filter((o) => o._id !== id));
  }

  async function reprintPdf(order) {
    const { generateOrderPdf } = await import('../lib/pdfGenerator');
    await generateOrderPdf({
      order,
      trailerLength: TRAILER_LENGTH,
      allOrders: orders,
    });
  }

  async function resetAll() {
    if (!confirm('¿Borrar TODAS las órdenes guardadas?')) return;
    await fetch('/api/orders', { method: 'DELETE' });
    setOrders([]);
    setDraft(null);
  }

  // Cálculos globales
  const totalAll = orders.reduce((s, o) => s + o.totalMeters, 0)
    + (draft ? draft.boxes.reduce((s, b) => s + b.meters, 0) : 0);
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

        {/* Hero stats */}
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
                className={`progress-fill ${overflow ? 'pf-red' : 'pf-green'}`}
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
    </>
  );
}
