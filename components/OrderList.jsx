export default function OrderList({ orders, onDelete }) {
  if (!orders.length) {
    return <p className="empty">No hay órdenes todavía. Agrega la primera ↑</p>;
  }

  return (
    <ul className="order-list">
      {orders.map((o, i) => (
        <li key={o._id}>
          <span className="idx">#{i + 1}</span>
          <span className="num">Orden {o.orderNumber}</span>
          <span className="size">
            {o.inches}" → {o.meters} m
          </span>
          <button
            className="del"
            onClick={() => onDelete(o._id)}
            title="Eliminar"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
