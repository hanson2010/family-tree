import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import https from 'node:https';
import { isIP } from 'node:net';

/**
 * Fetch an image from a web address given by a client, without letting the address reach the
 * server's own network (SSRF): https only, public IP addresses only (checked when connecting, so a
 * DNS change after the check does not help), at most 3 redirects, a size limit and a timeout.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
}

const IPV4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including the cloud metadata server 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
];

/** Whether an IP address is on the public internet (not private, loopback, link-local, …) */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return !IPV4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return ((n & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    // IPv4-mapped and IPv4-compatible forms are judged by their IPv4 address
    const mapped = /^::(ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[2]);
    if (lower === '::' || lower === '::1') return false;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
    if (lower.startsWith('64:ff9b:')) return false; // NAT64, may reach IPv4 internal ranges
    if (lower.startsWith('2001:db8:')) return false; // documentation
    return true;
  }
  return false;
}

/** DNS lookup for the connection itself that refuses any non-public address */
const safeLookup = (
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new UnsafeUrlError('The address points to a private network.'), { code: 'EUNSAFE' }), '');
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
};

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid web address.');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('Only https:// addresses are fetched.');
  if (url.username || url.password) throw new UnsafeUrlError('Addresses with a user name or password are not fetched.');
  if (url.port && url.port !== '443') throw new UnsafeUrlError('Only the standard https port is allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError('The address points to a private network.');
  return url;
}

function getOnce(url: URL, maxBytes: number): Promise<{ redirect?: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { lookup: safeLookup as never, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'family-tree-avatar-fetch', Accept: 'image/*' } },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({ redirect: new URL(response.headers.location, url).toString() });
        }
        if (status !== 200) {
          response.resume();
          return reject(new UnsafeUrlError(`The address answered with status ${status}.`));
        }
        if (Number(response.headers['content-length'] ?? 0) > maxBytes) {
          response.destroy();
          return reject(new UnsafeUrlError('The image is larger than 10MB.'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            reject(new UnsafeUrlError('The image is larger than 10MB.'));
          } else chunks.push(chunk);
        });
        response.on('end', () => resolve({ body: Buffer.concat(chunks) }));
        response.on('error', reject);
      }
    );
    request.on('timeout', () => request.destroy(new UnsafeUrlError('The address took too long to answer.')));
    request.on('error', (error) => reject(error instanceof UnsafeUrlError ? error : new UnsafeUrlError(`The image could not be fetched: ${error.message}`)));
  });
}

/** The bytes at a public https address, following at most 3 redirects, each checked again */
export async function fetchPublicImage(raw: string, maxBytes: number): Promise<Buffer> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { redirect, body } = await getOnce(url, maxBytes);
    if (body) return body;
    url = checkUrl(redirect!);
  }
  throw new UnsafeUrlError('Too many redirects.');
}
