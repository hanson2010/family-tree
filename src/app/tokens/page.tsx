'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { ArrowLeft, Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import type { ApiTokenInfo } from '@/lib/api-tokens';
import type { ApiResponse } from '@/types';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 bg-card"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function CodeBlock({ code, copyLabel }: { code: string; copyLabel: string }) {
  return (
    <div className="flex items-start gap-2">
      {/* Long lines wrap, so a whole command can be read before it is copied */}
      <pre
        className="min-w-0 flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs leading-relaxed"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        <code>{code}</code>
      </pre>
      <CopyButton text={code} label={copyLabel} />
    </div>
  );
}

export default function TokensPage() {
  const { status } = useSession();
  const { t, locale } = useLocale();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<ApiTokenInfo[] | null>(null);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<{ token: string; info: ApiTokenInfo } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState('/api/mcp');

  useEffect(() => setEndpoint(`${window.location.origin}/api/mcp`), []);

  const load = useCallback(async () => {
    const result: ApiResponse<ApiTokenInfo[]> = await (await fetch('/api/tokens')).json();
    if (result.success) setTokens(result.data ?? []);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result: ApiResponse<{ token: string; info: ApiTokenInfo }> = await response.json();
      if (!result.success || !result.data) throw new Error(result.error || t('failedToSave'));
      setCreated(result.data);
      setName('');
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: t('error'), description: error instanceof Error ? error.message : t('failedToSave') });
    } finally {
      setIsCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const response = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
    setConfirmingId(null);
    if (!response.ok) {
      toast({ variant: 'destructive', title: t('error'), description: t('failedToDelete') });
      return;
    }
    if (created?.info.id === id) setCreated(null);
    toast({ title: t('tokenRevoked') });
    await load();
  };

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const cliCommand = (token: string) =>
    `claude mcp add --scope project --transport http family-tree ${endpoint} --header "Authorization: Bearer ${token}"`;
  const jsonConfig = (token: string) =>
    JSON.stringify(
      { mcpServers: { 'family-tree': { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${token}` } } } },
      null,
      2
    );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('backToTree')}
        </Link>

        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-semibold">
            <KeyRound className="h-6 w-6" />
            {t('apiTokens')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('apiTokensDescription')}</p>
        </div>

        {status === 'loading' ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : status !== 'authenticated' ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('apiTokensSignIn')}</p>
            <Button className="mt-4" onClick={() => signIn(undefined, { callbackUrl: '/tokens' })}>
              {t('signIn')}
            </Button>
          </div>
        ) : (
          <>
            <section className="space-y-2 rounded-xl border bg-card p-5">
              <Label>{t('mcpEndpoint')}</Label>
              <CodeBlock code={endpoint} copyLabel={t('copy')} />
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-5">
              <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="token-name">{t('tokenName')}</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('tokenNamePlaceholder')}
                    maxLength={60}
                  />
                </div>
                <Button type="submit" disabled={isCreating || !name.trim()}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('createToken')}
                </Button>
              </form>

              {created && (
                <div className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                  <div>
                    <p className="font-medium">{t('tokenCreatedTitle').replace('{name}', created.info.name)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('tokenShownOnce')}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">1. {t('tokenStepCopy')}</p>
                    <CodeBlock code={created.token} copyLabel={t('copy')} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">2. {t('tokenStepConnect')}</p>
                    <p className="text-sm text-muted-foreground">{t('tokenSetupClaudeCode')}</p>
                    <CodeBlock code={cliCommand(created.token)} copyLabel={t('copy')} />
                    <p className="text-sm text-muted-foreground">{t('tokenSetupOther')}</p>
                    <CodeBlock code={jsonConfig(created.token)} copyLabel={t('copy')} />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t('yourTokens')}</h2>
              {tokens === null ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTokens')}</p>
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {tokens.map((token) => (
                    <li key={token.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{token.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          <code>{token.prefix}…</code> · {t('tokenCreated')} {when(token.createdAt)} · {t('tokenLastUsed')}{' '}
                          {when(token.lastUsedAt)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={confirmingId === token.id ? 'destructive' : 'ghost'}
                        size="sm"
                        className={confirmingId === token.id ? '' : 'text-destructive hover:bg-destructive/10 hover:text-destructive'}
                        onClick={() => (confirmingId === token.id ? revoke(token.id) : setConfirmingId(token.id))}
                        onBlur={() => setConfirmingId((id) => (id === token.id ? null : id))}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        {confirmingId === token.id ? t('confirmRevoke') : t('revoke')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
