import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildPublicPages({ output, origin, pages, links }) {
  const linkItems = links.map(link => {
    if (!/^https:\/\//.test(link.url)) throw new Error('Public links must use HTTPS.');
    return `<li><a href="${escape(link.url)}" rel="noreferrer">${escape(link.label)}</a></li>`;
  }).join('');
  for (const page of pages) {
    if (!/^\/[a-z0-9-]+\.html$/.test(page.path)) throw new Error('Invalid public page path.');
    const sections = page.sections.map(section => `<section><h2>${escape(section.heading)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('');
    const canonical = origin ? `<link rel="canonical" href="${origin}${page.path}"><meta property="og:url" content="${origin}${page.path}">` : '';
    writeFileSync(resolve(output, page.path.slice(1)), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="${origin ? 'index,follow' : 'noindex,follow'}">
<meta property="og:type" content="website"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}">${canonical}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>@font-face{font-family:Sora;src:url('/fonts/sora-latin.woff2') format('woff2');font-weight:600;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#172033;font:17px/1.7 system-ui,sans-serif}main{max-width:780px;margin:auto;padding:32px 22px}nav{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:14px}a{color:#285dcf;text-underline-offset:3px}a:focus-visible{outline:2px solid #285dcf;outline-offset:4px}h1{font-size:2rem;line-height:1.2;margin:36px 0 20px}h2{font-size:1.25rem;line-height:1.3;margin-top:32px}footer{margin-top:36px;padding-top:24px;border-top:1px solid #d1dbe8;font-size:14px}.maker{position:relative;display:inline-block;font:600 20px/1.25 Sora,sans-serif;letter-spacing:-.015em;padding-bottom:.32em;margin-left:5px}.maker:after{content:'';position:absolute;bottom:0;right:0;width:1.3em;height:.13em;background:#285dcf}section{overflow-wrap:anywhere}</style>
</head><body><main><nav aria-label="Product navigation"><a href="/">Open Typedo</a><a href="/guide.html">Practice guide</a><a href="/privacy.html">Privacy</a><a href="/support.html">Help &amp; feedback</a></nav>
<h1>${escape(page.title.split(' | ')[0])}</h1><p>${escape(page.description)}</p>${sections}
${page.path === '/support.html' ? `<section><h2>Send feedback</h2><ul>${linkItems}</ul></section>` : ''}
<footer>Made by <span class="maker">sunaissu</span></footer></main></body></html>\n`);
  }
}
