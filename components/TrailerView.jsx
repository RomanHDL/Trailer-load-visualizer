import { packBoxes } from '../lib/packing';

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

  const { placed, totalUsed, lane1, lane2 } = packBoxes(sequence);
  const overflow = totalUsed > trailerLength;

  placed.forEach((b) => {
    b.exceedsLimit = b.end > trailerLength;
    if (b.exceedsLimit) b.color = '#ef4444';
  });

  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const ticks = Array.from({ length: Math.ceil(visualMax) }, (_, i) => i + 1);
  const limitPct = (trailerLength / visualMax) * 100;

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
        <span className="meta-item">
          <span className="meta-arrow">→</span>
          Sentido de carga: izquierda hacia derecha
        </span>
      </div>

      <div className="trailer-scroll">
        <div className="truck-stage">
          {/* TRACTOR (cabina del camión) */}
          <div className="truck-tractor" aria-hidden="true">
            <div className="tractor-windshield" />
            <div className="tractor-body" />
            <div className="wheel wheel-tractor-fl" />
            <div className="wheel wheel-tractor-fr" />
            <div className="wheel wheel-tractor-rl" />
            <div className="wheel wheel-tractor-rr" />
          </div>

          {/* HITCH (enganche) */}
          <div className="truck-hitch" aria-hidden="true" />

          {/* TRAILER — siempre a 100% del contenedor (sin scroll horizontal).
              Cuando hay overflow, las cajas se escalan a visualMax y la zona
              roja marca el espacio que sobresale del límite. */}
          <div
            className={`trailer-stage ${overflow ? 'overflow' : 'ok'}`}
          >
            <div className="trailer-cab" aria-hidden="true">
              <span>FRENTE</span>
            </div>

            <div className="trailer-body">
              <div className="lane-divider" aria-hidden="true" />

              {ticks.map((m) => (
                <div
                  key={m}
                  className="trailer-tick"
                  style={{ left: `${(m / visualMax) * 100}%` }}
                >
                  <span>{m}m</span>
                </div>
              ))}

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
                    title={`Orden ${b.orderNumber} • ${b.inches}" • ${b.meters} m`}
                  >
                    <div className="box-label">
                      <strong>{b.orderNumber}</strong>
                      <span>{b.inches}"</span>
                    </div>
                  </div>
                );
              })}

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

            <div className="trailer-doors" aria-hidden="true">
              <span>PUERTAS</span>
              <div className="door-handle" />
            </div>

            {/* Ruedas del trailer (2 ejes traseros + 1 delantero) */}
            <div className="wheel wheel-trailer-fl" />
            <div className="wheel wheel-trailer-fr" />
            <div className="wheel wheel-trailer-ml" />
            <div className="wheel wheel-trailer-mr" />
            <div className="wheel wheel-trailer-rl" />
            <div className="wheel wheel-trailer-rr" />
          </div>
        </div>
      </div>

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
