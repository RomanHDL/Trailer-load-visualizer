// PDF profesional con visualización del trailer + datos de la orden.
// Page format Letter (216 x 279 mm).

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { packBoxes } from './packing';
import { formatLocalDate } from './dateFormat';
import {
  displayOrderNumber,
  displayOrderNumberShort,
  orderNumberToFilename,
} from './orderNumber';

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

// Dibuja el camión top-view (tractor + hitch + trailer con 2 carriles).
function drawTrailerVisual(doc, opts) {
  const {
    x, y, width, height,
    trailerLength,
    capacityLimit,
    allBoxes,
    highlightOrderNumber,
  } = opts;
  // `trailerLength` sigue siendo lo que se dibuja/imprime como el límite;
  // `capacityLimit` (puede ser mayor) es lo que realmente decide overflow.
  const effectiveLimit = capacityLimit ?? trailerLength;

  // Layout horizontal: tractor + hitch + trailer
  const tractorW = 14;
  const hitchW = 1.5;
  const trailerX = x + tractorW + hitchW;
  const trailerW = width - tractorW - hitchW;

  // Trailer interno: cab + body + doors
  const cabW = 7;
  const doorW = 8;
  const bodyX = trailerX + cabW;
  const bodyW = trailerW - cabW - doorW;
  const laneH = height / 2;

  // Pack
  const { placed, totalUsed } = packBoxes(allBoxes);
  const overflow = totalUsed > effectiveLimit;
  const visualMax = Math.max(trailerLength, totalUsed, 0.01);
  const trailerColor = overflow ? [220, 38, 38] : [34, 197, 94];

  // ===== TRACTOR (cabina del camión) =====
  // Capó (hood) — sale al frente
  doc.setFillColor(22, 101, 52);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y + 4, 3.5, height - 8, 1, 1, 'FD');

  // Cuerpo principal del tractor
  doc.setFillColor(34, 197, 94);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.roundedRect(x + 2.5, y + 1, tractorW - 2.5, height - 2, 1.8, 1.8, 'FD');

  // Parabrisas (windshield)
  doc.setFillColor(147, 197, 253);
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.25);
  doc.roundedRect(x + 5, y + 4, tractorW - 7, height - 8, 0.6, 0.6, 'FD');

  // Ruedas tractor (4 — front + rear, ambos lados)
  doc.setFillColor(20, 20, 30);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.roundedRect(x + 3.5, y - 1.5, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(x + 3.5, y + height, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(x + tractorW - 5, y - 1.5, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(x + tractorW - 5, y + height, 3, 1.5, 0.3, 0.3, 'FD');

  // ===== HITCH (enganche) =====
  doc.setFillColor(70, 80, 100);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.2);
  doc.rect(x + tractorW, y + height / 2 - 0.7, hitchW, 1.4, 'FD');

  // ===== TRAILER (carga) =====
  // Cab del trailer
  doc.setFillColor(220, 226, 240);
  doc.setDrawColor(...trailerColor);
  doc.setLineWidth(0.7);
  doc.rect(trailerX, y, cabW, height, 'FD');

  // Doors (puertas) con líneas verticales y manija
  doc.setFillColor(232, 236, 245);
  doc.setDrawColor(...trailerColor);
  doc.roundedRect(
    trailerX + trailerW - doorW,
    y,
    doorW,
    height,
    2,
    2,
    'FD'
  );
  doc.setDrawColor(160, 170, 188);
  doc.setLineWidth(0.18);
  for (let lx = 1.2; lx < doorW - 1; lx += 1.5) {
    doc.line(
      trailerX + trailerW - doorW + lx,
      y + 1.5,
      trailerX + trailerW - doorW + lx,
      y + height - 1.5
    );
  }
  // Manija
  doc.setFillColor(120, 130, 145);
  doc.setDrawColor(60, 70, 85);
  doc.setLineWidth(0.15);
  doc.rect(
    trailerX + trailerW - 1.6,
    y + height / 2 - 2.5,
    0.7,
    5,
    'FD'
  );

  // Body (cuerpo)
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(...trailerColor);
  doc.setLineWidth(0.8);
  doc.rect(bodyX, y, bodyW, height, 'FD');

  // Ruedas trailer (6 — eje delantero bajo cab + 2 ejes traseros)
  doc.setFillColor(20, 20, 30);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  // Eje delantero (justo después del cab)
  const wFront = trailerX + cabW + 1.5;
  doc.roundedRect(wFront, y - 1.5, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(wFront, y + height, 3, 1.5, 0.3, 0.3, 'FD');
  // Ejes traseros (cerca de las puertas)
  const wRear1 = trailerX + trailerW - doorW - 8.5;
  const wRear2 = trailerX + trailerW - doorW - 4.5;
  doc.roundedRect(wRear1, y - 1.5, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(wRear1, y + height, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(wRear2, y - 1.5, 3, 1.5, 0.3, 0.3, 'FD');
  doc.roundedRect(wRear2, y + height, 3, 1.5, 0.3, 0.3, 'FD');

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
    const exceedsLimit = b.end > effectiveLimit;

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

    // Marca de esquineros en las 4 esquinas físicas de la tarima
    const cornerBw = Math.max(bw - 0.4, 0.5);
    if (cornerBw > 2 && bh > 2) {
      const cs = Math.min(1.6, cornerBw / 3, bh / 3);
      const bxL = bx + 0.2;
      const bxR = bxL + cornerBw;
      const byT = by;
      const byB = by + bh;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.35);
      doc.line(bxL, byT + cs, bxL, byT);
      doc.line(bxL, byT, bxL + cs, byT);
      doc.line(bxR - cs, byT, bxR, byT);
      doc.line(bxR, byT, bxR, byT + cs);
      doc.line(bxL, byB - cs, bxL, byB);
      doc.line(bxL, byB, bxL + cs, byB);
      doc.line(bxR - cs, byB, bxR, byB);
      doc.line(bxR, byB, bxR, byB - cs);
    }

    // Etiqueta dentro si hay espacio
    doc.setTextColor(255, 255, 255);
    if (bw > 7) {
      doc.setFontSize(5);
      doc.text(displayOrderNumberShort(b.orderNumber), bx + bw / 2, by + bh / 2 - 0.3, {
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
  if (totalUsed > effectiveLimit) {
    labels.push({ pos: visualMax, text: `${totalUsed.toFixed(1)} m` });
  }
  labels.forEach((lb) => {
    const tx = bodyX + (lb.pos / visualMax) * bodyW;
    let align = 'center';
    if (lb.pos === 0) align = 'left';
    if (lb.pos >= visualMax - 0.5) align = 'right';
    doc.text(lb.text, tx, y + height + 4, { align });
  });

  // Captions CABINA / TRAILER FRENTE / PUERTAS
  doc.setFontSize(6.5);
  doc.setTextColor(80, 90, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('CABINA', x + tractorW / 2, y + height + 8.5, { align: 'center' });
  doc.text('FRENTE', trailerX + cabW / 2, y + height + 8.5, {
    align: 'center',
  });
  doc.text('PUERTAS', trailerX + trailerW - doorW / 2, y + height + 8.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');

  return { nextY: y + height + 12, totalUsed, overflow };
}

export async function generateOrderPdf({
  order,
  trailerLength,
  capacityLimit,
  allOrders,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;          // horizontal
  const topMargin = 7;         // muy corto arriba — todo pegado al borde
  const contentW = pageW - margin * 2;

  // ----- Logo top-LEFT (chico, pegado arriba) -----
  const logoMaxH = 13;
  try {
    const logo = await loadLogoAsPng('/mundial-logo.webp');
    const logoH = logoMaxH;
    const logoW = (logo.w / logo.h) * logoH;
    doc.addImage(logo.dataUrl, 'PNG', margin, topMargin, logoW, logoH);
  } catch (e) {
    /* sin logo */
  }

  // ----- Header DERECHA: TODO va a la derecha (título, subtítulo y datos) -----
  // El logo es lo único en la izquierda.
  const orderPacked = packBoxes(order.boxes);
  const orderTrailerMeters = orderPacked.totalUsed;

  const fecha = formatLocalDate(order.createdAt || Date.now(), {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const rightX = pageW - margin;

  // Título grande, alineado a la derecha (compacto, pegado arriba)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('ORDEN DE CARGA', rightX, topMargin + 5, { align: 'right' });

  // Subtítulo a la derecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 120, 140);
  doc.text('Trailer Load Visualizer - Mundial', rightX, topMargin + 9.5, {
    align: 'right',
  });

  // Filas label / valor (más compactas)
  const lineH = 5;
  const infoStartY = topMargin + 17;
  const valueX = rightX;
  const labelX = rightX - 55;

  const infoRows = [
    { label: 'NO. ORDEN', value: displayOrderNumber(order.orderNumber), big: true },
    { label: 'FECHA', value: fecha },
    { label: 'TARIMAS', value: String(order.boxes.length) },
    {
      label: 'OCUPA EN TRAILER',
      value: `${orderTrailerMeters.toFixed(2)} m`,
      highlight: true,
    },
  ];

  infoRows.forEach((r, i) => {
    const yLine = infoStartY + i * lineH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 140, 158);
    doc.text(r.label, labelX, yLine, { align: 'right' });
    doc.setFont('helvetica', r.big ? 'bold' : 'normal');
    doc.setFontSize(r.big ? 10 : 8.5);
    if (r.highlight) doc.setTextColor(22, 101, 52);
    else doc.setTextColor(15, 23, 42);
    doc.text(r.value, valueX, yLine, { align: 'right' });
  });

  // Separador
  const headerEndY = Math.max(
    topMargin + logoMaxH + 2,
    infoStartY + infoRows.length * lineH - 2
  );
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, headerEndY, pageW - margin, headerEndY);

  let y = headerEndY + 6;

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
    y: y + 6,
    width: contentW,
    height: 42,
    trailerLength,
    capacityLimit,
    allBoxes,
    highlightOrderNumber: order.orderNumber,
  });
  y = nextY;

  // Indicador "su orden" (footnote, chico)
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 145);
  doc.text(
    `Las tarimas de la orden ${displayOrderNumber(order.orderNumber)} estan marcadas con borde superior oscuro.`,
    margin,
    y
  );
  y += 10; // más aire entre footnote y título de tabla

  // ----- TABLA DE TARIMAS -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('DESGLOSE DE TARIMAS', margin, y);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.9);
  doc.line(margin, y + 1.4, margin + 40, y + 1.4);
  y += 5;

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
    head: [['Medida', 'Cantidad', 'Metros / unidad', 'Subtotal lineal']],
    body: rows,
    foot: [
      [
        {
          content: `${order.boxes.length} tarimas · OCUPA EN TRAILER`,
          colSpan: 3,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 },
        },
        {
          content: `${orderTrailerMeters.toFixed(2)} m`,
          styles: {
            fontStyle: 'bold',
            fontSize: 10,
            textColor: 255,
            fillColor: [22, 101, 52],
          },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      lineColor: [200, 210, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      halign: 'center',
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
    },
    footStyles: {
      fillColor: [240, 253, 244],
      textColor: [22, 101, 52],
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: {
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 10,
        textColor: [15, 23, 42],
      },
      1: { fontSize: 10, fontStyle: 'bold' },
      3: { fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 12; // más aire antes del resumen

  // ----- Resumen del trailer (capacidad real con 2 carriles) -----
  const totalLinear = allBoxes.reduce((s, b) => s + b.meters, 0);
  const remaining = (capacityLimit ?? trailerLength) - totalUsed;
  const totalTarimas = allBoxes.length;

  // Recuadro de resumen — más compacto
  const sumW = contentW;
  const sumH = 24;
  const sumColor = overflow ? [254, 226, 226] : [220, 252, 231];
  const sumBorder = overflow ? [220, 38, 38] : [22, 163, 74];

  doc.setFillColor(...sumColor);
  doc.setDrawColor(...sumBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, sumW, sumH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...sumBorder);
  doc.text(
    overflow ? 'NO CABE EN EL TRAILER' : 'CABE EN EL TRAILER',
    margin + 4,
    y + 5.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 70, 85);

  const col1 = margin + 4;
  const col2 = margin + 70;
  const col3 = margin + 130;

  // Fila datos en una sola línea (compacto)
  let yy = y + 11;
  doc.text('Largo trailer:', col1, yy);
  doc.text('Largo usado (real):', col2, yy);
  doc.text(overflow ? 'Sobrepasa por:' : 'Espacio restante:', col3, yy);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${trailerLength.toFixed(2)} m`, col1, yy + 4.5);
  doc.text(`${totalUsed.toFixed(2)} m`, col2, yy + 4.5);
  doc.setTextColor(...sumBorder);
  doc.text(`${Math.abs(remaining).toFixed(2)} m`, col3, yy + 4.5);

  // Info adicional en una línea chica al final
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(110, 120, 135);
  doc.text(
    `Total tarimas en trailer: ${totalTarimas}  ·  Cargadas en 2 carriles paralelos`,
    col1,
    y + sumH - 2
  );

  y += sumH + 6;

  // ----- Footer -----
  doc.setDrawColor(220, 226, 236);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 20, pageW - margin, pageH - 20);

  doc.setFontSize(7);
  doc.setTextColor(140, 150, 165);
  doc.text('Documento generado automáticamente · Mundial', margin, pageH - 14);
  doc.text(`Orden ${displayOrderNumber(order.orderNumber)}`, pageW / 2, pageH - 14, {
    align: 'center',
  });
  doc.text('Página 1 / 1', pageW - margin, pageH - 14, { align: 'right' });

  doc.save(`orden-${orderNumberToFilename(order.orderNumber)}.pdf`);
}
