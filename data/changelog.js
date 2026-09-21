// Historial de versiones de la app. La entrada [0] es siempre la versión
// actual (se muestra en el modal de "Historial de actualizaciones" y se usa
// para saber si ya se le mostró al usuario el aviso de la última versión).
export const CHANGELOG = [
  {
    version: '1.11.0',
    date: '2026-09-21',
    title: 'Pulido visual: menos ruido, el camión aparece antes',
    changes: [
      'Se redujo bastante el espacio muerto entre la leyenda y el camión — el simulador aparece mucho más pronto en pantalla, sin scroll de más.',
      'El contador junto a "Vista superior del camión" ahora muestra pallets cargados reales (ej. "14 pallets cargados") en vez de la cantidad de órdenes, con un pequeño ícono de camión al lado del título.',
      'El estado de trailer vacío ahora tiene un mensaje más claro en dos líneas ("Trailer vacío" + una línea de ayuda), y se quitó el aviso duplicado que aparecía debajo del simulador.',
      'El botón "Guardar y generar PDF" tiene un pequeño ícono de documento. Las esquinas de las tarjetas son un poco más redondeadas.',
      'Es un ajuste puramente visual: el algoritmo de acomodo, el cálculo de metros/porcentaje, el modo Intercalado, el aprovechamiento de huecos, el límite de 15.9 m, el guardado y el PDF siguen funcionando exactamente igual.',
    ],
  },
  {
    version: '1.10.2',
    date: '2026-09-21',
    title: 'Intercalado aprovecha huecos reales antes de seguir su turno',
    changes: [
      'En el modo "Intercalado", antes de colocar una tarima en el carril que le toca por turno, ahora se revisa si ya existe un hueco real (el espacio que le queda a cualquiera de los 2 carriles) donde esa tarima quepa mejor — si cabe en uno o los dos, se usa el hueco más ajustado (best fit) en vez de dejarlo sin aprovechar.',
      'Si ningún hueco real la acepta, sigue exactamente igual que antes: el turno normal de Intercalado y, si ese carril se pasara del límite, la mejora anterior de usar el otro carril.',
      'No cambia la orientación automática por pulgadas, el límite de 15.9 m, el aviso de superar 100%, ni el resto del sistema.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-09-21',
    title: 'Intercalado aprovecha el hueco real del otro carril',
    changes: [
      'En el modo "Intercalado", si el carril que le toca a una tarima ya se pasaría del límite de 15.9 m pero el otro carril todavía tiene espacio real para ella, ahora se coloca automáticamente en ese otro carril en vez de forzar el sobrecupo innecesariamente.',
      'Esto solo aplica cuando el carril preferido específicamente se pasa del límite y el otro sí cabe — si ambos caben, se sigue respetando la elección normal de Intercalado (nunca "elegir siempre el carril más corto"); si ninguno cabe, se conserva el sobrecupo de siempre.',
      'No cambia el algoritmo de acomodo por tamaño, la orientación, el límite de 15.9 m, el aviso de superar 100%, ni el resto del sistema.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-09-18',
    title: 'Porcentaje de capacidad real + aviso al superar el 100%',
    changes: [
      'La tarjeta "Capacidad" ahora muestra el porcentaje real de uso (puede pasar de 100%: 105%, 111%, etc.) en vez de quedarse topado en 100% cuando la carga ya superó el límite de 15.9 m.',
      'Cuando la capacidad queda por encima de 100% aparece la etiqueta "Excedido" junto al porcentaje, con el número y la barra en color de advertencia — la barra sigue limitada visualmente a 100% de ancho para no salirse de la tarjeta.',
      '"Disponible" nunca muestra negativos: se queda en 0.00 m cuando ya no hay espacio según el límite oficial.',
      'Nuevo aviso al agregar un pallet que haría pasar la carga de 100% o menos a más de 100%: muestra capacidad máxima, carga actual, nueva carga y capacidad resultante, con botones "Cancelar" (no agrega nada) y "Aceptar y continuar" (agrega y permite seguir cubicando por encima del límite).',
      'Ese aviso no se repite con cada pallet siguiente mientras la carga sigue por encima de 100% — solo vuelve a aparecer si la carga baja de 100% y luego se cruza otra vez, o al iniciar una orden nueva.',
      'Nada de esto cambia el bloqueo real de espacio (cuando ya no cabe nada más), el límite de 15.9 m dibujado en el camión, el algoritmo de acomodo, ni el guardado/PDF de órdenes por encima del 100%.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-09-18',
    title: 'Orientación automática de tarimas por medida + modo Intercalado',
    changes: [
      'Cada tarima recibe una orientación automática según su medida: menos de 65" = horizontal, 65" o más = vertical. Es solo informativa (se ve en el tooltip); el carril real depende del modo de carga elegido.',
      'Nuevo selector arriba del simulador con 2 modos de carga: "Todas verticales" (comportamiento de siempre — cada tarima al carril con menos metros acumulados, sigue siendo el modo por defecto) e "Intercalado" (regla obligatoria: 1 tarima grande en un carril y hasta 2 chicas en el otro, alternando en cada ronda cuál carril recibe la grande).',
      'El acomodo se recalcula solo al agregar, quitar, cambiar cantidad, cargar una orden o refrescar — nunca al arrastrar una tarima para reordenarla, así una tarima grande nunca cambia de orientación por accidente al moverla.',
      'El tooltip de cada tarima ahora muestra su orientación (Vertical/Horizontal) además de carril, posición, longitud y orden.',
      'El PDF sigue mostrando exactamente el mismo acomodo que el simulador, tanto para órdenes nuevas como para el snapshot ya guardado de órdenes históricas.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-09-17',
    title: 'Navegación de fecha unificada en el Historial',
    changes: [
      'Modo Día: ya no se muestran varios días juntos (Hoy/Ayer/15 sep/14 sep). Ahora se ve un solo día a la vez, con flechas para ir al anterior/siguiente y un botón discreto "Seleccionar fecha".',
      'La flecha "siguiente" se deshabilita automáticamente al llegar a Hoy — no se puede avanzar a fechas futuras.',
      'Modo Semana: mismo patrón visual que Día, con las flechas en posiciones fijas — ya no se mueven aunque el texto de la semana sea más largo (cambio de mes o de año).',
      'Los resúmenes diario y semanal, la búsqueda global, Ver simulación, PDF y la memoria del historial siguen funcionando exactamente igual.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-09-17',
    title: 'Nueva orden, memoria del historial, tooltip de tarimas y resumen semanal',
    changes: [
      'Al guardar una orden aparece una confirmación clara con el botón "Nueva orden" (limpia la captura para empezar otra) y "Ver PDF" — ya no se resetea el formulario automáticamente.',
      'El Historial ahora recuerda, durante la sesión, el día/semana, el filtro, la búsqueda, el orden y el scroll — abrir "Ver simulación" y cerrarla ya no te regresa a Hoy.',
      'Nuevo tooltip al pasar el mouse (o tocar) sobre una tarima del trailer: pulgadas, carril, posición, longitud y orden — sin llenar el dibujo de texto permanente.',
      'Nuevo selector Día/Semana en el Historial: el modo Semana muestra un resumen (órdenes, tarimas, metros, promedio por orden) respetando Todas/Activas/Archivadas.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-09-17',
    title: 'Buscador de órdenes en el Historial',
    changes: [
      'Nuevo buscador dentro del Historial: escribí el número de orden (completo o parcial) y encontrala aunque sea de hace semanas o meses, sin tener que saber en qué día fue.',
      'La búsqueda es global (no depende del día seleccionado) y respeta los filtros Todas/Activas/Archivadas.',
      'Los resultados muestran fecha y hora completas, y conservan las mismas acciones de siempre: Ver simulación, PDF y el menú "···".',
      'Al limpiar la búsqueda, el historial regresa exactamente al día y filtro que estabas viendo.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-17',
    title: 'PDF con colores por medida y "Ver simulación" en el historial',
    changes: [
      'El PDF ahora pinta cada tarima con el mismo color de su medida que ya usa el simulador (antes se coloreaba por orden). La tabla de desglose sigue igual, sin colores.',
      'Nueva acción "Ver simulación" en el historial: abre un modal de solo lectura con el acomodo exacto del trailer tal como quedó guardado, incluyendo el orden final después de arrastrar tarimas.',
      'A partir de ahora cada orden guardada conserva un snapshot de su acomodo (carril y posición de cada tarima), no solo las cantidades. El PDF y "Ver simulación" usan ese snapshot en vez de recalcular.',
      'Las órdenes guardadas antes de este cambio siguen funcionando igual (PDF, historial, eliminar); al no tener snapshot, "Ver simulación" avisa que esa vista no está disponible para ellas.',
    ],
  },
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
