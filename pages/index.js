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
  const [draft, setDraft] = useState(null); // { orderNumber, boxes: [{inches, meters}] }
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

  function addBoxToDraft(inches) {
    const meters = SIZE_TABLE[inches];
    if (!meters) return;
    setDraft((d) => ({ ...d, boxes: [...d.boxes, { inches, meters }] }));
  }

  function removeBoxFromDraft(idx) {
    setDraft((d) => ({
      ...d,
      boxes: d.boxes.filter((_, i) => i !== idx),
    }));
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

      // Generar PDF antes de cerrar el draft
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

  return (
    <>
      <Head>
        <title>Trailer Load Visualizer · Mundial</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main className="page">
        <header className="topbar">
          <div className="brand">
            <h1>Trailer Load Visualizer</h1>
            <p className="subtitle">
              Largo total: {TRAILER_LENGTH} m · Vista superior
            </p>
          </div>
          <img
            src="/mundial-logo.webp"
            alt="Mundial"
            className="brand-logo"
          />
        </header>

        <section className="panel">
          <OrderForm
            draft={draft}
            onStart={startDraft}
            onAddBox={addBoxToDraft}
            onRemoveBox={removeBoxFromDraft}
            onSave={saveDraft}
            onCancel={cancelDraft}
            saving={saving}
          />
        </section>

        <section className="panel panel-trailer">
          <h2>Trailer</h2>
          <TrailerView
            orders={orders}
            draft={draft}
            trailerLength={TRAILER_LENGTH}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Órdenes guardadas ({orders.length})</h2>
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
