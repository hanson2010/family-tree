'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, Github, Globe } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { localeNames, Locale } from '@/lib/i18n';

export function Header() {
  const { data: session, status } = useSession();
  const { locale, setLocale, t } = useLocale();

  const toggleLocale = () => {
    const nextLocale = locale === 'zh' ? 'en' : 'zh';
    setLocale(nextLocale as Locale);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 mr-4">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="font-bold text-lg hidden sm:inline-block">
            {t('appName')}
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLocale}
          className="mr-2"
        >
          <Globe className="h-4 w-4 mr-1" />
          {localeNames[locale]}
        </Button>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          {status === 'loading' ? (
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          ) : session ? (
            <>
              <div className="hidden sm:flex items-center gap-2 mr-2">
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm font-medium">
                  {session.user?.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('signOut')}</span>
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                window.location.href = '/api/auth/signin/github';
              }}
            >
              <Github className="h-4 w-4 mr-2" />
              {t('signInWithGitHub')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
