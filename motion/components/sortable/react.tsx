'use client';
// ARLing Motion: Sortable for React. A thin wrapper: the vanilla component owns the drag, the
// springs, the keyboard, aria-pressed and the announcements. React owns the order of the items:
// the component never moves them (moveNodes: false), it calls onReorder, the list renders in the
// new order and sync() lets every item glide from where it was. Without the values prop the
// wrapper keeps the order itself. In the registry the core lives at '@/lib/arling-motion' and
// this logic at '@/lib/arling-motion/sortable'.
import * as React from 'react';
import { createSortable } from '@/lib/arling-motion/sortable';

type SortableApi = { sync: () => unknown; destroy: () => void };

type Messages = Partial<Record<'pickedUp' | 'moved' | 'dropped' | 'cancelled', (label: string, position: number, count: number) => string>>;

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
const SEP = '\u0000';

export interface SortableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> {
  /** The order, as the value of every SortableItem (optional: without it the wrapper keeps the order). */
  values?: string[];
  /** After the user drops an item in a new place, with the values in the new order. */
  onReorder?: (values: string[]) => void;
  /** Your own announcements, for example in another language. */
  messages?: Messages;
  /** The instructions the handles point to (aria-describedby). */
  instructions?: string;
  reducedMotion?: boolean;
  children?: React.ReactNode;
}

export function Sortable({
  values,
  onReorder,
  messages,
  instructions,
  reducedMotion,
  className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...rest
}: SortableProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<SortableApi | null>(null);
  const kids = React.Children.toArray(children).filter(React.isValidElement) as Array<React.ReactElement<SortableItemProps>>;
  const childValues = kids.map((k) => String(k.props.value));
  const setKey = [...childValues].sort().join(SEP);
  const [inner, setInner] = React.useState<string[]>(childValues);
  const innerFits = inner.length === childValues.length && [...inner].sort().join(SEP) === setKey;
  const order = values ?? (innerFits ? inner : childValues);
  const byValue = new Map(kids.map((k) => [String(k.props.value), k]));
  const sorted = order.map((v) => byValue.get(v)).filter(Boolean);

  const reorderRef = React.useRef(onReorder);
  reorderRef.current = onReorder;
  const controlledRef = React.useRef(values !== undefined);
  controlledRef.current = values !== undefined;
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;

  // built once per set of items; a new order goes through sync()
  React.useEffect(() => {
    if (!ref.current) return;
    const api = createSortable({
      root: ref.current,
      moveNodes: false,
      reduced: reducedMotion,
      instructions,
      messages: messagesRef.current,
      onReorder: (next: string[]) => {
        if (!controlledRef.current) setInner(next);
        reorderRef.current?.(next);
      },
    }) as unknown as SortableApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [setKey, reducedMotion, instructions]);

  // after React has put the items in the new order, before the browser paints
  React.useLayoutEffect(() => {
    apiRef.current?.sync();
  }, [order.join(SEP)]);

  return (
    <div ref={ref} className={cx('am-sortable', className)} {...rest}>
      <ul className="am-sortable-list" aria-label={ariaLabel} aria-labelledby={ariaLabelledby}>
        {sorted}
      </ul>
    </div>
  );
}

export interface SortableItemProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, 'value'> {
  value: string;
  /** The item's name for the handle ("Move <label>") and the announcements. */
  label: string;
}

export function SortableItem({ value, label, className, children, ...rest }: SortableItemProps) {
  return (
    <li className={cx('am-sortable-item', className)} data-value={value} data-label={label} {...rest}>
      <button type="button" className="am-sortable-handle" aria-label={`Move ${label}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <span className="am-sortable-label">{children ?? label}</span>
    </li>
  );
}

export default Sortable;
