'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeft, KeyRound, Loader2, UserRound } from 'lucide-react';
import { Header } from '@/components/Header';
import { SignInMethods } from '@/components/SignInMethods';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/LocaleProvider';

/** The signed-in account: who it is, its sign-in methods (link another), and API tokens */
export default function AccountPage() {
  const { t } = useLocale();
  const { data: session, status } = useSession();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('backToTree')}
        </Link>

        <h1 className="font-display flex items-center gap-2 text-2xl font-semibold">
          <UserRound className="h-6 w-6" />
          {t('account')}
        </h1>

        {status === 'loading' ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !session ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('accountSignIn')}</p>
            <Button className="mt-4" onClick={() => signIn(undefined, { callbackUrl: '/account' })}>
              {t('signIn')}
            </Button>
          </div>
        ) : (
          <>
            <section className="flex items-center gap-4 rounded-xl border bg-card p-5">
              {session.user?.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full border"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
                  {(session.user?.name || '?').slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{session.user?.name}</p>
                {session.user?.email && <p className="truncate text-sm text-muted-foreground">{session.user.email}</p>}
              </div>
            </section>

            <SignInMethods />

            <Link
              href="/tokens"
              className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              {t('apiTokens')}
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
