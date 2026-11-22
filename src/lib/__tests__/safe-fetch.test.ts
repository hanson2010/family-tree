// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetchPublicImage, isPublicAddress } from '../safe-fetch';

describe('isPublicAddress', () => {
  it('refuses private, loopback, link-local and metadata addresses', () => {
    ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1']
      .forEach((ip) => expect(isPublicAddress(ip), ip).toBe(false));
  });

  it('refuses the same in IPv6 and IPv4-mapped forms', () => {
    ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254', '64:ff9b::a00:1']
      .forEach((ip) => expect(isPublicAddress(ip), ip).toBe(false));
  });

  it('allows public addresses', () => {
    ['8.8.8.8', '1.1.1.1', '172.32.0.1', '142.250.72.14', '2606:4700:4700::1111', '::ffff:8.8.8.8']
      .forEach((ip) => expect(isPublicAddress(ip), ip).toBe(true));
  });

  it('refuses anything that is not an IP address', () => {
    expect(isPublicAddress('localhost')).toBe(false);
  });
});

describe('fetchPublicImage', () => {
  const refuses = (url: string, message: RegExp) => expect(fetchPublicImage(url, 1024)).rejects.toThrow(message);

  it('fetches only https addresses on the standard port, without credentials', async () => {
    await refuses('http://example.com/a.jpg', /https/);
    await refuses('file:///etc/passwd', /https/);
    await refuses('https://user:pw@example.com/a.jpg', /user name/);
    await refuses('https://example.com:8443/a.jpg', /port/);
    await refuses('not a url', /valid/);
  });

  it('refuses literal private addresses before connecting', async () => {
    await refuses('https://169.254.169.254/computeMetadata/v1/', /private/);
    await refuses('https://127.0.0.1/a.jpg', /private/);
    await refuses('https://[::1]/a.jpg', /private/);
  });

  it('refuses a host name that resolves to a private address', async () => {
    await refuses('https://localhost/a.jpg', /private/);
  });
});
