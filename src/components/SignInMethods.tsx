'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Check } from 'lucide-react';
import { GoogleIcon } from '@/components/GoogleIcon';
import { GitHubIcon } from '@/components/GitHubIcon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import type { TranslationKey } from '@/lib/i18n';
import type { AccountInfo } from '@/app/api/account/route';
import type { ApiResponse } from '@/types';

/** Sign-in providers in display order */
const PROVIDERS = [
  { id: 'google', name: 'Google', Icon: GoogleIcon },
  { id: 'github', name: 'GitHub', Icon: GitHubIcon },
] as const;

const LINK_MESSAGES: Record<string, TranslationKey> = {
  linked: 'linkDone',
  already: 'linkAlready',
  inUse: 'authErrorAccountInUse',
};

/**
 * The account's sign-in identities. Linking asks the server for a link intent, then signs in with
 * the other provider; the server adds that identity to this account and comes back here with the
 * outcome in the address (?link=…&provider=…).
 */
export function SignInMethods() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result: ApiResponse<AccountInfo> = await (await fetch('/api/account')).json();
      if (result.success && result.data) setAccount(result.data);
    } catch {
      // The section is left out when the account cannot be loaded
    }
  }, []);

  // The outcome of a link attempt, once, then cleared from the address
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('link');
    if (outcome && LINK_MESSAGES[outcome]) {
      const provider = PROVIDERS.find((p) => p.id === params.get('provider'))?.name ?? '';
      toast({
        variant: outcome === 'inUse' ? 'destructive' : 'default',
        title: provider,
        description: t(LINK_MESSAGES[outcome]),
      });
      window.history.replaceState(null, '', window.location.pathname);
    }
    load();
  }, [load, t, toast]);

  const link = async (provider: string) => {
    setBusy(true);
    try {
      const response = await fetch('/api/account/link', { method: 'POST' });
      if (!response.ok) throw new Error();
      await signIn(provider, { callbackUrl: '/account' });
    } catch {
      setBusy(false);
      toast({ variant: 'destructive', title: t('error'), description: t('signInError') });
    }
  };

  const unlink = async (id: string) => {
    setBusy(true);
    try {
      const result: ApiResponse<null> = await (
        await fetch(`/api/account/identities/${encodeURIComponent(id)}`, { method: 'DELETE' })
      ).json();
      if (!result.success) throw new Error(result.error);
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: t('error'), description: error instanceof Error && error.message ? error.message : t('failedToDelete') });
    } finally {
      setBusy(false);
    }
  };

  if (!account) return null;
  const rows = PROVIDERS.filter(
    (p) => account.available.includes(p.id) || account.identities.some((i) => i.provider === p.id)
  );
  if (rows.length === 0) return null;
  const canUnlink = account.identities.length > 1;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-sm font-medium">{t('signInMethods')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('signInMethodsHint')}</p>
      </div>
      <ul className="divide-y">
        {rows.map(({ id, name, Icon }) => {
          const identities = account.identities.filter((i) => i.provider === id);
          return (
            <li key={id} className="flex items-center gap-3 py-2">
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{name}</p>
                {identities.map((i) => (
                  <p key={i.id} className="truncate text-xs text-muted-foreground">
                    {i.email ?? i.name ?? t('accountLinked')}
                  </p>
                ))}
              </div>
              {identities.length > 0 ? (
                canUnlink ? (
                  identities.map((i) => (
                    <Button key={i.id} type="button" variant="outline" size="sm" className="bg-card" disabled={busy} onClick={() => unlink(i.id)}>
                      {t('unlinkAccount')}
                    </Button>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Check className="h-4 w-4" />
                    {t('accountLinked')}
                  </span>
                )
              ) : (
                <Button type="button" variant="outline" size="sm" className="bg-card" disabled={busy} onClick={() => link(id)}>
                  {t('linkAccount')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
