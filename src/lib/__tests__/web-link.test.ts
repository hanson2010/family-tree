import { describe, expect, it } from 'vitest';
import { isWebUrl, linkSite } from '../web-link';

describe('isWebUrl', () => {
  it('accepts absolute http and https addresses only', () => {
    expect(isWebUrl('https://zh.wikipedia.org/wiki/甄英莲')).toBe(true);
    expect(isWebUrl('http://example.com')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('ftp://example.com')).toBe(false);
    expect(isWebUrl('zh.wikipedia.org/wiki/x')).toBe(false);
  });
});

describe('linkSite', () => {
  it('recognizes Wikipedia in any language', () => {
    expect(linkSite('https://zh.wikipedia.org/wiki/香菱').site).toBe('wikipedia');
    expect(linkSite('https://en.m.wikipedia.org/wiki/Dream_of_the_Red_Chamber').site).toBe('wikipedia');
  });

  it('recognizes 百度百科', () => {
    expect(linkSite('https://baike.baidu.com/item/香菱').site).toBe('baidu-baike');
  });

  it('shows other sites by host name without www.', () => {
    expect(linkSite('https://www.example.com/a')).toEqual({ site: 'other', host: 'example.com' });
    expect(linkSite('https://notwikipedia.org/x').site).toBe('other');
    expect(linkSite('https://www.baidu.com/s?wd=x').site).toBe('other');
  });
});
