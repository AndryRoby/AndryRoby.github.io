'use client';
// ARLing Motion: Tooltip for React. A thin wrapper over the vanilla component: one bubble
// for the whole group, so moving between icons slides the same bubble along.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/tooltip'.
import * as React from 'react';
import { createTooltip } from '@/lib/arling-motion/tooltip';

type TooltipApi = { destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface TooltipGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Seconds before the first tooltip shows on hover (default 0.5). */
  delay?: number;
  /** After a tooltip hides, another trigger within this many seconds shows at once (default 0.3). */
  skipDelay?: number;
  reducedMotion?: boolean;
}

/**
 * Wrap triggers that carry data-tooltip="Text":
 *   <TooltipGroup><button aria-label="Bold" data-tooltip="Bold">B</button></TooltipGroup>
 * When the set of triggers changes, give the group a new key so it is built again.
 */
export function TooltipGroup({ delay, skipDelay, reducedMotion, className, children, ...rest }: TooltipGroupProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createTooltip({ root: ref.current, delay, skipDelay, reduced: reducedMotion }) as unknown as TooltipApi;
    return () => api.destroy();
  }, [delay, skipDelay, reducedMotion]);

  return (
    <div ref={ref} className={cx('am-tooltip-group', className)} {...rest}>
      {children}
      <div className="am-tooltip" />
    </div>
  );
}

export default TooltipGroup;
