'use client';
// ARLing Motion: Number for React. A thin wrapper: the vanilla component owns the digit
// springs, the columns that open for a new digit and the text for screen readers.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/number'.
import * as React from 'react';
import { createNumber } from '@/lib/arling-motion/number';

type NumberApi = { set: (v: number) => unknown; value: () => number; destroy: () => void };

export interface NumberTickerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** BCP 47 locale for group and decimal separators, default en-US. */
  locale?: string;
  grouping?: boolean;
  /** Announce changes to screen readers (aria-live). */
  live?: boolean | 'polite' | 'assertive';
  reducedMotion?: boolean;
}

export function NumberTicker({ value, decimals = 0, prefix = '', suffix = '', locale = 'en-US', grouping = true, live, reducedMotion, className, ...rest }: NumberTickerProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const apiRef = React.useRef<NumberApi | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createNumber({ el: ref.current, value, decimals, prefix, suffix, locale, grouping, live, reduced: reducedMotion }) as unknown as NumberApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once per format; later values go through set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decimals, prefix, suffix, locale, grouping, live, reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && value !== api.value()) api.set(value);
  }, [value]);

  return <span ref={ref} className={['am-number', className].filter(Boolean).join(' ')} {...rest} />;
}

export default NumberTicker;
