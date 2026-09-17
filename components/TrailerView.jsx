import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { packBoxes } from '../lib/packing';
import {
  displayOrderNumber,
  displayOrderNumberShort,
} from '../lib/orderNumber';
import { getSizeColor } from '../data/sizeColors';
import SizeLegend from './SizeLegend';

const DRAG_THRESHOLD = 5; // px de movimiento mínimo para considerar drag
const TAP_THRESHOLD = 6; // px de movimiento máximo para seguir considerándose "tap"

// Tooltip informativo de una tarima — mismo dato en desktop (hover) y
// touch (tap). `placed` sirve solo para calcular la posición dentro del
// carril; el resto sale directo de la tarima.
function PalletTooltip({ box, placed, style, tooltipRef }) {
  const laneLabel = box.full
    ? 'Ancho completo'
    : box.lane === 1
    ? 'Carril superior'
    : 'Carril inferior';
  const laneItems = placed.filter((p) => p.full || p.lane === box.lane);
  const position = laneItems.findIndex((p) => p.idx === box.idx) + 1;
  const accent = getSizeColor(box.inches).bg;

  return (
    <div
      ref={tooltipRef}
      className="pallet-tooltip"
      style={style ? { ...style, visibility: 'visible' } : { visibility: 'hidden' }}
    >
      <div className="pallet-tooltip-accent" style={{ background: accent }} />
      <div className="pallet-tooltip-title">{box.inches}"</div>
      <div className="pallet-tooltip-row">
        <span>Carril</span>
        <strong>{laneLabel}</strong>
      </div>
      <div className="pallet-tooltip-row">
        <span>Posición</span>
        <strong>{position}</strong>
      </div>
      <div className="pallet-tooltip-row">
        <span>Longitud</span>
        <strong>{box.meters.toFixed(2)} m</strong>
      </div>
      <div className="pallet-tooltip-row">
        <span>Orden</span>
        <strong>{displayOrderNumber(box.orderNumber)}</strong>
      </div>
    </div>
  );
}

export default function TrailerView({
  orders,
  draft,
  trailerLength,
  capacityLimit,
  onReorderDraft,
  onSwapDraft,
  // Acomodo ya congelado (carril/posición resueltos), para reconstruir una
  // simulación guardada tal cual quedó — sin recalcular packBoxes. Cuando
  // viene, `orders`/`draft` se ignoran para el dibujo y el drag & drop queda
  // deshabilitado (no hay tarimas marcadas isDraft).
  snapshot,
}) {
  const bodyRef = useRef(null);
  const [drag, setDrag] = useState(null);
  // drag = { draftIdx, pointerId, startX, startY, currentX, currentY, moved, preview }
  // preview = { mode: 'swap', targetIdx } | { mode: 'insert', targetIdx, atMeters, lane }

  // ===== Tooltip de información por tarima =====
  // Desktop: hover (mouseenter/leave). Touch: tap corto (se diferencia de un
  // drag real por el mismo tipo de umbral de movimiento que ya usa el
  // reordenamiento). `tapInfoRef` es independiente del estado de drag para
  // que funcione igual en tarimas no-draft (órdenes guardadas / snapshot).
  const [tooltip, setTooltip] = useState(null); // { box, anchorRect }
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const tooltipRef = useRef(null);
  const tapInfoRef = useRef(null); // { box, startX, startY, pointerType }

  // El tope real de tolerancia puede ser mayor al que se muestra en pantalla
  // (ver CAPACITY_LIMIT en pages/index.js). `trailerLength` sigue marcando
  // la línea/etiqueta de "LÍMITE" que se ve en pantalla; `capacityLimit` es
  // el que realmente decide cuándo algo se pinta como excedido.
  const effectiveLimit = capacityLimit ?? trailerLength;

  let placed, totalUsed, lane1, lane2;
  if (snapshot) {
    placed = snapshot.placed.map((b, i) => ({
      ...b,
      idx: i,
      color: getSizeColor(b.inches).bg,
      isDraft: false,
    }));
    totalUsed = snapshot.totalUsed;
    lane1 = snapshot.lane1;
    lane2 = snapshot.lane2;
  } else {
    // Construir secuencia. Marcar draftIdx para los del draft.
    const sequence = [];
    orders.forEach((o) => {
      o.boxes.forEach((b) => {
        sequence.push({
          ...b,
          orderNumber: o.orderNumber,
          color: getSizeColor(b.inches).bg,
          isDraft: false,
        });
      });
    });
    if (draft && draft.boxes.length) {
      draft.boxes.forEach((b, i) => {
        sequence.push({
          ...b,
          orderNumber: draft.orderNumber,
          color: getSizeColor(b.inches).bg,
          isDraft: true,
          draftIdx: i,
        });
      });
    }
    ({ placed, totalUsed, lane1, lane2 } = packBoxes(sequence));
  }
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

  // Cajas del draft solamente, en orden de aparición en placed (ya vienen en
  // orden ascendente de "start" dentro de cada carril, porque el packing
  // llena cada carril de forma acumulativa).
  const draftPlaced = placed.filter((p) => p.isDraft);

  // Determina, para una posición de cursor (x,y) sobre el trailer, qué va a
  // pasar si soltás ahí: swap exacto con la tarima que está debajo, o
  // inserción en el hueco más cercano dentro del mismo carril que el cursor.
  // Se usa tanto para la previsualización en vivo (pointermove) como para el
  // resultado final (pointerup) — siempre son el mismo cálculo, así lo que
  // se ve mientras se arrastra es exactamente lo que va a pasar al soltar.
  function computeDragTarget(clientX, clientY, draftIdx) {
    if (!bodyRef.current) return null;
    const rect = bodyRef.current.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const cursorMeters = Math.max(
      0,
      Math.min(visualMax, (cursorX / rect.width) * visualMax)
    );
    const hoveredLane = clientY - rect.top < rect.height / 2 ? 1 : 2;

    // Tarimas del draft en el carril donde está el cursor (o full-width),
    // sin contar la que se está arrastrando.
    const laneItems = draftPlaced.filter(
      (p) =>
        p.draftIdx !== draftIdx && (p.full || p.lane === hoveredLane)
    );

    // ¿El cursor está exactamente encima de otra tarima de ese carril?
    // -> swap real con esa tarima.
    const hovered = laneItems.find(
      (p) => cursorMeters >= p.start && cursorMeters <= p.end
    );
    if (hovered) {
      return { mode: 'swap', targetIdx: hovered.draftIdx, lane: hoveredLane };
    }

    // Si no, insertar en el hueco: antes de la primera tarima de ese carril
    // que empiece después del cursor.
    const next = laneItems.find((p) => p.start > cursorMeters);
    return {
      mode: 'insert',
      targetIdx: next ? next.draftIdx : draft.boxes.length,
      atMeters: next ? next.start : cursorMeters,
      lane: hoveredLane,
    };
  }

  function showTooltipFor(box, currentTarget) {
    const rect = currentTarget.getBoundingClientRect();
    setTooltip({
      box,
      anchorRect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
    });
  }

  function toggleTooltipFor(box, currentTarget) {
    setTooltip((prev) => {
      if (prev && prev.box.idx === box.idx) return null;
      const rect = currentTarget.getBoundingClientRect();
      return {
        box,
        anchorRect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      };
    });
  }

  // ===== DRAG HANDLERS (también trackean tap, para el tooltip) =====
  function handlePointerDown(e, b) {
    // Se guarda SIEMPRE (tarima del draft o no) para poder distinguir un tap
    // de un drag al soltar, y mostrar el tooltip en cualquier tarima.
    tapInfoRef.current = {
      box: b,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
    };
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
      preview: null,
    });
  }

  function handlePointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const moved =
      drag.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;
    if (moved && !drag.moved) setTooltip(null); // empezó un drag real: ocultar tooltip
    const preview = moved
      ? computeDragTarget(e.clientX, e.clientY, drag.draftIdx)
      : null;
    setDrag({ ...drag, currentX: e.clientX, currentY: e.clientY, moved, preview });
  }

  function handlePointerUp(e) {
    // Si había un drag de tarima del draft en curso, resolverlo (igual que
    // antes) y no mostrar tooltip — fue un arrastre, no un tap.
    if (drag) {
      if (drag.moved) {
        const target = drag.preview;
        if (target && draft) {
          if (target.mode === 'swap' && target.targetIdx !== drag.draftIdx) {
            onSwapDraft?.(drag.draftIdx, target.targetIdx);
          } else if (
            target.mode === 'insert' &&
            target.targetIdx !== drag.draftIdx
          ) {
            onReorderDraft(drag.draftIdx, target.targetIdx);
          }
        }
        setDrag(null);
        tapInfoRef.current = null;
        return;
      }
      setDrag(null);
    }

    // Tap (click corto de mouse, o touch sin moverse más que el umbral).
    const info = tapInfoRef.current;
    tapInfoRef.current = null;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) return;
    // El mouse ya muestra el tooltip por hover; el tap solo alterna en touch/pen.
    if (info.pointerType === 'mouse') return;
    toggleTooltipFor(info.box, e.currentTarget);
  }

  function handlePointerCancel() {
    setDrag(null);
    tapInfoRef.current = null;
  }

  // Placeholder visual de "acá va a quedar" mientras se arrastra en modo
  // inserción (en modo swap, en cambio, se resalta directamente la tarima
  // destino con box-drop-target).
  const insertPreview =
    drag && drag.moved && drag.preview && drag.preview.mode === 'insert'
      ? drag.preview
      : null;
  const draggedBox = drag ? draftPlaced.find((p) => p.draftIdx === drag.draftIdx) : null;

  // Posiciona el tooltip (portal, position: fixed) cerca de la tarima, con
  // su tamaño real ya medido, evitando salirse de la pantalla — mismo
  // patrón que el menú "..." del historial.
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      setTooltipStyle(null);
      return;
    }
    const { offsetWidth: w, offsetHeight: h } = tooltipRef.current;
    const margin = 8;
    const { anchorRect: a } = tooltip;
    let left = a.left + a.width / 2 - w / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    let top = a.top - h - 8;
    if (top < margin) top = a.bottom + 8;
    setTooltipStyle({ top, left });
  }, [tooltip]);

  // Cierra el tooltip al tocar/hacer click fuera de cualquier tarima, o al
  // scrollear/cambiar tamaño de ventana.
  useEffect(() => {
    if (!tooltip) return;
    function handleOutside(e) {
      if (e.target.closest && e.target.closest('.box')) return;
      setTooltip(null);
    }
    function handleClose() {
      setTooltip(null);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('pointerdown', handleOutside, true);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [tooltip]);

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
            Arrastrá las tarimas con borde punteado para reordenarlas
          </span>
        )}
      </div>

      <SizeLegend />

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
                const isDropTarget =
                  drag &&
                  drag.moved &&
                  drag.preview?.mode === 'swap' &&
                  b.isDraft &&
                  b.draftIdx === drag.preview.targetIdx;
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
                    } ${isDragging ? 'box-dragging' : ''} ${
                      isDropTarget ? 'box-drop-target' : ''
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: b.color,
                      ...dragStyle,
                    }}
                    aria-label={`Orden ${displayOrderNumber(b.orderNumber)}, ${b.inches} pulgadas, ${b.meters} metros`}
                    onPointerDown={(e) => handlePointerDown(e, b)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onMouseEnter={(e) => {
                      if (drag) return;
                      showTooltipFor(b, e.currentTarget);
                    }}
                    onMouseLeave={() => setTooltip(null)}
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

              {insertPreview && draggedBox && (
                <div
                  className={`drop-placeholder ${
                    insertPreview.lane === 1 ? 'box-lane1' : 'box-lane2'
                  }`}
                  style={{
                    left: `${(insertPreview.atMeters / visualMax) * 100}%`,
                    width: `${(draggedBox.meters / visualMax) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )}

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

      {tooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <PalletTooltip
            box={tooltip.box}
            placed={placed}
            style={tooltipStyle}
            tooltipRef={tooltipRef}
          />,
          document.body
        )}
    </div>
  );
}
