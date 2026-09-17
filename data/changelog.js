// Historial de versiones de la app. La entrada [0] es siempre la versión
// actual (se muestra en el modal de "Historial de actualizaciones" y se usa
// para saber si ya se le mostró al usuario el aviso de la última versión).
export const CHANGELOG = [
  {
    version: '1.4.0',
    date: '2026-09-17',
    title: 'Historial más espacioso, colores por medida y drag & drop preciso',
    changes: [
      'Historial de órdenes: modal más ancho y con más espacio en la fila de acciones; el menú "···" ahora se abre siempre visible y completo, sin recortarse.',
      'Cada medida (50", 55", 58", 65", 75", 86", 100") tiene su propio color, con una leyenda discreta junto al camión. Se ve en las tarimas del trailer, en los chips de la orden activa y en el historial.',
      'Drag & drop del trailer corregido: al arrastrar una tarima ahora se ve en vivo dónde va a quedar, y se puede soltar sobre otra para intercambiarlas exactamente.',
      'Al abrir "Actualizaciones" (y otros cuadros emergentes), la página de fondo ya no se mueve — el scroll queda contenido dentro del cuadro.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-15',
    title: 'Modo claro/oscuro + aviso de novedades simplificado',
    changes: [
      'Nuevo botón en la barra superior para alternar entre tema oscuro y tema claro, con ícono de sol/luna. La preferencia se recuerda entre visitas.',
      'Todos los colores de la app (superficies, texto, tarjetas, modales) ahora se adaptan al tema elegido; la ilustración del camión y los colores de marca se mantienen iguales en ambos temas.',
      'El aviso automático de "hay una actualización nueva" ahora muestra solo los cambios de la versión más reciente, en vez de abrir todo el historial. Desde ahí se puede entrar al historial completo si se quiere ver más.',
      'El botón "Actualizaciones" del topbar sigue mostrando el historial completo de versiones, sin cambios.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-15',
    title: 'Historial de órdenes rediseñado, día por día',
    changes: [
      'El historial ahora se navega un día a la vez: abre siempre en HOY y muestra solo las órdenes de ese día.',
      'Nuevo navegador de fechas (Hoy, Ayer, días anteriores y calendario) para moverte entre días sin recargar la página — no deja elegir fechas futuras.',
      'Card de resumen del día con órdenes, tarimas y metros lineales totales.',
      'Filas de orden más compactas, con chips de medidas y hora en vez de fecha completa.',
      'Los filtros Todas/Activas/Archivadas, el PDF y Eliminar siguen funcionando igual que antes, ahora combinados con el día seleccionado.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-15',
    title: 'Esquineros + control de límite del trailer',
    changes: [
      'Se agregó +1 cm de margen por lado (esquineros de flejado) a la medida de cada tarima — el cm de margen que ya traía la medida no alcanzaba a cubrirlos.',
      'Cada tarima ahora muestra marcas en sus 4 esquinas identificando los esquineros, tanto en la vista web como en el PDF.',
      'El contador de metros de la orden activa ahora refleja el espacio real que ocupa en el trailer (2 carriles en paralelo), no la suma de todas las tarimas en línea.',
      'Se renombró "cajas" a "pallets" en la orden activa.',
      'Ya no se pueden agregar pallets que no quepan: aparece un aviso detallado con el espacio disponible y qué medidas y cantidades sí caben todavía.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-15',
    title: 'Versión base',
    changes: [
      'Simulador de carga del trailer en 2 carriles paralelos con las medidas estándar de tarimas.',
      'Órdenes con múltiples medidas, historial de órdenes y generación de PDF.',
      'Diseño responsive y persistencia del borrador en curso.',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
export const PREVIOUS_VERSION = CHANGELOG[1]?.version ?? null;
