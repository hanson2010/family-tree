/** A person's web link: one http(s) address, e.g. their Wikipedia or 百度百科 page */

export const MAX_LINK_LENGTH = 2000;
export const MAX_DESCRIPTION_LENGTH = 5000;

/** True for an absolute http:// or https:// address */
export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
  } catch {
    return false;
  }
}

export type LinkSite = 'wikipedia' | 'baidu-baike' | 'other';

/** The site a link points to, and the host name to show for other sites (www. dropped) */
export function linkSite(value: string): { site: LinkSite; host: string } {
  let host = '';
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return { site: 'other', host: value };
  }
  if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) return { site: 'wikipedia', host };
  if (host === 'baike.baidu.com' || host.endsWith('.baike.baidu.com')) return { site: 'baidu-baike', host };
  return { site: 'other', host: host.replace(/^www\./, '') };
}
