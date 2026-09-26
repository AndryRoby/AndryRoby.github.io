'use client';
// ARLing Motion: Accordion for React. A thin wrapper: the vanilla component owns the
// unfold, the row entrances, the chevron, ARIA and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/accordion'.
import * as React from 'react';
import { createAccordion } from '@/lib/arling-motion/accordion';

type AccordionApi = { open: (i: number) => unknown; close: (i: number) => unknown; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface AccordionProps {
  /** Several panels may be open at once (default false). */
  multiple?: boolean;
  /** The last open panel may close (default true). */
  collapsible?: boolean;
  /** Index or indexes open at the start. */
  defaultOpen?: number | number[];
  /** Called with the indexes of the open panels after every change. */
  onOpenChange?: (open: number[]) => void;
  reducedMotion?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * <Accordion defaultOpen={0}>
 *   <AccordionItem title="Shipping"><p>Row</p><p>Row</p></AccordionItem>
 * </Accordion>
 * The items are read once when the accordion mounts; give it a new key when they change.
 */
export function Accordion({ multiple, collapsible, defaultOpen, onOpenChange, reducedMotion, className, children }: AccordionProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createAccordion({
      root: ref.current,
      multiple,
      collapsible,
      open: defaultOpen,
      reduced: reducedMotion,
      onChange: (open: number[]) => changeRef.current?.(open),
    }) as unknown as AccordionApi;
    return () => api.destroy();
    // built once per mode; defaultOpen is only read at the start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, collapsible, reducedMotion]);

  return (
    <div ref={ref} className={cx('am-accordion', className)}>
      {children}
    </div>
  );
}

export interface AccordionItemProps {
  title: React.ReactNode;
  /** Heading level of the header (default 3). */
  level?: 2 | 3 | 4 | 5 | 6;
  disabled?: boolean;
  className?: string;
  /** Each direct child is one row that enters after the unfold reaches it. */
  children?: React.ReactNode;
}

export function AccordionItem({ title, level = 3, disabled, className, children }: AccordionItemProps) {
  const Heading = `h${level}` as 'h3';
  return (
    <div className={cx('am-accordion-item', className)}>
      <Heading className="am-accordion-heading">
        <button type="button" className="am-accordion-trigger" aria-expanded="false" disabled={disabled}>
          <span>{title}</span>
          <span className="am-accordion-chevron" aria-hidden="true" />
        </button>
      </Heading>
      <div className="am-accordion-panel" role="region" hidden>
        <div className="am-accordion-content">{children}</div>
      </div>
    </div>
  );
}

export default Accordion;
