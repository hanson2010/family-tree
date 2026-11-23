'use client';

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { linkSite } from '@/lib/web-link';
import { cn } from '@/lib/utils';

/** Wikipedia's mark: a serif W in a circle (drawn here, so no request goes to the site) */
function WikipediaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#202122" strokeWidth="1.5" />
      <text x="12" y="16.6" textAnchor="middle" fontFamily="'Linux Libertine','Georgia','Times New Roman',serif" fontSize="13" fill="#202122">
        W
      </text>
    </svg>
  );
}

/** 百度百科: 百 on Baidu blue (drawn here, so no request goes to the site) */
function BaiduBaikeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#2932e1" />
      <text x="12" y="16.8" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
        百
      </text>
    </svg>
  );
}

/** A person's web link: Wikipedia and 百度百科 by their icon and name, other sites by host name */
export function WebLink({ href, className }: { href: string; className?: string }) {
  const { t } = useLocale();
  const { site, host } = linkSite(href);
  const label = site === 'wikipedia' ? t('wikipedia') : site === 'baidu-baike' ? t('baiduBaike') : host;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className={cn('inline-flex max-w-full items-center gap-1.5 text-primary hover:underline', className)}
    >
      {site === 'wikipedia' ? (
        <WikipediaIcon className="h-4 w-4 shrink-0" />
      ) : site === 'baidu-baike' ? (
        <BaiduBaikeIcon className="h-4 w-4 shrink-0" />
      ) : (
        <ExternalLink className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </a>
  );
}
