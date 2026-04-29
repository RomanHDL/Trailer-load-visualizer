// Genera un PDF profesional con la orden + boxes para entregar a stakeholders.
// jsPDF no soporta WebP directamente: cargo el logo en un <img>, lo dibujo
// en un <canvas> y exporto a PNG base64 para embeberlo en el PDF.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { packBoxes } from './packing';

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

export async function generateOrderPdf({ order, trailerLength, allOrders }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ----- Logo (top right) -----
  try {
    const logo = await loadLogoAsPng('/mundial-logo.webp');
    const logoH = 18;
    const logoW = (logo.w / logo.h) * logoH;
    doc.addImage(logo.dataUrl, 'PNG', pageW - margin - logoW, margin, logoW, logoH);
  } catch (e) {
    // si falla la carga, seguimos sin logo
  }

  // ----- Header -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 30, 50);
  doc.text('Orden de Carga', margin, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text('Trailer Load Visualizer · Mundial', margin, margin + 14);

  // Línea separadora
  doc.setDrawColor(20, 30, 50);
  doc.setLineWidth(0.5);
  doc.line(margin, margin + 22, pageW - margin, margin + 22);

  // ----- Datos de la orden -----
  let y = margin + 32;
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);

  const fecha = new Date(order.createdAt || Date.now()).toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  doc.setFont('helvetica', 'bold');
  doc.text('No. Orden:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(order.orderNumber), margin + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', pageW / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fecha, pageW / 2 + 18, y);

  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Total cajas:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(order.boxes.length), margin + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Metros usados:', pageW / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${order.totalMeters.toFixed(2)} m`, pageW / 2 + 28, y);

  y += 12;

  // ----- Tabla de cajas -----
  const counts = {};
  order.boxes.forEach((b) => {
    const k = `${b.inches}"`;
    if (!counts[k]) counts[k] = { inches: b.inches, qty: 0, meters: b.meters };
    counts[k].qty += 1;
  });

  const rows = Object.values(counts)
    .sort((a, b) => a.inches - b.inches)
    .map((c) => [
      `${c.inches}"`,
      c.qty,
      `${c.meters.toFixed(2)} m`,
      `${(c.qty * c.meters).toFixed(2)} m`,
    ]);

  autoTable(doc, {
    startY: y,
    head: [['Medida', 'Cantidad', 'Metros / unidad', 'Subtotal']],
    body: rows,
    foot: [
      [
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `${order.totalMeters.toFixed(2)} m`, styles: { fontStyle: 'bold' } },
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [20, 30, 50], textColor: 255, halign: 'center' },
    footStyles: { fillColor: [240, 240, 245], textColor: 30 },
    bodyStyles: { halign: 'center' },
    columnStyles: { 0: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 14;

  // ----- Resumen del trailer (con packing 2-carriles) -----
  const allBoxes = [];
  (allOrders || []).forEach((o) => o.boxes.forEach((b) => allBoxes.push(b)));
  const { totalUsed: totalAll, totalLinear } = packBoxes(allBoxes);
  const remaining = trailerLength - totalAll;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 30, 50);
  doc.text('Resumen del Trailer', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(`Largo total disponible: ${trailerLength.toFixed(2)} m`, margin, y);
  y += 5;
  doc.text(
    `Metros lineales de cajas: ${totalLinear.toFixed(2)} m`,
    margin,
    y
  );
  y += 5;
  doc.text(
    `Largo ocupado en trailer (2 carriles): ${totalAll.toFixed(2)} m`,
    margin,
    y
  );
  y += 5;

  if (remaining >= 0) {
    doc.setTextColor(34, 134, 58);
    doc.text(`Espacio restante: ${remaining.toFixed(2)} m  ✓ Cabe`, margin, y);
  } else {
    doc.setTextColor(190, 30, 30);
    doc.text(
      `Sobrepasa por: ${Math.abs(remaining).toFixed(2)} m  ✗ NO CABE`,
      margin,
      y
    );
  }

  // ----- Footer -----
  doc.setDrawColor(200, 200, 210);
  doc.line(margin, pageH - 20, pageW - margin, pageH - 20);
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'Documento generado automáticamente · Mundial',
    margin,
    pageH - 14
  );
  doc.text(
    `Página 1 / 1`,
    pageW - margin,
    pageH - 14,
    { align: 'right' }
  );

  doc.save(`orden-${order.orderNumber}.pdf`);
}
