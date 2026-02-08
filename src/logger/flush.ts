import type { Logger } from 'pino';

type FlushableLogger = Logger & {
  flush: (cb: (err?: Error) => void) => void;
};

function hasFlush(log: Logger): log is FlushableLogger {
  return 'flush' in log && typeof (log as unknown as { flush?: unknown }).flush === 'function';
}

export async function flushLogger(log: Logger): Promise<void> {
  if (!hasFlush(log)) return;

  await new Promise<void>((resolve, reject) => {
    log.flush((err?: Error) => (err ? reject(err) : resolve()));
  });
}
