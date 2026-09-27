'use client';
// ARLing Motion: Segmented control for React. A thin wrapper: the vanilla component owns the
// thumb spring, aria-checked, the roving tabindex and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/segmented'.
import * as React from 'react';
import { createSegmented } from '@/lib/arling-motion/segmented';

type SegmentedApi = { select: (v: number | string) => unknown; value: () => string; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface SegmentedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Value of the option chosen at first (its value prop). */
  defaultValue?: string;
  /** Controlled value (optional). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Give every option the same width. */
  equal?: boolean;
  reducedMotion?: boolean;
}

export function Segmented({ defaultValue, value, onValueChange, equal, reducedMotion, className, children, ...rest }: SegmentedProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<SegmentedApi | null>(null);
  const changeRef = React.useRef(onValueChange);
  changeRef.current = onValueChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createSegmented({
      root: ref.current,
      selected: value ?? defaultValue,
      reduced: reducedMotion,
      onChange: (_i: number, v: string) => changeRef.current?.(v),
    }) as unknown as SegmentedApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once; later values go through select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && value !== undefined && value !== api.value()) api.select(value);
  }, [value]);

  return (
    <div ref={ref} role="radiogroup" data-equal={equal ? '' : undefined} className={cx('am-segmented', className)} {...rest}>
      <span className="am-segmented-thumb" aria-hidden="true" />
      {children}
    </div>
  );
}

export interface SegmentedItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function SegmentedItem({ value, className, ...rest }: SegmentedItemProps) {
  return <button type="button" role="radio" data-value={value} className={className} {...rest} />;
}

export default Segmented;
