// Set SITE_ORIGIN to the final HTTPS origin when building a public release.
// An unset origin creates a preview that asks crawlers not to index it.
export function searchPlugin({ origin = '' } = {}) {
  if (origin) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || !/^[a-z0-9.-]+$/i.test(url.hostname)) {
      throw new Error('SITE_ORIGIN must be an HTTPS origin without a path or trailing slash.');
    }
  }
  return {
    name: 'typedo-search',
    transformIndexHtml() {
      const tags = [{ tag: 'meta', attrs: { name: 'robots', content: origin ? 'index,follow' : 'noindex,follow' } }];
      if (origin) tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/` } },
        { tag: 'meta', attrs: { property: 'og:url', content: `${origin}/` } },
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Typedo',
          url: `${origin}/`, applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web browser', browserRequirements: 'Requires JavaScript',
          description: 'Typing speed tests, guided lessons, and progress saved in your browser.',
          publisher: { '@type': 'Organization', name: 'Sunaissu' },
        }).replace(/</g, '\\u003c') },
      );
      return tags;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: origin
        ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
        : 'User-agent: *\nAllow: /\n' });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source:
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? `<url><loc>${origin}/</loc></url>` : ''}</urlset>` });
    },
  };
}
