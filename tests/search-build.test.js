import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlugin } from '../searchBuild.js';

test('preview builds omit canonical URLs and request noindex without blocking crawlers', () => {
  const plugin = searchPlugin();
  assert.deepEqual(plugin.transformIndexHtml(), [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex,follow' } }]);
  const assets = [];
  plugin.generateBundle.call({ emitFile: asset => assets.push(asset) });
  assert.match(assets[0].source, /Allow: \//);
  assert.doesNotMatch(assets[1].source, /<loc>/);
});

test('public builds use the configured origin consistently', () => {
  const plugin = searchPlugin({ origin: 'https://typing.example.com' });
  const tags = plugin.transformIndexHtml();
  assert.equal(tags.find(tag => tag.attrs.rel === 'canonical').attrs.href, 'https://typing.example.com/');
  assert.equal(JSON.parse(tags.find(tag => tag.tag === 'script').children).url, 'https://typing.example.com/');
  const assets = [];
  plugin.generateBundle.call({ emitFile: asset => assets.push(asset) });
  assert.match(assets[0].source, /Sitemap: https:\/\/typing.example.com\/sitemap.xml/);
  assert.match(assets[1].source, /<loc>https:\/\/typing.example.com\/<\/loc>/);
});

test('invalid deployment URLs fail instead of producing misleading search metadata', () => {
  for (const origin of ['http://example.com', 'https://example.com/', 'https://example.com/app', 'https://user:pass@example.com', 'https://example.com?x=1', 'https://example.com#x', 'invalid']) {
    assert.throws(() => searchPlugin({ origin }));
  }
});
