import { useRef, useState } from 'react';
import { packBoxes } from '../lib/packing';
import {
  displayOrderNumber,
  displayOrderNumberShort,
} from '../lib/orderNumber';

const ORDER_COLORS = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#84cc16', '#14b8a6', '#a855f7',
  '#0ea5e9', '#f43f5e',
];

const DRAFT_COLOR = '#fbbf24';
const DRAG_THRESHOLD = 5; // px de movimiento mínimo para considerar drag

export default function TrailerView({
  orders,
  draft,
  trailerLength,
  capacityLimit,
  onReorderDraft,
}) {
  const bodyRef = useRef(null);
  const [drag, setDrag] = useState(null);
  // drag = { draftIdx, pointerId, startX, startY, currentX, currentY, moved }

  // Construir secuencia. Marcar draftIdx para los del draft.
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
    draft.boxes.forEach((b, i) => {
      sequence.push({
        ...b,
        orderNumber: draft.orderNumber,
        color: DRAFT_COLOR,
        isDraft: true,
        draftIdx: i,
      });
    });
  }

  // El tope real de tolerancia puede ser mayor al que se muestra en pantalla
  // (ver CAPACITY_LIMIT en pages/index.js). `trailerLength` sigue marcando
  // la línea/etiqueta de "LÍMITE" que se ve en pantalla; `capacityLimit` es
  // el que realmente decide cuándo algo se pinta como excedido.
  const effectiveLimit = capacityLimit ?? trailerLength;

  const { placed, totalUsed, lane1, lane2 } = packBoxes(sequence);
  const overflow = totalUsed > effectiveLimit;
  placed.forEach((b) => {
    b.exceedsLimit = b.end > effectiveLimit;
    if (b.exceedsLimit) b.color = '#ef4444';
  });

  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const ticks = Array.from({ length: Math.ceil(visualMax) }, (_, i) => i + 1);
  const limitPct = (trailerLength / visualMax) * 100;

  let limitLabelTransform = 'translateX(-50%)';
  if (limitPct > 88) limitLabelTransform = 'translateX(-100%)';
  else if (limitPct < 12) limitLabelTransform = 'translateX(0)';

  // Cajas del draft solamente, en orden de aparición en placed
  const draftPlaced = placed.filter((p) => p.isDraft);

  // ===== DRAG HANDLERS =====
  function handlePointerDown(e, b) {
    if (!b.isDraft || !onReorderDraft) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDrag({
      draftIdx: b.draftIdx,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      moved: false,
    });
  }

  function handlePointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved =
      drag.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
    setDrag({ ...drag, currentX: e.clientX, currentY: e.clientY, moved });
  }

  function handlePointerUp(e) {
    if (!drag) {
      setDrag(null);
      return;
    }
    if (!drag.moved) {
      setDrag(null);
      return;
    }
    if (!bodyRef.current || !draft) {
      setDrag(null);
      return;
    }
    const rect = bodyRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorMeters = Math.max(
      0,
      Math.min(visualMax, (cursorX / rect.width) * visualMax)
    );

    // Encontrar a qué posición DENTRO DEL DRAFT corresponde el cursor
    let targetDraftIdx = draft.boxes.length;
    for (let i = 0; i < draftPlaced.length; i++) {
      const p = draftPlaced[i];
      const center = p.start + p.meters / 2;
      if (cursorMeters < center) {
        targetDraftIdx = p.draftIdx;
        break;
      }
    }
    if (targetDraftIdx !== drag.draftIdx) {
      onReorderDraft(drag.draftIdx, targetDraftIdx);
    }
    setDrag(null);
  }

  function handlePointerCancel() {
    setDrag(null);
  }

  return (
    <div className="trailer-wrap">
      <div className="trailer-meta">
        <span className="meta-item">
          <span className="meta-dot meta-dot-lane2" />
          Cada tarima ocupa medio carril · 2 tarimas en paralelo
        </span>
        <span className="meta-item">
          <span className="meta-corner-sample" aria-hidden="true" />
          Esquinas marcadas = esquineros (medida ya incluye +1cm por lado)
        </span>
        {draft && draft.boxes.length > 1 && (
          <span className="meta-item meta-item-hint">
            Arrastrá las tarimas amarillas para reordenarlas
          </span>
        )}
      </div>

      <div className="trailer-scroll">
        <div className="truck-stage">
          <div className="truck-tractor" aria-hidden="true">
            <div className="tractor-windshield" />
            <div className="tractor-body" />
            <div className="wheel wheel-tractor-fl" />
            <div className="wheel wheel-tractor-fr" />
            <div className="wheel wheel-tractor-rl" />
            <div className="wheel wheel-tractor-rr" />
          </div>

          <div className="truck-hitch" aria-hidden="true" />

          <div className={`trailer-stage ${overflow ? 'overflow' : 'ok'}`}>
            <div className="trailer-cab" aria-hidden="true">
              <span>FRENTE</span>
            </div>

            <div className="trailer-body" ref={bodyRef}>
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

                const isDragging =
                  drag && b.isDraft && b.draftIdx === drag.draftIdx;
                const dragStyle = isDragging
                  ? {
                      transform: `translate(${drag.currentX - drag.startX}px, ${
                        drag.currentY - drag.startY
                      }px) scale(1.05)`,
                      zIndex: 100,
                      opacity: 0.85,
                      cursor: 'grabbing',
                      transition: 'none',
                    }
                  : {};

                return (
                  <div
                    key={b.idx}
                    className={`box animate-in ${laneClass} ${
                      b.isDraft ? 'box-draggable' : ''
                    } ${b.isDraft ? 'box-draft' : ''} ${
                      b.exceedsLimit ? 'box-over' : ''
                    } ${isDragging ? 'box-dragging' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: b.color,
                      ...dragStyle,
                    }}
                    title={`Orden ${displayOrderNumber(b.orderNumber)} • ${b.inches}" • ${b.meters} m${
                      b.isDraft ? ' · arrastrá para reordenar' : ''
                    }`}
                    onPointerDown={(e) => handlePointerDown(e, b)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                  >
                    <span className="box-corner box-corner-tl" aria-hidden="true" />
                    <span className="box-corner box-corner-tr" aria-hidden="true" />
                    <span className="box-corner box-corner-bl" aria-hidden="true" />
                    <span className="box-corner box-corner-br" aria-hidden="true" />

                    <div className="box-label">
                      <strong>{displayOrderNumberShort(b.orderNumber)}</strong>
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
