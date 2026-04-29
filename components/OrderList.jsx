export default function OrderList({ orders, onDelete, onReprint }) {
  if (!orders.length) {
    return (
      <p className="empty">
        Aún no hay órdenes guardadas. Iniciá una orden arriba ↑
      </p>
    );
  }

  return (
    <ul className="order-list">
      {orders.map((o, i) => {
        const counts = {};
        o.boxes.forEach((b) => {
          counts[b.inches] = (counts[b.inches] || 0) + 1;
        });

        return (
          <li key={o._id}>
            <div className="order-head">
              <span className="idx">#{i + 1}</span>
              <span className="num">Orden {o.orderNumber}</span>
              <span className="size">
                {o.boxes.length} cajas · {o.totalMeters.toFixed(2)} m
              </span>
            </div>

            <div className="order-body">
              {Object.entries(counts)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([inches, qty]) => (
                  <span className="chip chip-sm" key={inches}>
                    {qty}× {inches}"
                  </span>
                ))}
            </div>

            <div className="order-actions">
              <button
                className="btn-ghost btn-sm"
                onClick={() => onReprint(o)}
              >
                PDF
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => onDelete(o._id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
