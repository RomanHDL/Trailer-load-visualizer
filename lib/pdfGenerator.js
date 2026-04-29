// PDF profesional con visualización del trailer + datos de la orden.
// Page format Letter (216 x 279 mm).

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { packBoxes } from './packing';

const ORDER_COLORS = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#84cc16', '#14b8a6', '#a855f7',
  '#0ea5e9', '#f43f5e',
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substr(0, 2), 16),
    parseInt(h.substr(2, 2), 16),
    parseInt(h.substr(4, 2), 16),
  ];
}

async function loadLogoAsPng(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          w: img.width,
          h: img.height,
        });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Dibuja el trailer top-view con las cajas posicionadas (2 carriles).
function drawTrailerVisual(doc, opts) {
  const {
    x, y, width, height,
    trailerLength,
    allBoxes,
    highlightOrderNumber,
  } = opts;

  const cabW = 11;
  const doorW = 11;
  const bodyX = x + cabW;
  const bodyW = width - cabW - doorW;
  const laneH = height / 2;

  // Pack
  const { placed, totalUsed } = packBoxes(allBoxes);
  const overflow = totalUsed > trailerLength;
  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const trailerColor = overflow ? [220, 38, 38] : [34, 197, 94];

  // Cab (frente) — esquinas redondeadas izquierdas (sin texto interno)
  doc.setFillColor(220, 226, 240);
  doc.setDrawColor(...trailerColor);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, cabW, height, 3, 3, 'FD');

  // Doors (puertas) — patrón visual de líneas verticales para distinguir
  doc.setFillColor(232, 236, 245);
  doc.setDrawColor(...trailerColor);
  doc.roundedRect(x + width - doorW, y, doorW, height, 3, 3, 'FD');
  // Líneas verticales en las puertas (visualmente distintivo)
  doc.setDrawColor(180, 188, 200);
  doc.setLineWidth(0.2);
  for (let lx = 1.8; lx < doorW - 1; lx += 2.2) {
    doc.line(
      x + width - doorW + lx,
      y + 2,
      x + width - doorW + lx,
      y + height - 2
    );
  }

  // Body (cuerpo)
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(...trailerColor);
  doc.setLineWidth(0.8);
  doc.rect(bodyX, y, bodyW, height, 'FD');

  // Línea divisoria de carriles (punteada)
  doc.setDrawColor(180, 188, 200);
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.setLineWidth(0.25);
  doc.line(bodyX, y + laneH, bodyX + bodyW, y + laneH);
  doc.setLineDashPattern([], 0);

  // Zona de overflow (rayas rojas translúcidas)
  if (overflow) {
    const limitX = bodyX + (trailerLength / visualMax) * bodyW;
    const overW = bodyX + bodyW - limitX;
    doc.setFillColor(254, 226, 226);
    doc.rect(limitX, y, overW, height, 'F');
    // Rayas diagonales encima
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.15);
    for (let i = -overW; i < overW; i += 1.8) {
      doc.line(limitX + i, y, limitX + i + height, y + height);
    }
  }

  // Cajas
  placed.forEach((b) => {
    const bx = bodyX + (b.start / visualMax) * bodyW;
    const bw = (b.meters / visualMax) * bodyW;
    const exceedsLimit = b.end > trailerLength;

    let by, bh;
    if (b.full) {
      by = y + 0.6;
      bh = height - 1.2;
    } else if (b.lane === 1) {
      by = y + 0.6;
      bh = laneH - 1.0;
    } else {
      by = y + laneH + 0.4;
      bh = laneH - 1.0;
    }

    const [r, g, blu] = exceedsLimit
      ? [220, 38, 38]
      : hexToRgb(b.color);
    doc.setFillColor(r, g, blu);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.roundedRect(
      bx + 0.2,
      by,
      Math.max(bw - 0.4, 0.5),
      bh,
      0.4,
      0.4,
      'FD'
    );

    // Marca para la orden actual (borde grueso oscuro arriba)
    if (highlightOrderNumber && b.orderNumber === highlightOrderNumber) {
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(bx + 0.4, by + 0.2, bx + bw - 0.4, by + 0.2);
    }

    // Etiqueta dentro si hay espacio
    doc.setTextColor(255, 255, 255);
    if (bw > 7) {
      doc.setFontSize(5);
      doc.text(b.orderNumber, bx + bw / 2, by + bh / 2 - 0.3, {
        align: 'center',
        baseline: 'middle',
      });
      doc.setFontSize(4.5);
      doc.text(`${b.inches}"`, bx + bw / 2, by + bh / 2 + 2.4, {
        align: 'center',
        baseline: 'middle',
      });
    } else if (bw > 3.5) {
      doc.setFontSize(4.5);
      doc.text(`${b.inches}"`, bx + bw / 2, by + bh / 2, {
        align: 'center',
        baseline: 'middle',
      });
    }
  });

  // Marca de LÍMITE (línea + etiqueta)
  const limitX = bodyX + (trailerLength / visualMax) * bodyW;
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.line(limitX, y - 4, limitX, y + height + 4);

  // Etiqueta del límite
  doc.setFillColor(245, 158, 11);
  const tagW = 22;
  const tagH = 4;
  let tagX = limitX - tagW / 2;
  if (tagX + tagW > x + width) tagX = limitX - tagW;
  if (tagX < x) tagX = limitX;
  doc.roundedRect(tagX, y - 5.5, tagW, tagH, 0.8, 0.8, 'F');
  doc.setFontSize(5);
  doc.setTextColor(20, 20, 20);
  doc.text(`LIMITE ${trailerLength}m`, tagX + tagW / 2, y - 2.7, {
    align: 'center',
    baseline: 'middle',
  });

  // Escala bajo el trailer — solo etiquetas espaciadas, sin tick lines
  doc.setFontSize(6);
  doc.setTextColor(100, 110, 125);
  doc.setFont('helvetica', 'normal');
  const labels = [];
  labels.push({ pos: 0, text: '0 m' });
  const midM = Math.round(trailerLength / 2);
  labels.push({ pos: midM, text: `${midM} m` });
  labels.push({ pos: trailerLength, text: `${trailerLength} m (limite)` });
  if (totalUsed > trailerLength) {
    labels.push({ pos: visualMax, text: `${totalUsed.toFixed(1)} m` });
  }
  labels.forEach((lb) => {
    const tx = bodyX + (lb.pos / visualMax) * bodyW;
    let align = 'center';
    if (lb.pos === 0) align = 'left';
    if (lb.pos >= visualMax - 0.5) align = 'right';
    doc.text(lb.text, tx, y + height + 4, { align });
  });

  // Captions FRENTE / PUERTAS — texto plano, sin caracteres unicode
  doc.setFontSize(7);
  doc.setTextColor(80, 90, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('FRENTE', x + cabW / 2, y + height + 8.5, { align: 'center' });
  doc.text('PUERTAS', x + width - doorW / 2, y + height + 8.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');

  return { nextY: y + height + 12, totalUsed, overflow };
}

export async function generateOrderPdf({ order, trailerLength, allOrders }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  // ----- Logo top-right -----
  try {
    const logo = await loadLogoAsPng('/mundial-logo.webp');
    const logoH = 16;
    const logoW = (logo.w / logo.h) * logoH;
    doc.addImage(
      logo.dataUrl,
      'PNG',
      pageW - margin - logoW,
      margin,
      logoW,
      logoH
    );
  } catch (e) {
    /* sin logo */
  }

  // ----- Header -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('ORDEN DE CARGA', margin, margin + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 130);
  doc.text('Trailer Load Visualizer · Mundial', margin, margin + 12);

  // Línea separadora gruesa
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.7);
  doc.line(margin, margin + 19, pageW - margin, margin + 19);

  // ----- Datos de la orden -----
  let y = margin + 27;
  const fecha = new Date(order.createdAt || Date.now()).toLocaleString(
    'es-MX',
    { dateStyle: 'long', timeStyle: 'short' }
  );

  // Caja con datos en grid 2x2
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y - 4, contentW, 18, 1.5, 1.5, 'FD');

  // El espacio REAL que esta orden ocupa en el trailer (con packing 2 carriles)
  // — NO la suma lineal, que confunde porque duplica el largo.
  const orderPacked = packBoxes(order.boxes);
  const orderTrailerMeters = orderPacked.totalUsed;

  doc.setFontSize(7);
  doc.setTextColor(120, 130, 145);
  doc.setFont('helvetica', 'bold');
  doc.text('NO. ORDEN', margin + 4, y);
  doc.text('FECHA', margin + 60, y);
  doc.text('TARIMAS', margin + 110, y);
  doc.text('OCUPA EN TRAILER', margin + 140, y);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.orderNumber), margin + 4, y + 6);
  doc.setFontSize(9);
  doc.text(fecha, margin + 60, y + 6);
  doc.setFontSize(13);
  doc.text(String(order.boxes.length), margin + 110, y + 6);
  doc.text(`${orderTrailerMeters.toFixed(2)} m`, margin + 140, y + 6);

  doc.setFont('helvetica', 'normal');
  y += 22;

  // ----- Visualización del trailer -----
  const allBoxes = [];
  (allOrders || []).forEach((o) =>
    o.boxes.forEach((b) => allBoxes.push({ ...b, orderNumber: o.orderNumber }))
  );
  // Asignar color por orden basado en el índice
  const orderColors = {};
  (allOrders || []).forEach((o, i) => {
    orderColors[o.orderNumber] = ORDER_COLORS[i % ORDER_COLORS.length];
  });
  allBoxes.forEach((b) => {
    b.color = orderColors[b.orderNumber] || ORDER_COLORS[0];
  });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Vista superior del trailer', margin, y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 120, 135);
  doc.text(
    '2 carriles · cada tarima ocupa medio carril',
    margin,
    y + 4
  );
  y += 9;

  const { nextY, totalUsed, overflow } = drawTrailerVisual(doc, {
    x: margin,
    y: y + 5,
    width: contentW,
    height: 36,
    trailerLength,
    allBoxes,
    highlightOrderNumber: order.orderNumber,
  });
  y = nextY;

  // Indicador de "su orden" (footnote)
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 145);
  doc.text(
    `Las tarimas de la orden ${order.orderNumber} estan marcadas con borde superior oscuro.`,
    margin,
    y
  );
  y += 6;

  // ----- Tabla de tarimas de esta orden -----
  const counts = {};
  order.boxes.forEach((b) => {
    const k = b.inches;
    if (!counts[k]) counts[k] = { inches: b.inches, qty: 0, meters: b.meters };
    counts[k].qty += 1;
  });

  const rows = Object.values(counts)
    .sort((a, b) => a.inches - b.inches)
    .map((c) => [
      `${c.inches}"`,
      String(c.qty),
      `${c.meters.toFixed(2)} m`,
      `${(c.qty * c.meters).toFixed(2)} m`,
    ]);

  autoTable(doc, {
    startY: y,
    head: [['Medida', 'Cantidad', 'Metros / unidad', 'Subtotal']],
    body: rows,
    foot: [
      [
        {
          content: `${order.boxes.length} tarimas · OCUPA EN TRAILER`,
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: `${orderTrailerMeters.toFixed(2)} m`,
          styles: { fontStyle: 'bold', textColor: [22, 101, 52] },
        },
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      halign: 'center',
      fontSize: 9,
    },
    footStyles: { fillColor: [241, 245, 249], textColor: 30, fontSize: 9 },
    bodyStyles: { halign: 'center', fontSize: 9 },
    columnStyles: { 0: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ----- Resumen del trailer (capacidad real con 2 carriles) -----
  const totalLinear = allBoxes.reduce((s, b) => s + b.meters, 0);
  const remaining = trailerLength - totalUsed;
  const totalTarimas = allBoxes.length;

  // Recuadro de resumen con colores
  const sumW = contentW;
  const sumH = 30;
  const sumColor = overflow ? [254, 226, 226] : [220, 252, 231];
  const sumBorder = overflow ? [220, 38, 38] : [22, 163, 74];

  doc.setFillColor(...sumColor);
  doc.setDrawColor(...sumBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, sumW, sumH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...sumBorder);
  doc.text(
    overflow ? 'NO CABE EN EL TRAILER' : 'CABE EN EL TRAILER',
    margin + 4,
    y + 6
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);

  const col1 = margin + 4;
  const col2 = margin + 70;
  const col3 = margin + 130;

  // Fila 1
  let yy = y + 13;
  doc.text('Largo trailer:', col1, yy);
  doc.text('Largo usado (real):', col2, yy);
  doc.text(overflow ? 'Sobrepasa por:' : 'Espacio restante:', col3, yy);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${trailerLength.toFixed(2)} m`, col1, yy + 5);
  doc.text(`${totalUsed.toFixed(2)} m`, col2, yy + 5);
  doc.setTextColor(...sumBorder);
  doc.text(`${Math.abs(remaining).toFixed(2)} m`, col3, yy + 5);

  // Fila 2 (info adicional)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 120, 135);
  doc.text(
    `Total tarimas en trailer: ${totalTarimas}  (cargadas en 2 carriles paralelos)`,
    col1,
    y + sumH - 3
  );

  y += sumH + 6;

  // ----- Footer -----
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 20, pageW - margin, pageH - 20);

  doc.setFontSize(7);
  doc.setTextColor(140, 150, 165);
  doc.text('Documento generado automáticamente · Mundial', margin, pageH - 14);
  doc.text(`Orden ${order.orderNumber}`, pageW / 2, pageH - 14, {
    align: 'center',
  });
  doc.text('Página 1 / 1', pageW - margin, pageH - 14, { align: 'right' });

  doc.save(`orden-${order.orderNumber}.pdf`);
}
