import { useState } from 'react';
import { SIZE_OPTIONS } from '../data/sizeTable';

export default function OrderForm({ onAdd, disabled }) {
  const [orderNumber, setOrderNumber] = useState('');
  const [inches, setInches] = useState(SIZE_OPTIONS[0].inches);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    setSubmitting(true);
    try {
      await onAdd({ orderNumber: orderNumber.trim(), inches: Number(inches) });
      setOrderNumber('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label>Número de orden</label>
        <input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Ej. 12345"
          required
        />
      </div>

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

      <button type="submit" disabled={disabled || submitting}>
        {submitting ? 'Agregando…' : 'Agregar al trailer'}
      </button>
    </form>
  );
}
