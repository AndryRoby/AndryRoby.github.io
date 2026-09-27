'use client';
// ARLing Motion: Marquee for React. A thin wrapper: the vanilla component owns the band's
// position (a function of time), the copies, the stop and start springs, the keyboard glide
// and the pause button. React renders the original items; after each render the component
// copies them again. In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/marquee'.
import * as React from 'react';
import { createMarquee } from '@/lib/arling-motion/marquee';

type MarqueeApi = { refresh: () => unknown; pause: () => unknown; play: () => unknown; paused: () => boolean; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Speed in px per second (default 40). */
  speed?: number;
  /** Which way the band moves (default left). */
  direction?: 'left' | 'right';
  /** Stop while the pointer is over the band (default true). */
  pauseOnHover?: boolean;
  /** Controlled paused state of the pause button (optional). */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** aria-label of the button while the band runs and while it is paused. */
  pauseLabel?: string;
  playLabel?: string;
  reducedMotion?: boolean;
}

export function Marquee({
  speed,
  direction,
  pauseOnHover = true,
  paused,
  onPausedChange,
  pauseLabel,
  playLabel,
  reducedMotion,
  className,
  children,
  ...rest
}: MarqueeProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<MarqueeApi | null>(null);
  const changeRef = React.useRef(onPausedChange);
  changeRef.current = onPausedChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const labels: { pause?: string; play?: string } = {};
    if (pauseLabel) labels.pause = pauseLabel;
    if (playLabel) labels.play = playLabel;
    const api = createMarquee({
      root: ref.current,
      speed,
      direction,
      pauseOnHover,
      paused: !!paused,
      labels,
      reduced: reducedMotion,
      onPauseChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as MarqueeApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // built once per option; later paused values go through pause() and play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, direction, pauseOnHover, pauseLabel, playLabel, reducedMotion]);

  // new or changed items: copy the content again
  React.useEffect(() => {
    apiRef.current?.refresh();
  }, [children]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (!api || paused === undefined || paused === api.paused()) return;
    if (paused) api.pause();
    else api.play();
  }, [paused]);

  return (
    <div ref={ref} className={cx('am-marquee', className)} {...rest}>
      <div className="am-marquee-viewport">
        <div className="am-marquee-track">
          <ul className="am-marquee-group">{children}</ul>
        </div>
      </div>
      <button type="button" className="am-marquee-toggle" />
    </div>
  );
}

export function MarqueeItem({ className, ...rest }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cx('am-marquee-item', className)} {...rest} />;
}

export default Marquee;
