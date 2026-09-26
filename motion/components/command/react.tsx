'use client';
// ARLing Motion: Command menu for React. A thin wrapper: the vanilla component owns the
// filtering, the moving rows, the list height, the highlight, ARIA and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/command'.
import * as React from 'react';
import { createCommand } from '@/lib/arling-motion/command';

type CommandApi = { search: (q: string) => unknown; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface CommandItem {
  value: string;
  label: React.ReactNode;
  /** Extra words that should find this row. */
  keywords?: string[];
  /** A hint shown on the right, for example a keyboard shortcut. Not searched. */
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface CommandProps {
  items: CommandItem[];
  onSelect?: (value: string) => void;
  placeholder?: string;
  /** Accessible name of the search field. */
  label?: string;
  /** Accessible name of the list. */
  listLabel?: string;
  emptyText?: string;
  /** Down on the last row goes to the first. */
  loop?: boolean;
  /** Letter for Ctrl or Cmd that focuses the field; false turns it off. */
  shortcut?: string | false;
  reducedMotion?: boolean;
  className?: string;
}

/**
 * <Command items={[{ value: 'new-file', label: 'New file' }]} onSelect={(v) => ...} />
 * The rows are read once when the menu mounts; give it a new key when they change.
 */
export function Command({
  items,
  onSelect,
  placeholder = 'Type a command or search',
  label = 'Command',
  listLabel = 'Commands',
  emptyText = 'No results.',
  loop,
  shortcut,
  reducedMotion,
  className,
}: CommandProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const selectRef = React.useRef(onSelect);
  selectRef.current = onSelect;

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createCommand({
      root: ref.current,
      loop,
      shortcut,
      emptyText,
      reduced: reducedMotion,
      onSelect: (value: string) => selectRef.current?.(value),
    }) as unknown as CommandApi;
    return () => api.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, shortcut, reducedMotion]);

  return (
    <div ref={ref} className={cx('am-command', className)}>
      <input className="am-command-input" placeholder={placeholder} aria-label={label} defaultValue="" />
      <div className="am-command-list" role="listbox" aria-label={listLabel}>
        <div className="am-command-highlight" aria-hidden="true" />
        {items.map((it) => (
          <div
            key={it.value}
            role="option"
            aria-selected="false"
            aria-disabled={it.disabled || undefined}
            data-value={it.value}
            data-keywords={it.keywords?.join(' ')}
          >
            <span>{it.label}</span>
            {it.hint ? <span className="am-command-kbd" aria-hidden="true">{it.hint}</span> : null}
          </div>
        ))}
        <div className="am-command-empty" aria-hidden="true">
          {emptyText}
        </div>
      </div>
      <div className="am-command-status" role="status" />
    </div>
  );
}

export default Command;
