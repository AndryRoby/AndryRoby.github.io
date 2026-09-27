'use client';
// ARLing Motion: Steps for React. A thin wrapper: React renders every part once, and the vanilla
// component owns the line, the discs, the checks that draw themselves, the rings, the ARIA state
// and the status text. In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/steps'.
import * as React from 'react';
import { createSteps } from '@/lib/arling-motion/steps';

type StepsApi = { setStep: (i: number) => unknown; step: () => number; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';

export interface StepItem {
  title: string;
  detail?: string;
}

export interface StepsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: StepItem[];
  /** The current step, 0 is the first; items.length means every step is done. */
  step: number;
  /** The name of the progress bar (default: the list's name and "progress"). */
  label?: string;
  /** The hidden word before a finished step (default "Completed"). */
  doneText?: string;
  /** Say each change in a polite status region (default true). */
  announce?: boolean;
  reducedMotion?: boolean;
}

export function Steps({
  items,
  step,
  label,
  doneText,
  announce = true,
  reducedMotion,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}: StepsProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<StepsApi | null>(null);
  const stepRef = React.useRef(step);
  stepRef.current = step;
  const titles = items.map((it) => it.title).join('\u0000');

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createSteps({
      root: ref.current,
      step: stepRef.current,
      label,
      doneText,
      announce,
      reduced: reducedMotion,
    }) as unknown as StepsApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once per set of steps; a new step goes through setStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles, label, doneText, announce, reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && api.step() !== step) api.setStep(step);
  }, [step]);

  const vars = { ...style, ['--am-steps-count' as string]: String(items.length) } as React.CSSProperties;

  return (
    <div ref={ref} className={cx('am-steps', className)} style={vars} {...rest}>
      <div className="am-steps-bar">
        <span className="am-steps-fill" />
      </div>
      <ol className="am-steps-list" role="list" aria-label={ariaLabel} aria-labelledby={ariaLabelledby}>
        {items.map((it, i) => (
          <li key={i} className="am-steps-item">
            <span className="am-steps-marker" aria-hidden="true">
              <span className="am-steps-halo" />
              <span className="am-steps-disc" />
              <span className="am-steps-num">{i + 1}</span>
              <svg className="am-steps-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path className="am-steps-draw" d={CHECK_PATH} pathLength={1} />
              </svg>
            </span>
            <span className="am-steps-sr" />
            <span className="am-steps-title">{it.title}</span>
            {it.detail ? <span className="am-steps-detail">{it.detail}</span> : null}
          </li>
        ))}
      </ol>
      {announce ? <span className="am-steps-status" /> : null}
    </div>
  );
}

export default Steps;
