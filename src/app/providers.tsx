'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { LocaleProvider } from '@/components/LocaleProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        {children}
        <Toaster />
      </LocaleProvider>
    </SessionProvider>
  );
}
