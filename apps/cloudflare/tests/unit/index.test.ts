import { describe, expect, it } from 'vitest';

import { __test__ } from '../../src/index';

describe('cloudflare helpers', () => {
  it('accepts only bearer tokens that match the configured secret', () => {
    expect(__test__.isAuthorized('Bearer secret-token', 'secret-token')).toBe(true);
    expect(__test__.isAuthorized('bearer secret-token', 'secret-token')).toBe(true);
    expect(__test__.isAuthorized('Token secret-token', 'secret-token')).toBe(false);
    expect(__test__.isAuthorized('Bearer wrong-token', 'secret-token')).toBe(false);
    expect(__test__.isAuthorized(undefined, 'secret-token')).toBe(false);
    expect(__test__.isAuthorized('Bearer secret-token', undefined)).toBe(false);
  });

  it('accepts only http and https urls', () => {
    expect(__test__.isHttpUrl('https://zhblogs.dev')).toBe(true);
    expect(__test__.isHttpUrl('http://127.0.0.1:9501/check')).toBe(true);
    expect(__test__.isHttpUrl('ftp://zhblogs.dev')).toBe(false);
    expect(__test__.isHttpUrl('not-a-url')).toBe(false);
    expect(__test__.isHttpUrl(undefined)).toBe(false);
  });

  it('verifies html and feed content signatures', () => {
    expect(__test__.verifyContent('<html><body>ok</body></html>')).toBe(true);
    expect(__test__.verifyContent('<rss><channel><item>1</item></channel></rss>')).toBe(true);
    expect(__test__.verifyContent('<feed><entry>1</entry></feed>')).toBe(true);
    expect(__test__.verifyContent('plain text response')).toBe(false);
  });

  it('counts rss items and atom entries', () => {
    expect(
      __test__.countFeedItems('<rss><channel><item>a</item><item>b</item></channel></rss>'),
    ).toBe(2);
    expect(
      __test__.countFeedItems('<feed><entry>a</entry><entry>b</entry><entry>c</entry></feed>'),
    ).toBe(3);
    expect(__test__.countFeedItems('<rss><channel></channel></rss>')).toBe(0);
  });

  it('classifies common upstream errors', () => {
    expect(__test__.classifyError('request timeout')).toBe('TIMEOUT');
    expect(__test__.classifyError('AbortError: aborted')).toBe('TIMEOUT');
    expect(__test__.classifyError('tls handshake failed')).toBe('SSL_ERROR');
    expect(__test__.classifyError('certificate verify failed')).toBe('SSL_ERROR');
    expect(__test__.classifyError('dns lookup failed')).toBe('DNS_ERROR');
    expect(__test__.classifyError('no such host')).toBe('DNS_ERROR');
    expect(__test__.classifyError('getaddrinfo ENOTFOUND example.com')).toBe('DNS_ERROR');
    expect(__test__.classifyError('gai_strerror(status) = Name or service not known')).toBe(
      'DNS_ERROR',
    );
    expect(__test__.classifyError('status=502')).toBe('HTTP_ERROR');
    expect(__test__.classifyError('socket hang up')).toBe('FAILURE');
  });
});
