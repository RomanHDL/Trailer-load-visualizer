// Vista superior. Aplana todas las órdenes (saved + draft) en una secuencia
// de cajas y las dibuja en línea. Cajas de la misma orden comparten color.

const ORDER_COLORS = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#84cc16', '#14b8a6', '#a855f7',
  '#0ea5e9', '#f43f5e',
];

const DRAFT_COLOR = '#fbbf24';

export default function TrailerView({ orders, draft, trailerLength }) {
  const sequence = [];
  orders.forEach((o, idx) => {
    o.boxes.forEach((b) => {
      sequence.push({
        ...b,
        orderNumber: o.orderNumber,
        color: ORDER_COLORS[idx % ORDER_COLORS.length],
        isDraft: false,
      });
    });
  });
  if (draft && draft.boxes.length) {
    draft.boxes.forEach((b) => {
      sequence.push({
        ...b,
        orderNumber: draft.orderNumber,
        color: DRAFT_COLOR,
        isDraft: true,
      });
    });
  }

  const totalUsed = sequence.reduce((s, b) => s + b.meters, 0);
  const overflow = totalUsed > trailerLength;

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
      color: exceedsLimit ? '#ef4444' : b.color,
      exceedsLimit,
    };
  });

  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const ticks = Array.from({ length: Math.ceil(visualMax) }, (_, i) => i + 1);

  return (
    <div className="trailer-wrap">
      <div className="trailer-scroll">
        <div
          className={`trailer-stage ${overflow ? 'overflow' : 'ok'}`}
          style={{
            width: `${(visualMax / trailerLength) * 100}%`,
            minWidth: '100%',
          }}
        >
          {/* Cabeza tractor (lado izquierdo - frente) */}
          <div className="trailer-cab" aria-hidden="true">
            <span>FRENTE</span>
          </div>

          {/* Cuerpo principal del trailer */}
          <div className="trailer-body">
            {/* Líneas guía cada metro */}
            {ticks.map((m) => (
              <div
                key={m}
                className={`trailer-tick ${
                  m === Math.floor(trailerLength) ? 'trailer-tick-major' : ''
                }`}
                style={{ left: `${(m / visualMax) * 100}%` }}
              >
                <span>{m}m</span>
              </div>
            ))}

            {/* Marca del límite del trailer */}
            <div
              className="trailer-limit"
              style={{ left: `${(trailerLength / visualMax) * 100}%` }}
            >
              <span className="limit-tag">LÍMITE {trailerLength}m</span>
            </div>

            {/* Cajas */}
            {placed.map((b) => (
              <div
                key={b.key}
                className={`box animate-in ${b.isDraft ? 'box-draft' : ''} ${
                  b.exceedsLimit ? 'box-over' : ''
                }`}
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

            {/* Empty state */}
            {placed.length === 0 && (
              <div className="trailer-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7h13v10H3zM16 10h4l1 4v3h-5z M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Trailer vacío</span>
              </div>
            )}
          </div>

          {/* Puertas (lado derecho) */}
          <div className="trailer-doors" aria-hidden="true">
            <span>PUERTAS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
