import { describe, expect, it } from 'vitest';

import { errorCodes, get, isValid, isValidUrl, parse } from '../src/psl';

describe('psl domain parser', () => {
  it('parses regular listed domains', () => {
    expect(parse('www.example.com')).toMatchObject({
      input: 'www.example.com',
      tld: 'com',
      sld: 'example',
      domain: 'example.com',
      subdomain: 'www',
      listed: true,
    });

    expect(get('www.example.com')).toBe('example.com');
    expect(isValid('example.com')).toBe(true);
  });

  it('parses multi-label public suffixes', () => {
    expect(parse('news.example.co.uk')).toMatchObject({
      tld: 'co.uk',
      sld: 'example',
      domain: 'example.co.uk',
      subdomain: 'news',
      listed: true,
    });
  });

  it('rejects invalid hostname labels', () => {
    expect(parse('-example.com')).toEqual({
      input: '-example.com',
      error: {
        code: 'LABEL_STARTS_WITH_DASH',
        message: errorCodes.LABEL_STARTS_WITH_DASH,
      },
    });

    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('https://-example.com')).toBe(false);
  });

  it('preserves punycoded IDN domains', () => {
    expect(parse('www.xn--85x722f.com.cn')).toMatchObject({
      tld: 'com.cn',
      sld: 'xn--85x722f',
      domain: 'xn--85x722f.com.cn',
      subdomain: 'www',
      listed: true,
    });
  });

  it('treats .local names as non-internet domains', () => {
    expect(parse('service.local')).toMatchObject({
      tld: null,
      sld: null,
      domain: null,
      subdomain: null,
      listed: false,
    });

    expect(isValid('service.local')).toBe(false);
  });

  it('parses unlisted tlds without marking them valid', () => {
    expect(parse('blog.example.invalidtld')).toMatchObject({
      tld: 'invalidtld',
      sld: 'example',
      domain: 'example.invalidtld',
      subdomain: 'blog',
      listed: false,
    });

    expect(isValid('blog.example.invalidtld')).toBe(false);
  });
});
