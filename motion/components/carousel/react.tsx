'use client';
// ARLing Motion: Carousel for React. A thin wrapper: the vanilla component owns the 1:1 drag,
// the rubber band, the throw and the landing spring, the buttons, the dots, ARIA and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/carousel'.
import * as React from 'react';
import { createCarousel } from '@/lib/arling-motion/carousel';

type CarouselApi = { go: (i: number) => unknown; index: () => number; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface CarouselProps {
  /** Accessible name of the carousel, for example "Featured plans". */
  label: string;
  /** Slide shown first. */
  defaultIndex?: number;
  /** Controlled slide (optional). */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Dots under the slides (a pointer shortcut; the buttons and keys do the same). Default true. */
  dots?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  reducedMotion?: boolean;
  className?: string;
  slideClassName?: string;
  /** Each child is one slide. */
  children?: React.ReactNode;
}

/**
 * <Carousel label="Plans"><PlanCard /><PlanCard /></Carousel>
 * The slides are read once when the carousel mounts; give it a new key when they change.
 * Slide width: set --am-carousel-slide on the carousel (default min(80%, 18rem)).
 */
export function Carousel({
  label,
  defaultIndex = 0,
  index,
  onIndexChange,
  dots = true,
  previousLabel = 'Previous slide',
  nextLabel = 'Next slide',
  reducedMotion,
  className,
  slideClassName,
  children,
}: CarouselProps) {
  const ref = React.useRef<HTMLElement>(null);
  const apiRef = React.useRef<CarouselApi | null>(null);
  const changeRef = React.useRef(onIndexChange);
  changeRef.current = onIndexChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createCarousel({
      root: ref.current,
      index: apiRef.current ? apiRef.current.index() : index ?? defaultIndex,
      reduced: reducedMotion,
      onChange: (i: number) => changeRef.current?.(i),
    }) as unknown as CarouselApi;
    apiRef.current = api;
    return () => {
      api.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && index !== undefined && index !== api.index()) api.go(index);
  }, [index]);

  const slides = React.Children.toArray(children);
  return (
    <section ref={ref} className={cx('am-carousel', className)} aria-roledescription="carousel" aria-label={label}>
      <div className="am-carousel-viewport">
        <div className="am-carousel-track">
          {slides.map((slide, i) => (
            <div
              key={i}
              className={cx('am-carousel-slide', slideClassName)}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>
      <div className="am-carousel-controls">
        {dots ? <div className="am-carousel-dots" aria-hidden="true" /> : null}
        <button type="button" className="am-carousel-prev" aria-label={previousLabel} />
        <button type="button" className="am-carousel-next" aria-label={nextLabel} />
      </div>
      <div className="am-carousel-status" aria-live="polite" aria-atomic="true" />
    </section>
  );
}

export default Carousel;
