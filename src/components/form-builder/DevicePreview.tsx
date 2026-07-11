import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { BuilderDevice } from './types';

export interface DevicePreviewProps {
  device: BuilderDevice;
  children: ReactNode;
  title?: string;
  showChrome?: boolean;
  className?: string;
}

const DEVICE_WIDTH: Record<BuilderDevice, string> = {
  desktop: 'w-full max-w-[880px]',
  tablet: 'w-full max-w-[768px]',
  mobile: 'w-full max-w-[390px]',
};

const DEVICE_LABEL: Record<BuilderDevice, string> = {
  desktop: 'desktop',
  tablet: 'tablet',
  mobile: 'ponsel',
};

export function DevicePreview({
  device,
  children,
  title = 'Pratinjau formulir',
  showChrome = true,
  className = '',
}: DevicePreviewProps) {
  const isHandheld = device !== 'desktop';

  return (
    <section
      aria-label={`${title} pada perangkat ${DEVICE_LABEL[device]}`}
      className={`mx-auto transition-[max-width] duration-300 ease-out ${DEVICE_WIDTH[device]} ${className}`}
      data-builder-device={device}
    >
      <div
        className={`overflow-hidden border bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.32)] dark:border-zinc-700 dark:bg-zinc-950 ${
          isHandheld
            ? 'rounded-[28px] border-zinc-300 ring-4 ring-zinc-950/90'
            : 'rounded-2xl border-zinc-200'
        }`}
      >
        {showChrome && (
          <div
            aria-hidden="true"
            className={`flex h-10 items-center border-b border-zinc-200 bg-zinc-100/90 px-3 dark:border-zinc-800 dark:bg-zinc-900 ${
              isHandheld ? 'justify-center' : 'gap-3'
            }`}
          >
            {isHandheld ? (
              <div className="h-1.5 w-16 rounded-full bg-zinc-800 dark:bg-zinc-600" />
            ) : (
              <>
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="mx-auto flex h-6 min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
                  <LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" />
                  <span className="truncate">portal.spscorner.store/forms/preview</span>
                </div>
                <div className="w-10" />
              </>
            )}
          </div>
        )}

        <div className="min-h-[520px] bg-white dark:bg-zinc-950">{children}</div>

        {showChrome && isHandheld && (
          <div aria-hidden="true" className="flex h-7 items-center justify-center bg-white dark:bg-zinc-950">
            <div className="h-1 w-24 rounded-full bg-zinc-900/80 dark:bg-zinc-600" />
          </div>
        )}
      </div>
    </section>
  );
}

export default DevicePreview;
