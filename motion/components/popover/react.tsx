'use client';
// ARLing Motion: Popover and DropdownMenu for React. Thin wrappers over the vanilla
// component, which owns the unfold, the item entrances, the sliding highlight, ARIA and
// the keyboard. In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/popover'.
import * as React from 'react';
import { createMenu, createPopover } from '@/lib/arling-motion/popover';

type FloatingApi = { open: () => unknown; close: () => unknown; isOpen: () => boolean; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

interface BaseProps {
  /** Content of the trigger button. */
  trigger: React.ReactNode;
  /** 'start' lines the surface up with the trigger's left edge, 'end' with its right edge. */
  align?: 'start' | 'end';
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  reducedMotion?: boolean;
  children?: React.ReactNode;
}

export interface DropdownMenuProps extends BaseProps {
  /** Called with the index of the picked item. Items can also have their own onClick. */
  onSelect?: (index: number) => void;
  /** Accessible name of the menu when the trigger text is not enough. */
  label?: string;
}

/**
 * <DropdownMenu trigger="Actions" onSelect={(i) => ...}>
 *   <DropdownMenuItem>Duplicate</DropdownMenuItem>
 * </DropdownMenu>
 * The items are read once when the menu mounts; give it a new key when they change.
 */
export function DropdownMenu({ trigger, align, onOpenChange, onSelect, label, className, triggerClassName, reducedMotion, children }: DropdownMenuProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const selectRef = React.useRef(onSelect);
  const changeRef = React.useRef(onOpenChange);
  selectRef.current = onSelect;
  changeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const api = createMenu({
      trigger: triggerRef.current,
      menu: menuRef.current,
      reduced: reducedMotion,
      onSelect: (i: number) => selectRef.current?.(i),
      onOpenChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as FloatingApi;
    return () => api.destroy();
  }, [reducedMotion]);

  return (
    <div className="am-popover-root" data-align={align}>
      <button ref={triggerRef} type="button" className={cx('am-popover-trigger', triggerClassName)}>
        {trigger}
      </button>
      <div className="am-popover-frame">
        <div ref={menuRef} role="menu" aria-label={label} className={cx('am-menu', className)} hidden>
          <div className="am-menu-highlight" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}

export function DropdownMenuItem({ className, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" role="menuitem" tabIndex={-1} aria-disabled={disabled || undefined} className={className} {...rest} />;
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="am-menu-separator" />;
}

export interface PopoverProps extends BaseProps {
  /** Accessible name of the popover; by default the trigger names it. */
  label?: string;
}

/** A non modal dialog anchored to its trigger. */
export function Popover({ trigger, align, onOpenChange, label, className, triggerClassName, reducedMotion, children }: PopoverProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const changeRef = React.useRef(onOpenChange);
  changeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!triggerRef.current || !popRef.current) return;
    const api = createPopover({
      trigger: triggerRef.current,
      popover: popRef.current,
      reduced: reducedMotion,
      onOpenChange: (v: boolean) => changeRef.current?.(v),
    }) as unknown as FloatingApi;
    return () => api.destroy();
  }, [reducedMotion]);

  return (
    <div className="am-popover-root" data-align={align}>
      <button ref={triggerRef} type="button" className={cx('am-popover-trigger', triggerClassName)}>
        {trigger}
      </button>
      <div className="am-popover-frame">
        <div ref={popRef} role="dialog" aria-label={label} className={cx('am-popover', className)} hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
