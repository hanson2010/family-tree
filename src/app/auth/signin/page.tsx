'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useLocale } from '@/components/LocaleProvider';

function SignInContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <AuthCard title={t('appName')} subtitle={t('signInSubtitle')}>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t('signInError')}
        </div>
      )}

      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border bg-card text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <GoogleIcon className="h-5 w-5" />
        {t('signInWithGoogle')}
      </button>

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
