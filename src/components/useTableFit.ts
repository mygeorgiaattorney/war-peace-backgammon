import { useEffect, useRef } from 'react';

// Measure actual game chrome, rather than growing a 4:3 board from width alone.
export default function useTableFit(active: boolean, openingNames: boolean) {
  const appRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const app = appRef.current, shell = shellRef.current;
    if (!active || !app || !shell) return;
    let pending = 0;
    function fit() {
      pending = 0;
      if (!app || !shell) return;
      const rect = shell.getBoundingClientRect();
      const height = window.visualViewport?.height || window.innerHeight;
      const available = height - (rect.top + window.scrollY) - 12;
      const overflow = rect.height - available;
      if (overflow <= 1) return;
      // Very short windows may scroll; preserve useful checker and touch sizes.
      const minimum = Math.min(540, document.documentElement.clientWidth);
      const width = Math.max(minimum, Math.floor(app.getBoundingClientRect().width - overflow * 4 / 3 - 3));
      if (width < app.getBoundingClientRect().width - .5) app.style.setProperty('--table-width', width + 'px');
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(fit); }
    function reset() { app?.style.removeProperty('--table-width'); schedule(); }
    const observer = new ResizeObserver(schedule);
    observer.observe(shell);
    window.addEventListener('resize', reset);
    window.visualViewport?.addEventListener('resize', reset);
    reset();
    return () => {
      observer.disconnect(); cancelAnimationFrame(pending);
      window.removeEventListener('resize', reset);
      window.visualViewport?.removeEventListener('resize', reset);
    };
  }, [active, openingNames]);
  return {appRef, shellRef};
}
