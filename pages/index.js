import { useEffect, useState } from 'react';
import Head from 'next/head';
import OrderForm from '../components/OrderForm';
import TrailerView from '../components/TrailerView';
import OrderList from '../components/OrderList';

const TRAILER_LENGTH = Number(
  process.env.NEXT_PUBLIC_TRAILER_LENGTH || 15.9
);

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addOrder(payload) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Error al agregar la orden');
      return;
    }
    const created = await res.json();
    setOrders((prev) => [...prev, created]);
  }

  async function deleteOrder(id) {
    await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    setOrders((prev) => prev.filter((o) => o._id !== id));
  }

  async function reset() {
    if (!confirm('¿Vaciar el trailer y borrar todas las órdenes?')) return;
    await fetch('/api/orders', { method: 'DELETE' });
    setOrders([]);
  }

  return (
    <>
      <Head>
        <title>Trailer Load Visualizer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        <header>
          <h1>Trailer Load Visualizer</h1>
          <p className="subtitle">
            Vista superior · Largo total: {TRAILER_LENGTH} m
          </p>
        </header>

        <section className="panel">
          <OrderForm onAdd={addOrder} disabled={loading} />
          <button className="reset" onClick={reset} disabled={!orders.length}>
            Reset
          </button>
        </section>

        <section className="panel">
          <TrailerView orders={orders} trailerLength={TRAILER_LENGTH} />
        </section>

        <section className="panel">
          <h2>Órdenes ({orders.length})</h2>
          <OrderList orders={orders} onDelete={deleteOrder} />
        </section>
      </main>
    </>
  );
}
