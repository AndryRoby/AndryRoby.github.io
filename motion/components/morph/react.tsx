'use client';
// ARLing Motion: Morph for React. A thin wrapper: the vanilla component does the FLIP, the
// face and content crossfade, ARIA, focus and keyboard; React only renders the markup.
// In the registry the core lives at '@/lib/arling-motion' and this component's logic at
// '@/lib/arling-motion/morph'.
import * as React from 'react';
import { createMorph } from '@/lib/arling-motion/morph';

type MorphApi = {
  open: (o?: { t?: number }) => unknown;
  close: (o?: { t?: number }) => unknown;
  isOpen: () => boolean;
  destroy: () => void;
};

export interface MorphProps {
  /** What the card shows, for example a kicker, a name and one line. The card grows into the dialog. */
  card: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons or links at the bottom. Give a button data-am-close to close the dialog with it. */
  footer?: React.ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Class of the dialog panel. */
  className?: string;
  /** Class of the card. */
  cardClassName?: string;
  /** Force reduced motion on or off; by default the user's system setting decides. */
  reducedMotion?: boolean;
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Morph({
  card,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  className,
  cardClassName,
  reducedMotion,
}: MorphProps) {
  const cardRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<MorphApi | null>(null);
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const id = React.useId();

  React.useEffect(() => {
    if (!cardRef.current || !rootRef.current) return;
    const api = createMorph({
      trigger: cardRef.current,
      root: rootRef.current,
      reduced: reducedMotion,
      onOpenChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as MorphApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (!api || open === undefined || open === api.isOpen()) return;
    if (open) api.open();
    else api.close();
  }, [open]);

  return (
    <>
      <button ref={cardRef} type="button" className={cx('am-morph-card', cardClassName)}>
        {card}
      </button>
      <div ref={rootRef} className="am-morph-root" hidden>
        <div className="am-morph-backdrop" />
        <div
          className={cx('am-morph-panel', className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-desc` : undefined}
        >
          <div className="am-morph-content">
            <h2 id={`${id}-title`} className="am-morph-title">
              {title}
            </h2>
            {description ? (
              <p id={`${id}-desc`} className="am-morph-description">
                {description}
              </p>
            ) : null}
            {children}
            {footer ? <div className="am-morph-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default Morph;
