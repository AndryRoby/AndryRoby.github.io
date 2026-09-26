'use client';
// ARLing Motion: Tabs for React. A thin wrapper over the vanilla component, which owns
// the motion, ARIA state (aria-selected, tabindex, inert) and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/tabs'.
import * as React from 'react';
import { createTabs } from '@/lib/arling-motion/tabs';

type TabsApi = { select: (i: number, o?: { t?: number; focus?: boolean }) => unknown; selected: () => number; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Index of the tab selected at first. */
  defaultValue?: number;
  /** Controlled index (optional). */
  value?: number;
  onValueChange?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  /** 'automatic' selects on focus (default), 'manual' needs Enter or Space. */
  activation?: 'automatic' | 'manual';
  reducedMotion?: boolean;
}

export function Tabs({ defaultValue = 0, value, onValueChange, orientation, activation, reducedMotion, className, children, ...rest }: TabsProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<TabsApi | null>(null);
  const changeRef = React.useRef(onValueChange);
  changeRef.current = onValueChange;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createTabs({
      root: ref.current,
      selected: value ?? defaultValue,
      orientation,
      activation,
      reduced: reducedMotion,
      onChange: (i: number) => changeRef.current?.(i),
    }) as unknown as TabsApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // the component is built once per layout option; value changes go through select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation, activation, reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (api && value !== undefined && value !== api.selected()) api.select(value);
  }, [value]);

  return (
    <div ref={ref} className={cx('am-tabs', className)} {...rest}>
      {children}
    </div>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function TabsList({ className, children, orientation, ...rest }: TabsListProps) {
  return (
    <div role="tablist" aria-orientation={orientation === 'vertical' ? 'vertical' : undefined} className={cx('am-tabs-list', className)} {...rest}>
      {children}
      <span className="am-tabs-indicator" aria-hidden="true" />
    </div>
  );
}

export function TabsTrigger({ className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" role="tab" className={className} {...rest} />;
}

export function TabsPanels({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('am-tabs-panels', className)} {...rest} />;
}

export function TabsContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tabpanel" className={className} {...rest} />;
}
