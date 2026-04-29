// Vista superior del trailer (estilo blueprint)
// El trailer se renderiza horizontal. Las cajas se acomodan en línea de izquierda a derecha.
// Si la suma de cajas excede el largo total, se marcan en rojo.

const COLORS = [
  '#2563eb', '#0891b2', '#7c3aed', '#db2777',
  '#ea580c', '#65a30d', '#0d9488', '#9333ea',
];

export default function TrailerView({ orders, trailerLength }) {
  const totalUsed = orders.reduce((s, o) => s + o.meters, 0);
  const overflow = totalUsed > trailerLength;
  const remaining = trailerLength - totalUsed;

  // Cada caja recibe su offset acumulado en metros
  let cursor = 0;
  const boxes = orders.map((o, i) => {
    const start = cursor;
    cursor += o.meters;
    const exceedsLimit = start + o.meters > trailerLength;
    return {
      ...o,
      start,
      end: cursor,
      color: exceedsLimit ? '#dc2626' : COLORS[i % COLORS.length],
      exceedsLimit,
    };
  });

  // Escala visual: el trailer ocupa 100% del ancho del contenedor.
  // Si hay overflow, el contenedor se extiende para mostrar lo que sobresale.
  const visualMax = Math.max(trailerLength, totalUsed);

  return (
    <div className="trailer-wrap">
      <div className="trailer-stats">
        <span>
          Usado: <strong>{totalUsed.toFixed(2)} m</strong> /{' '}
          {trailerLength.toFixed(2)} m
        </span>
        <span className={overflow ? 'pill pill-red' : 'pill pill-green'}>
          {overflow
            ? `Sobresale ${(totalUsed - trailerLength).toFixed(2)} m`
            : `Sobra ${remaining.toFixed(2)} m`}
        </span>
      </div>

      <div className="trailer-scroll">
        <div
          className={`trailer ${overflow ? 'overflow' : 'ok'}`}
          style={{
            // El ancho se basa en el máximo entre trailer y carga real
            width: `${(visualMax / trailerLength) * 100}%`,
            minWidth: '100%',
          }}
        >
          {/* Marca del límite del trailer */}
          <div
            className="trailer-limit"
            style={{ left: `${(trailerLength / visualMax) * 100}%` }}
            title="Límite del trailer"
          />

          {/* Líneas guía cada metro */}
          {Array.from({ length: Math.ceil(visualMax) }).map((_, i) => (
            <div
              key={i}
              className="trailer-tick"
              style={{ left: `${((i + 1) / visualMax) * 100}%` }}
            >
              <span>{i + 1}m</span>
            </div>
          ))}

          {/* Cajas */}
          {boxes.map((b) => (
            <div
              key={b._id}
              className="box animate-in"
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
        </div>
      </div>
    </div>
  );
}
