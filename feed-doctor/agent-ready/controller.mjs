// Monotonic requests: input edits, a sample request and cancellation all invalidate
// older work, even if a transport ignores AbortSignal.
export function createLatest(){let version=0,controller=null;return {begin(){controller?.abort();controller=new AbortController();const id=++version;return {signal:controller.signal,current:()=>id===version};},cancel(){version++;controller?.abort();}};}
