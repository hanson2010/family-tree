'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { getProviders, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/AuthCard';
import { GoogleIcon } from '@/components/GoogleIcon';
import { GitHubIcon } from '@/components/GitHubIcon';
import { useLocale } from '@/components/LocaleProvider';
import type { TranslationKey } from '@/lib/i18n';

/** Sign-in buttons in this order; a provider not set up on the site is not shown */
const PROVIDERS: { id: string; label: TranslationKey; Icon: typeof GoogleIcon }[] = [
  { id: 'google', label: 'signInWithGoogle', Icon: GoogleIcon },
  { id: 'github', label: 'signInWithGitHub', Icon: GitHubIcon },
];

function SignInContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');
  const [available, setAvailable] = useState<Set<string> | null>(null);

  useEffect(() => {
    getProviders()
      .then((providers) => setAvailable(new Set(Object.keys(providers ?? {}))))
      .catch(() => setAvailable(new Set()));
  }, []);

  const shown = PROVIDERS.filter((p) => available?.has(p.id));

  return (
    <AuthCard title={t('appName')} subtitle={t('signInSubtitle')}>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t('signInError')}
        </div>
      )}

      {available === null ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t('noSignInProviders')}</p>
      ) : (
        <div className="space-y-3">
          {shown.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => signIn(id, { callbackUrl })}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border bg-card text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Icon className="h-5 w-5" />
              {t(label)}
            </button>
          ))}
        </div>
      )}

      <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        {t('backToTree')}
      </Link>
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
