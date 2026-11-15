'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { buttonVariants } from '@/components/ui/button';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';

function ErrorContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const message =
    error === 'Configuration'
      ? t('authErrorConfiguration')
      : error === 'AccessDenied'
        ? t('authErrorAccessDenied')
        : t('authErrorDefault');

  return (
    <AuthCard title={t('authErrorTitle')} subtitle={message}>
      <Link href="/auth/signin" className={cn(buttonVariants(), 'h-11 w-full')}>
        {t('tryAgain')}
      </Link>
      <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        {t('backToTree')}
      </Link>
    </AuthCard>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
