import { useState } from 'react';
import { SIZE_OPTIONS } from '../data/sizeTable';

// Maneja el "draft" de una orden: el # orden se queda fijo mientras
// el usuario agrega cajas. Al final dispara onSave para persistir + PDF.

export default function OrderForm({
  draft,
  onStart,
  onAddBox,
  onRemoveBox,
  onSave,
  onCancel,
  saving,
}) {
  const [orderNumber, setOrderNumber] = useState('');
  const [inches, setInches] = useState(SIZE_OPTIONS[0].inches);

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
        <button type="submit" className="btn-primary">
          Iniciar orden →
        </button>
      </form>
    );
  }

  // Estado B: orden activa, agregando cajas
  const totalMeters = draft.boxes.reduce((s, b) => s + b.meters, 0);

  return (
    <div className="form-active">
      <div className="active-header">
        <div>
          <span className="label-mini">Orden activa</span>
          <h2>#{draft.orderNumber}</h2>
        </div>
        <div className="active-stats">
          <span className="badge">{draft.boxes.length} cajas</span>
          <span className="badge badge-primary">
            {totalMeters.toFixed(2)} m
          </span>
        </div>
      </div>

      <form
        className="form form-add"
        onSubmit={(e) => {
          e.preventDefault();
          onAddBox(Number(inches));
        }}
      >
        <div className="field">
          <label>Agregar caja</label>
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
        <button type="submit" className="btn-primary">
          + Agregar
        </button>
      </form>

      {draft.boxes.length > 0 && (
        <div className="boxes-chips">
          {draft.boxes.map((b, i) => (
            <span key={i} className="chip">
              {b.inches}"
              <button
                type="button"
                onClick={() => onRemoveBox(i)}
                aria-label="quitar"
              >
                ×
              </button>
            </span>
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
