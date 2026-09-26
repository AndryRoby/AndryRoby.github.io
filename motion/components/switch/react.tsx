'use client';
// ARLing Motion: Switch for React. A thin wrapper: the vanilla component owns the thumb
// spring, the colour that grows as a circle, aria-checked and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/switch'.
import * as React from 'react';
import { createSwitch } from '@/lib/arling-motion/switch';

type SwitchApi = { set: (v: boolean) => unknown; checked: () => boolean; destroy: () => void };

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'aria-checked'> {
  defaultChecked?: boolean;
  /** Controlled state (optional). */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  reducedMotion?: boolean;
}

export function Switch({ defaultChecked = false, checked, onCheckedChange, reducedMotion, className, ...rest }: SwitchProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const apiRef = React.useRef<SwitchApi | null>(null);
  const changeRef = React.useRef(onCheckedChange);
  changeRef.current = onCheckedChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createSwitch({
      el: ref.current,
      checked: checked ?? defaultChecked,
      reduced: reducedMotion,
      onChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as SwitchApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once; later changes of `checked` go through set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && checked !== undefined && checked !== api.checked()) api.set(checked);
  }, [checked]);

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked ?? defaultChecked}
      className={['am-switch', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className="am-switch-ink" aria-hidden="true" />
      <span className="am-switch-ink" aria-hidden="true" />
      <span className="am-switch-thumb" aria-hidden="true" />
    </button>
  );
}

export default Switch;
