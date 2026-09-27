'use client';
// ARLing Motion: Island for React. A thin wrapper: the vanilla component owns the pill springs,
// the content that leaves and enters, the spinner, the check that draws itself and the status
// text for screen readers. In the registry the core lives at '@/lib/arling-motion' and this
// logic at '@/lib/arling-motion/island'.
import * as React from 'react';
import { createIsland } from '@/lib/arling-motion/island';

export type IslandIcon = 'spinner' | 'check' | 'download' | 'dot';
export type IslandTone = 'neutral' | 'success' | 'accent';

export interface IslandState {
  icon?: IslandIcon;
  title: string;
  detail?: string;
  tone?: IslandTone;
}

type IslandApi = { show: (s: IslandState) => unknown; hide: () => unknown; destroy: () => void };

export interface IslandProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** What the island shows; null or undefined hides it. A new state reshapes the pill. */
  state?: IslandState | null;
  reducedMotion?: boolean;
}

const keyOf = (s?: IslandState | null) => (s ? JSON.stringify([s.icon ?? null, s.title, s.detail ?? '', s.tone ?? 'neutral']) : '');

export function Island({ state, reducedMotion, className, ...rest }: IslandProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<IslandApi | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  // the state the vanilla island shows now, so an equal state does not replay the morph
  const shownRef = React.useRef('');
  const key = keyOf(state);

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createIsland({ el: ref.current, reduced: reducedMotion }) as unknown as IslandApi;
    apiRef.current = api;
    const s = stateRef.current;
    if (s) api.show(s);
    shownRef.current = keyOf(s);
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [reducedMotion]);

  React.useEffect(() => {
    const api = apiRef.current;
    if (!api || key === shownRef.current) return;
    shownRef.current = key;
    const s = stateRef.current;
    if (s) api.show(s);
    else api.hide();
  }, [key]);

  return <div ref={ref} className={['am-island', className].filter(Boolean).join(' ')} {...rest} />;
}

export default Island;
