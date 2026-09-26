'use client';
// ARLing Motion: Dialog for React. A thin wrapper: the vanilla component does all motion,
// ARIA and keyboard work; React only renders the markup and passes options.
// In the registry the core lives at '@/lib/arling-motion' and this component's logic at
// '@/lib/arling-motion/dialog' (dialog.js with its core import pointed at the core).
import * as React from 'react';
import { createDialog } from '@/lib/arling-motion/dialog';

type DialogApi = {
  open: (o?: { t?: number; x?: number; y?: number }) => unknown;
  close: (o?: { t?: number }) => unknown;
  isOpen: () => boolean;
  destroy: () => void;
};

export interface DialogProps {
  /** Text or node of the button that opens the dialog; the dialog grows out of it. */
  trigger: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons at the bottom. Give a button data-am-close to close the dialog with it. */
  footer?: React.ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  /** Force reduced motion on or off; by default the user's system setting decides. */
  reducedMotion?: boolean;
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Dialog({
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
}: DialogProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<DialogApi | null>(null);
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const id = React.useId();

  React.useEffect(() => {
    if (!triggerRef.current || !rootRef.current) return;
    const api = createDialog({
      trigger: triggerRef.current,
      root: rootRef.current,
      reduced: reducedMotion,
      onOpenChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as DialogApi;
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
      <button ref={triggerRef} type="button" className={cx('am-dialog-trigger', triggerClassName)}>
        {trigger}
      </button>
      <div ref={rootRef} className="am-dialog-root" hidden>
        <div className="am-dialog-backdrop" />
        <div className="am-dialog-frame">
          <div
            className={cx('am-dialog', className)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={description ? `${id}-desc` : undefined}
          >
            <div className="am-dialog-content">
              <h2 id={`${id}-title`} className="am-dialog-title">
                {title}
              </h2>
              {description ? (
                <p id={`${id}-desc`} className="am-dialog-description">
                  {description}
                </p>
              ) : null}
              {children}
              {footer ? <div className="am-dialog-footer">{footer}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dialog;
