import { useEffect } from 'react';

// Bloquea el scroll de la página de fondo mientras `locked` es true (un
// modal abierto), y lo restaura al cerrar. El scroll queda disponible solo
// dentro del propio modal (su contenedor con overflow-y, ej. .modal-body).
//
// overflow:hidden en <body>/<html> no alcanza por sí solo: si la rueda del
// mouse pasa sobre una zona del modal que no es scrolleable (ej. el
// resumen del día/semana), el navegador puede encadenar ese scroll hacia
// el documento de todas formas. Por eso además se intercepta el evento
// "wheel" a nivel documento y se bloquea salvo que el target esté dentro
// del contenedor scrolleable real del modal.
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    if (typeof document === 'undefined') return;
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    function handleWheel(e) {
      if (e.target.closest && e.target.closest('.modal-body, .alert-modal')) return;
      e.preventDefault();
    }
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [locked]);
}
