import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

type Position = { x: number; y: number };
type Preferences = { hidden: boolean; position: Position | null };
const changedEvent = 'cora-launcher-preferences';

function read(key: string): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    // En dispositivos móviles, siempre usar la posición CSS bottom-right fija para evitar tapar encabezados
    if (isMobile) {
      return { hidden: value?.hidden === true, position: null };
    }
    const pos =
      Number.isFinite(value?.position?.x) && Number.isFinite(value?.position?.y)
        ? value.position
        : null;
    return {
      hidden: value?.hidden === true,
      position: pos,
    };
  } catch {
    return { hidden: false, position: null };
  }
}

export default function useChatbotLauncher(identity: string, launcher: RefObject<HTMLButtonElement | null>) {
  const key = `cora-launcher:${identity}`;
  const [preferences, setPreferences] = useState(() => read(key));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; start: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const save = (value: Preferences) => {
    setPreferences(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Disponible sin almacenamiento. */ }
    window.dispatchEvent(new CustomEvent(changedEvent, { detail: { key, value } }));
  };

  const clamp = (position: Position): Position => {
    const rect = launcher.current?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const isMobile = width < 768;
    const minTop = isMobile ? top + height - (rect?.height ?? 56) - 160 : top + 8;
    const maxTop = isMobile
      ? top + height - (rect?.height ?? 56) - 96
      : top + height - (rect?.height ?? 56) - 8;

    return {
      x: Math.max(left + 8, Math.min(position.x, left + width - (rect?.width ?? 56) - 8)),
      y: Math.max(minTop, Math.min(position.y, maxTop)),
    };
  };

  useLayoutEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof CustomEvent && event.detail.key === key) setPreferences(event.detail.value);
      else if (event instanceof StorageEvent && (event.key === key || event.key === null)) setPreferences(read(key));
    };
    window.addEventListener(changedEvent, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(changedEvent, sync);
      window.removeEventListener('storage', sync);
    };
  }, [key]);

  useLayoutEffect(() => {
    const resize = () => setPreferences(previous => {
      if (!previous.position || !launcher.current) return previous;
      const position = clamp(previous.position);
      return position.x === previous.position.x && position.y === previous.position.y
        ? previous : { ...previous, position };
    });
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, [preferences.hidden, launcher]);

  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    suppressClick.current = current.moved || cancelled;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved) save({ ...preferences, position: clamp(cancelled ? current.start : {
      x: current.start.x + event.clientX - current.x,
      y: current.start.y + event.clientY - current.y,
    }) });
  };

  return {
    hidden: preferences.hidden,
    setHidden: (hidden: boolean) => save({ ...preferences, hidden }),
    resetPosition: () => save({ ...preferences, position: null }),
    dragging,
    style: preferences.position ? { left: preferences.position.x, top: preferences.position.y, right: 'auto', bottom: 'auto' } : undefined,
    consumeClick: () => { const suppressed = suppressClick.current; suppressClick.current = false; return suppressed; },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0 || drag.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      suppressClick.current = false;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
        start: { x: rect.left, y: rect.top }, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.hypot(dx, dy) < 6) return;
      current.moved = true;
      suppressClick.current = true;
      setDragging(true);
      setPreferences(previous => ({ ...previous, position: clamp({ x: current.start.x + dx, y: current.start.y + dy }) }));
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
  };
}
