import { useState } from 'react';
import { SIZE_OPTIONS, SIZE_TABLE } from '../data/sizeTable';

// Maneja el draft de una orden: el # orden se queda fijo mientras el usuario
// agrega cajas. Permite agregar N cajas a la vez (cantidad).

export default function OrderForm({
  draft,
  onStart,
  onAddBoxes,
  onRemoveBoxOfSize,
  onSave,
  onCancel,
  saving,
}) {
  const [orderNumber, setOrderNumber] = useState('');
  const [inches, setInches] = useState(SIZE_OPTIONS[0].inches);
  const [qty, setQty] = useState(1);

  // Estado A: aún no se ingresó el # orden
  if (!draft) {
    return (
      <form
        className="form form-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!orderNumber.trim()) return;
          onStart(orderNumber.trim());
          setOrderNumber('');
        }}
      >
        <div className="field">
          <label>Número de orden</label>
          <input
            type="text"
            inputMode="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Ej. 12345"
            autoFocus
            required
          />
        </div>
        <button type="submit" className="btn-primary btn-block">
          Iniciar orden →
        </button>
      </form>
    );
  }

  // Estado B: orden activa
  const totalMeters = draft.boxes.reduce((s, b) => s + b.meters, 0);

  // Agrupa cajas por medida para mostrar chips compactos
  const groups = {};
  draft.boxes.forEach((b) => {
    if (!groups[b.inches]) {
      groups[b.inches] = { inches: b.inches, meters: b.meters, qty: 0 };
    }
    groups[b.inches].qty += 1;
  });
  const grouped = Object.values(groups).sort((a, b) => a.inches - b.inches);

  function clampQty(n) {
    const v = Math.max(1, Math.min(200, Math.floor(Number(n) || 1)));
    return v;
  }

  return (
    <div className="form-active">
      <div className="active-header">
        <div className="active-id">
          <span className="label-mini">Orden activa</span>
          <h2>#{draft.orderNumber}</h2>
        </div>
        <div className="active-stats">
          <div className="stat-tile">
            <span className="stat-num">{draft.boxes.length}</span>
            <span className="stat-lbl">cajas</span>
          </div>
          <div className="stat-tile stat-tile-primary">
            <span className="stat-num">{totalMeters.toFixed(2)}</span>
            <span className="stat-lbl">metros</span>
          </div>
        </div>
      </div>

      <form
        className="form form-add"
        onSubmit={(e) => {
          e.preventDefault();
          const n = clampQty(qty);
          onAddBoxes(Number(inches), n);
          setQty(1);
        }}
      >
        <div className="field">
          <label>Medida</label>
          <select
            value={inches}
            onChange={(e) => setInches(Number(e.target.value))}
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.inches} value={o.inches}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-qty">
          <label>Cantidad</label>
          <div className="qty-stepper">
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQty((q) => clampQty(q - 1))}
              aria-label="Restar"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={qty}
              min="1"
              max="200"
              onChange={(e) => setQty(clampQty(e.target.value))}
            />
            <button
              type="button"
              className="qty-btn"
              onClick={() => setQty((q) => clampQty(q + 1))}
              aria-label="Sumar"
            >
              +
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary btn-block">
          + Agregar {qty > 1 ? `${qty} cajas` : 'caja'}
          <span className="btn-sub">
            ({(qty * SIZE_TABLE[inches]).toFixed(2)} m)
          </span>
        </button>
      </form>

      {grouped.length > 0 && (
        <div className="boxes-chips">
          {grouped.map((g) => (
            <div key={g.inches} className="chip-group">
              <button
                type="button"
                className="chip-btn chip-btn-minus"
                onClick={() => onRemoveBoxOfSize(g.inches)}
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="chip-label">
                <strong>{g.qty}</strong>× {g.inches}"
              </span>
              <button
                type="button"
                className="chip-btn chip-btn-plus"
                onClick={() => onAddBoxes(g.inches, 1)}
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className="btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-success"
          onClick={onSave}
          disabled={saving || draft.boxes.length === 0}
        >
          {saving ? 'Guardando…' : 'Guardar y generar PDF'}
        </button>
      </div>
    </div>
  );
}
