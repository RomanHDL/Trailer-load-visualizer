import { useEffect } from 'react';

// Bloquea el scroll de la página de fondo mientras `locked` es true (un
// modal abierto), y lo restaura al cerrar. El scroll queda disponible solo
// dentro del propio modal (su contenedor con overflow-y).
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
