// Vista superior. Aplana todas las órdenes (saved + draft) en una secuencia
// de cajas y las dibuja en línea. Cajas de la misma orden comparten color.

const ORDER_COLORS = [
  '#2563eb', '#0891b2', '#7c3aed', '#db2777',
  '#ea580c', '#65a30d', '#0d9488', '#9333ea',
  '#0369a1', '#be185d',
];

export default function TrailerView({ orders, draft, trailerLength }) {
  // Construye la lista plana de cajas con ref a su orden
  const sequence = [];
  orders.forEach((o, idx) => {
    o.boxes.forEach((b) => {
      sequence.push({
        ...b,
        orderNumber: o.orderNumber,
        colorIdx: idx,
        isDraft: false,
      });
    });
  });
  if (draft && draft.boxes.length) {
    draft.boxes.forEach((b) => {
      sequence.push({
        ...b,
        orderNumber: draft.orderNumber,
        colorIdx: orders.length,
        isDraft: true,
      });
    });
  }

  const totalUsed = sequence.reduce((s, b) => s + b.meters, 0);
  const overflow = totalUsed > trailerLength;
  const remaining = trailerLength - totalUsed;

  let cursor = 0;
  const placed = sequence.map((b, i) => {
    const start = cursor;
    cursor += b.meters;
    const exceedsLimit = start + b.meters > trailerLength;
    return {
      ...b,
      key: i,
      start,
      end: cursor,
      color: exceedsLimit
        ? '#dc2626'
        : ORDER_COLORS[b.colorIdx % ORDER_COLORS.length],
      exceedsLimit,
    };
  });

  const visualMax = Math.max(trailerLength, totalUsed, 0.01);

  return (
    <div className="trailer-wrap">
      <div className="trailer-stats">
        <span>
          Usado <strong>{totalUsed.toFixed(2)} m</strong> /{' '}
          {trailerLength.toFixed(2)} m
        </span>
        <span className={overflow ? 'pill pill-red' : 'pill pill-green'}>
          {overflow
            ? `Sobresale ${(totalUsed - trailerLength).toFixed(2)} m`
            : `Sobra ${remaining.toFixed(2)} m`}
        </span>
      </div>

      <div className="trailer-scroll">
        <div
          className={`trailer ${overflow ? 'overflow' : 'ok'}`}
          style={{
            width: `${(visualMax / trailerLength) * 100}%`,
            minWidth: '100%',
          }}
        >
          <div
            className="trailer-limit"
            style={{ left: `${(trailerLength / visualMax) * 100}%` }}
          >
            <span>LÍMITE</span>
          </div>

          {Array.from({ length: Math.ceil(visualMax) }).map((_, i) => (
            <div
              key={i}
              className="trailer-tick"
              style={{ left: `${((i + 1) / visualMax) * 100}%` }}
            >
              <span>{i + 1}m</span>
            </div>
          ))}

          {placed.map((b) => (
            <div
              key={b.key}
              className={`box animate-in ${b.isDraft ? 'box-draft' : ''}`}
              style={{
                left: `${(b.start / visualMax) * 100}%`,
                width: `${(b.meters / visualMax) * 100}%`,
                background: b.color,
              }}
              title={`Orden ${b.orderNumber} • ${b.inches}" • ${b.meters} m`}
            >
              <div className="box-label">
                <strong>{b.orderNumber}</strong>
                <span>{b.inches}"</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
