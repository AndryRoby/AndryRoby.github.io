'use client';
// ARLing Motion: Dropzone for React. A thin wrapper: the vanilla component owns the unfold
// into a list, the row entrances and exits, drag and drop, ARIA and focus. It uploads
// nothing; onFilesChange gets the File objects and the upload is yours.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/dropzone'.
import * as React from 'react';
import { createDropzone } from '@/lib/arling-motion/dropzone';

type DropzoneApi = { clear: () => unknown; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface DropzoneProps {
  /** Called with every file in the list after each change. */
  onFilesChange?: (files: File[]) => void;
  /** Passed to the file input, for example "image/*,.pdf". */
  accept?: string;
  /** Allow more than one file (default true). */
  multiple?: boolean;
  name?: string;
  /** Text of the empty zone; the words in <u> read as the link to the picker. */
  prompt?: React.ReactNode;
  labels?: { title?: string; add?: string; clear?: string; remove?: (name: string) => string };
  /** Rows of list the layout keeps from the start, so nothing below moves (default 3, 0 = none). */
  reserveRows?: number;
  reducedMotion?: boolean;
  className?: string;
}

export function Dropzone({
  onFilesChange,
  accept,
  multiple = true,
  name,
  prompt = (
    <span>
      Drop files here or <u>browse</u>
    </span>
  ),
  labels,
  reserveRows,
  reducedMotion,
  className,
}: DropzoneProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const changeRef = React.useRef(onFilesChange);
  changeRef.current = onFilesChange;
  const id = React.useId();

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createDropzone({
      root: ref.current,
      multiple,
      labels,
      reserveRows,
      reduced: reducedMotion,
      onChange: (files: File[]) => changeRef.current?.(files),
    }) as unknown as DropzoneApi;
    return () => api.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, reserveRows, reducedMotion]);

  return (
    <div ref={ref} className={cx('am-dropzone', className)}>
      <input id={`${id}-input`} type="file" className="am-dropzone-input" accept={accept} multiple={multiple} name={name} />
      <label className="am-dropzone-prompt" htmlFor={`${id}-input`}>
        {prompt}
      </label>
    </div>
  );
}

export default Dropzone;
