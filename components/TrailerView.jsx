import { packBoxes } from '../lib/packing';

const ORDER_COLORS = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#84cc16', '#14b8a6', '#a855f7',
  '#0ea5e9', '#f43f5e',
];

const DRAFT_COLOR = '#fbbf24';

export default function TrailerView({ orders, draft, trailerLength }) {
  // Construir secuencia plana con metadata por orden
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

  // Packing 2-carriles
  const { placed, totalUsed, lane1, lane2 } = packBoxes(sequence);
  const overflow = totalUsed > trailerLength;

  // Marcar las cajas que cruzan el límite (en color rojo)
  placed.forEach((b) => {
    b.exceedsLimit = b.end > trailerLength;
    if (b.exceedsLimit) b.color = '#ef4444';
  });

  // Escala visual: si overflow, el ancho crece para mostrar lo que sobresale
  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const ticks = Array.from({ length: Math.ceil(visualMax) }, (_, i) => i + 1);
  const limitPct = (trailerLength / visualMax) * 100;

  // Posicionamiento del label "LÍMITE" para que no se corte en bordes
  let limitLabelTransform = 'translateX(-50%)';
  if (limitPct > 88) limitLabelTransform = 'translateX(-100%)';
  else if (limitPct < 12) limitLabelTransform = 'translateX(0)';

  return (
    <div className="trailer-wrap">
      <div className="trailer-meta">
        <span className="meta-item">
          <span className="meta-dot meta-dot-lane2" />
          Cada tarima ocupa medio carril · 2 tarimas en paralelo
        </span>
      </div>

      <div className="trailer-scroll">
        <div
          className={`trailer-stage ${overflow ? 'overflow' : 'ok'}`}
          style={{
            width: `${(visualMax / trailerLength) * 100}%`,
            minWidth: '100%',
          }}
        >
          {/* Cabeza tractor (frente) */}
          <div className="trailer-cab" aria-hidden="true">
            <span>FRENTE</span>
          </div>

          {/* Cuerpo del trailer con 2 carriles */}
          <div className="trailer-body">
            {/* Línea divisoria entre carriles */}
            <div className="lane-divider" aria-hidden="true" />

            {/* Líneas guía cada metro */}
            {ticks.map((m) => (
              <div
                key={m}
                className="trailer-tick"
                style={{ left: `${(m / visualMax) * 100}%` }}
              >
                <span>{m}m</span>
              </div>
            ))}

            {/* Zona de OVERFLOW (visual rojo translúcido pasando el límite) */}
            {overflow && (
              <div
                className="overflow-zone"
                style={{
                  left: `${limitPct}%`,
                  width: `${100 - limitPct}%`,
                }}
                aria-hidden="true"
              />
            )}

            {/* Marca del LÍMITE — gruesa, rayada, visible */}
            <div
              className="trailer-limit"
              style={{ left: `${limitPct}%` }}
            >
              <div
                className="limit-tag"
                style={{ transform: limitLabelTransform }}
              >
                LÍMITE · {trailerLength}m
              </div>
            </div>

            {/* Cajas posicionadas según packing */}
            {placed.map((b) => {
              const left = (b.start / visualMax) * 100;
              const width = (b.meters / visualMax) * 100;
              const laneClass = b.full
                ? 'box-full'
                : b.lane === 1
                ? 'box-lane1'
                : 'box-lane2';

              return (
                <div
                  key={b.idx}
                  className={`box animate-in ${laneClass} ${
                    b.isDraft ? 'box-draft' : ''
                  } ${b.exceedsLimit ? 'box-over' : ''}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: b.color,
                  }}
                  title={`Orden ${b.orderNumber} • ${b.inches}" • ${b.meters} m${
                    b.full ? ' · ancho completo' : ' · medio carril'
                  }`}
                >
                  <div className="box-label">
                    <strong>{b.orderNumber}</strong>
                    <span>{b.inches}"</span>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {placed.length === 0 && (
              <div className="trailer-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
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

      {/* Estado por carril */}
      <div className="lanes-status">
        <div className="lane-stat">
          <span className="lane-stat-lbl">Carril sup.</span>
          <span className="lane-stat-num">{lane1.toFixed(2)} m</span>
        </div>
        <div className="lane-stat">
          <span className="lane-stat-lbl">Carril inf.</span>
          <span className="lane-stat-num">{lane2.toFixed(2)} m</span>
        </div>
        <div
          className={`lane-stat lane-stat-total ${
            overflow ? 'lane-stat-over' : ''
          }`}
        >
          <span className="lane-stat-lbl">Largo trailer usado</span>
          <span className="lane-stat-num">
            {totalUsed.toFixed(2)} / {trailerLength} m
          </span>
        </div>
      </div>
    </div>
  );
}
