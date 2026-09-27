'use client';
// ARLing Motion: Slider for React. A thin wrapper: the vanilla component owns the thumb springs,
// the bubble, the ARIA values, pointer capture and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/slider'.
import * as React from 'react';
import { createSlider } from '@/lib/arling-motion/slider';

type SliderApi = {
  set: (v: number) => unknown;
  value: () => number;
  seek: (t: number) => void;
  driver: { now: () => number };
  destroy: () => void;
};

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'children'> {
  min?: number;
  max?: number;
  step?: number;
  /** Page Up and Page Down step (default: a tenth of the range, on the step grid). */
  bigStep?: number;
  defaultValue?: number;
  /** Controlled value (optional). */
  value?: number;
  /** Every change while dragging or pressing keys. */
  onValueChange?: (value: number) => void;
  /** Once a drag, a press on the track or a key ends with a new value. */
  onValueCommit?: (value: number) => void;
  /** Text of the bubble and of aria-valuetext, for example (v) => `${v} conversations`. */
  format?: (value: number) => string;
  /** When the bubble shows: while held or keyboard focused (default), always, or never. */
  bubble?: 'active' | 'always' | 'none';
  disabled?: boolean;
  reducedMotion?: boolean;
}

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  bigStep,
  defaultValue,
  value,
  onValueChange,
  onValueCommit,
  format,
  bubble = 'active',
  disabled,
  reducedMotion,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}: SliderProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<SliderApi | null>(null);
  const changeRef = React.useRef(onValueChange);
  changeRef.current = onValueChange;
  const commitRef = React.useRef(onValueCommit);
  commitRef.current = onValueCommit;
  const formatRef = React.useRef(format);
  formatRef.current = format;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createSlider({
      root: ref.current,
      min,
      max,
      step,
      bigStep,
      value: value ?? defaultValue ?? min,
      bubble,
      disabled: !!disabled,
      reduced: reducedMotion,
      format: (v: number) => (formatRef.current ? formatRef.current(v) : undefined),
      onChange: (v: number) => changeRef.current?.(v),
      onCommit: (v: number) => commitRef.current?.(v),
    }) as unknown as SliderApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once per range and option; later values go through set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, bigStep, bubble, disabled, reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && value !== undefined && value !== api.value()) api.set(value);
  }, [value]);

  // a new formatter shows at once
  React.useEffect(() => {
    const api = apiRef.current;
    if (api) api.seek(api.driver.now());
  }, [format]);

  return (
    <div ref={ref} className={cx('am-slider', className)} data-disabled={disabled ? '' : undefined} {...rest}>
      <span className="am-slider-track" aria-hidden="true">
        <span className="am-slider-range" />
      </span>
      <span className="am-slider-thumb" role="slider" tabIndex={disabled ? -1 : 0} aria-label={ariaLabel} aria-labelledby={ariaLabelledby} />
      {bubble !== 'none' && <span className="am-slider-bubble" aria-hidden="true" />}
    </div>
  );
}

export default Slider;
