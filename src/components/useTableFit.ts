import { useEffect, useRef } from 'react';

// Fit the table to the layout viewport, not the keyboard/pinch-zoom viewport.
export default function useTableFit(active: boolean, openingNames: boolean) {
  const appRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const app = appRef.current, shell = shellRef.current;
    if (!active || !app || !shell) return;
    let pending = 0;
    function editingOrZooming() {
      return (window.visualViewport?.scale ?? 1) > 1.05 ||
        document.activeElement?.matches('input:not([type="range"]), textarea, [contenteditable="true"]');
    }
    function fit() {
      pending = 0;
      if (!app || !shell || editingOrZooming()) return;
      const rect = shell.getBoundingClientRect();
      const height = window.innerHeight;
      const available = height - (rect.top + window.scrollY) - 12;
      // Footer/help can scroll below play; they must not take space from the board.
      const layout = shell.querySelector('.game-layout')?.getBoundingClientRect();
      const essentialHeight = layout ? layout.bottom - rect.top : rect.height;
      const overflow = essentialHeight - available;
      if (overflow <= 1) return;
      // Very short windows may scroll; preserve useful checker and touch sizes.
      const landscape = window.matchMedia('(min-width:800px) and (min-aspect-ratio:6/5)').matches;
      const minimum = Math.min(landscape ? 800 : 540, document.documentElement.clientWidth);
      const width = Math.max(minimum, Math.floor(app.getBoundingClientRect().width - overflow * 4 / 3 - 3));
      if (width < app.getBoundingClientRect().width - .5) app.style.setProperty('--table-width', width + 'px');
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(fit); }
    function reset() {
      if (editingOrZooming()) return;
      app?.style.removeProperty('--table-width'); schedule();
    }
    function textEntryFinished(event: FocusEvent) {
      // Tapping between board points must not resize the board mid-gesture.
      if (event.target instanceof HTMLElement && event.target.matches('input:not([type="range"]), textarea, [contenteditable="true"]')) reset();
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(shell);
    window.addEventListener('resize', reset);
    window.visualViewport?.addEventListener('resize', reset);
    shell.addEventListener('focusout', textEntryFinished);
    reset();
    return () => {
      observer.disconnect(); cancelAnimationFrame(pending);
      window.removeEventListener('resize', reset);
      window.visualViewport?.removeEventListener('resize', reset);
      shell.removeEventListener('focusout', textEntryFinished);
    };
  }, [active, openingNames]);
  return {appRef, shellRef};
}
