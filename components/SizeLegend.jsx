import { SIZE_COLOR_LEGEND } from '../data/sizeColors';

// Leyenda discreta del color asignado a cada medida. Pensada para ir junto
// al trailer, donde las tarimas ya usan estos mismos colores de fondo.
export default function SizeLegend() {
  return (
    <div className="size-legend" aria-label="Leyenda de colores por medida">
      {SIZE_COLOR_LEGEND.map((s) => (
        <span className="size-legend-item" key={s.inches}>
          <span
            className="size-legend-swatch"
            style={{ background: s.bg }}
            aria-hidden="true"
          />
          {s.inches}"
        </span>
      ))}
    </div>
  );
}
