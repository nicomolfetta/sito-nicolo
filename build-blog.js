// build-blog.js
// Genera blog/articles.json leggendo gli articoli presenti nella cartella blog/.
// Gira su Netlify ad ogni deploy. Make non deve più toccare articles.json.

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, 'blog');
const OUT = path.join(BLOG_DIR, 'articles.json');

const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// decodifica le entità HTML più comuni
function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// legge un <meta ... attr="key" ... content="..."> in qualsiasi ordine,
// usando una backreference sul delimitatore così gli apostrofi dentro
// content="...l'azienda..." non rompono il match
function meta(html, attr, key) {
  const k = ESC(key);
  let m = html.match(new RegExp('<meta[^>]*\\b' + attr + '=(["\\\'])' + k + '\\1[^>]*\\bcontent=(["\\\'])([\\s\\S]*?)\\2', 'i'));
  if (m) return decode(m[3]);
  m = html.match(new RegExp('<meta[^>]*\\bcontent=(["\\\'])([\\s\\S]*?)\\1[^>]*\\b' + attr + '=(["\\\'])' + k + '\\3', 'i'));
  return m ? decode(m[2]) : '';
}

function titleTag(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).replace(/\s*\|\s*Nicol.*$/i, '').trim() : '';
}

function humanize(slug) {
  return slug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

const files = fs.readdirSync(BLOG_DIR)
  .filter(f => f.toLowerCase().endsWith('.html') && f.replace(/\s/g, '').toLowerCase() !== 'index.html');

const articoli = [];
let warnings = 0;

for (const f of files) {
  const slug = f.replace(/\.html$/i, '').trim();

  // intercetta i nomi file sporchi (newline/spazi → il bug %0A)
  if (f !== slug + '.html') {
    console.warn('⚠️  Nome file anomalo: "' + JSON.stringify(f) + '" → andrebbe rinominato in "' + slug + '.html"');
    warnings++;
    continue; // non lo metto in lista: il link sarebbe rotto comunque
  }

  const html = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');

  const titolo   = meta(html, 'property', 'og:title') || titleTag(html) || humanize(slug);
  const estratto = meta(html, 'name', 'description') || meta(html, 'property', 'og:description') || '';

  let data = meta(html, 'property', 'article:published_time');
  if (!data) {
    data = fs.statSync(path.join(BLOG_DIR, f)).mtime.toISOString().slice(0, 10);
    console.warn('⚠️  "' + f + '" senza tag data → uso la data del file (' + data + '). Aggiungi il tag article:published_time.');
    warnings++;
  }
  data = data.slice(0, 10);

  articoli.push({ slug, titolo, estratto, data });
}

articoli.sort((a, b) => new Date(b.data) - new Date(a.data));
fs.writeFileSync(OUT, JSON.stringify(articoli, null, 2), 'utf8');

console.log('\n✅ articles.json generato — ' + articoli.length + ' articoli' + (warnings ? ' (' + warnings + ' avvisi)' : ''));
articoli.forEach(a => console.log('   • ' + a.data + '  ' + a.slug));
