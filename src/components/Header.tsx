'use client';

import * as React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Languages, LogIn, LogOut, PanelLeft, Settings } from 'lucide-react';
import { KinshipSettingsDialog } from '@/components/KinshipSettingsDialog';
import { useLocale } from '@/components/LocaleProvider';
import { Locale } from '@/lib/i18n';

interface HeaderProps {
  /** Opens the search and actions panel on small screens, folds or unfolds it on wide ones */
  onToggleMenu?: () => void;
}

export function Header({ onToggleMenu }: HeaderProps) {
  const { data: session, status } = useSession();
  const { locale, setLocale, t } = useLocale();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const toggleLocale = () => {
    const nextLocale = locale === 'zh' ? 'en' : 'zh';
    setLocale(nextLocale as Locale);
  };

  return (
    <header className="z-30 w-full shrink-0 border-b bg-card">
      <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
        {onToggleMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onToggleMenu}
            title={`${t('openMenu')} ([)`}
            aria-label={t('openMenu')}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Logo */}
        <Link href="/" className="mr-2 flex items-center gap-2.5">
          <BrandMark className="h-8 w-8 rounded-md" />
          <span className="font-display text-lg font-semibold tracking-wide">{t('appName')}</span>
        </Link>

        <div className="flex-1" />

        {/* How kinship terms are worded */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSettingsOpen(true)}
          className="text-muted-foreground"
          aria-label={t('kinshipSettings')}
          title={t('kinshipSettings')}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <KinshipSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        {/* Language toggle */}
        <Button variant="ghost" size="sm" onClick={toggleLocale} className="text-muted-foreground">
          <Languages className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t('toggleLanguage')}</span>
        </Button>

        {/* Account */}
        {status === 'loading' ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ) : session ? (
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              title={t('account')}
              className="ml-1 flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:pr-3"
            >
              {session.user?.image ? (
                // Decorative: the link's title names the page
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  // Google's image server answers 429 to requests with a localhost Referer
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {(session.user?.name || '?').slice(0, 1)}
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
                {session.user?.name}
              </span>
              <span className="sr-only md:hidden">{t('account')}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => signOut({ callbackUrl: '/' })}
              title={t('signOut')}
              aria-label={t('signOut')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="bg-card" onClick={() => signIn()}>
            <LogIn className="mr-2 h-4 w-4" />
            {t('signIn')}
          </Button>
        )}
      </div>
    </header>
  );
}
