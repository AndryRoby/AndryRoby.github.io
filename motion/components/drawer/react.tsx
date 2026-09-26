'use client';
// ARLing Motion: Drawer for React. A thin wrapper: the vanilla component owns the rise, the
// 1:1 drag, the spring from the release speed, ARIA, focus and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/drawer'.
import * as React from 'react';
import { createDrawer } from '@/lib/arling-motion/drawer';

type DrawerApi = { open: () => unknown; close: () => unknown; isOpen: () => boolean; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface DrawerProps {
  /** Content of the button that opens the drawer. */
  trigger: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons at the bottom. Give a button data-am-close to close the drawer with it. */
  footer?: React.ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  reducedMotion?: boolean;
}

export function Drawer({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  className,
  triggerClassName,
  reducedMotion,
}: DrawerProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<DrawerApi | null>(null);
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const id = React.useId();

  React.useEffect(() => {
    if (!triggerRef.current || !rootRef.current) return;
    const api = createDrawer({
      trigger: triggerRef.current,
      root: rootRef.current,
      reduced: reducedMotion,
      onOpenChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as DrawerApi;
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
      <button ref={triggerRef} type="button" className={cx('am-drawer-trigger', triggerClassName)}>
        {trigger}
      </button>
      <div ref={rootRef} className="am-drawer" hidden>
        <div className="am-drawer-overlay" />
        <div
          className={cx('am-drawer-panel', className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-desc` : undefined}
          tabIndex={-1}
        >
          <div className="am-drawer-handle" aria-hidden="true" />
          <div className="am-drawer-content">
            <h2 id={`${id}-title`} className="am-drawer-title">
              {title}
            </h2>
            {description ? <p id={`${id}-desc`}>{description}</p> : null}
            {children}
            {footer ? <div className="am-drawer-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default Drawer;
