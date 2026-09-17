// Navegador de periodo compartido por los modos Día y Semana del Historial:
// [ ← ]  texto central  [ → ]. Las columnas de las flechas tienen ancho fijo
// (grid), así que su posición nunca depende de cuánto mida el texto central.
export default function PeriodNavigator({
  label,
  onPrev,
  onNext,
  nextDisabled,
  prevLabel,
  nextLabel,
}) {
  return (
    <div className="period-nav">
      <button
        type="button"
        className="period-nav-arrow"
        onClick={onPrev}
        aria-label={prevLabel}
      >
        ‹
      </button>
      <div className="period-nav-label">{label}</div>
      <button
        type="button"
        className="period-nav-arrow"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        ›
      </button>
    </div>
  );
}
