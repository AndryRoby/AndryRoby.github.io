'use client';
// ARLing Motion: One-time code input for React. A thin wrapper: the vanilla component owns
// the digit entrances, the sliding ring, the green circle on success, ARIA and the keyboard.
// In the registry the core lives at '@/lib/arling-motion' and this logic at
// '@/lib/arling-motion/otp'.
import * as React from 'react';
import { createOtp } from '@/lib/arling-motion/otp';

type OtpApi = { clear: () => unknown; success: () => unknown; error: () => unknown; destroy: () => void };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export interface OtpInputProps {
  /** Number of characters (default 6). */
  length?: number;
  /** Accessible name of the field. */
  label?: string;
  /**
   * Runs when every slot is filled. Return true (or a promise of true) to show success,
   * false to mark the code invalid, or nothing and use the ref's success() and error().
   */
  onComplete?: (code: string) => boolean | void | Promise<boolean | void>;
  onValueChange?: (value: string) => void;
  successText?: string;
  errorText?: string;
  name?: string;
  autoFocus?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

export interface OtpInputHandle {
  clear: () => void;
  success: () => void;
  error: () => void;
}

export const OtpInput = React.forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { length = 6, label = 'Verification code', onComplete, onValueChange, successText, errorText, name, autoFocus, reducedMotion, className },
  handle,
) {
  const ref = React.useRef<HTMLDivElement>(null);
  const apiRef = React.useRef<OtpApi | null>(null);
  const completeRef = React.useRef(onComplete);
  const changeRef = React.useRef(onValueChange);
  completeRef.current = onComplete;
  changeRef.current = onValueChange;

  React.useImperativeHandle(handle, () => ({
    clear: () => { apiRef.current?.clear(); },
    success: () => { apiRef.current?.success(); },
    error: () => { apiRef.current?.error(); },
  }), []);

  React.useEffect(() => {
    if (!ref.current) return;
    const api = createOtp({
      root: ref.current,
      length,
      successText,
      errorText,
      reduced: reducedMotion,
      onComplete: (code: string) => completeRef.current?.(code),
      onChange: (v: string) => changeRef.current?.(v),
    }) as unknown as OtpApi;
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, reducedMotion]);

  return (
    <div ref={ref} className={cx('am-otp', className)}>
      <input className="am-otp-input" aria-label={label} maxLength={length} name={name} autoFocus={autoFocus} defaultValue="" />
      <div className="am-otp-slots" aria-hidden="true">
        {Array.from({ length }, (_, j) => (
          <div key={j} className="am-otp-slot">
            <span className="am-otp-ink" />
            <span className="am-otp-char" />
          </div>
        ))}
        <div className="am-otp-ring" />
      </div>
      <div className="am-otp-status" role="status" />
    </div>
  );
});

export default OtpInput;
