'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { LocaleProvider } from '@/components/LocaleProvider';
import { KinshipSettingsProvider } from '@/components/KinshipSettingsProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <KinshipSettingsProvider>
          {children}
          <Toaster />
        </KinshipSettingsProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
