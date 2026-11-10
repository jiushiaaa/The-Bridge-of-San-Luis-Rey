import { useEffect, useRef } from 'react';

/** Keep keyboard navigation inside a cover dialog and return to its opener. */
export function useDialogFocus(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter(el => el.getClientRects().length > 0);
    (controls()[0] ?? dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const current = document.activeElement;
      const first = items[0] ?? dialog;
      const last = items[items.length - 1] ?? dialog;
      if (!dialog.contains(current) || (event.shiftKey ? current === first : current === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener?.isConnected) opener.focus();
    };
  }, [active]);
  return ref;
}
