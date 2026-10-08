import express from 'express';
import * as cheerio from 'cheerio';
import { scoreListing, extractPrices } from './scorer.js';

const app = express();
app.use(express.static('public'));

const { BRAVE_API_KEY, ANTHROPIC_API_KEY, ANTHROPIC_MODEL = 'claude-sonnet-5-5', PORT = 3000 } = process.env;
const UA = 'Mozilla/5.0 (compatible; CottageFinder/1.0)';

// ---- 1. Discovery: find candidate listing pages ----------------------------
// To add a source, write another function returning [{title,url,snippet}].
async function braveSearch(q) {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=15&q=${encodeURIComponent(q)}`, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Search API error ${r.status}`);
  const j = await r.json();
  return (j.web?.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.description || '' }));
}

// ---- 2. Read the page ------------------------------------------------------
async function readPage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const $ = cheerio.load(await r.text());
    $('script,style,nav,footer,noscript').remove();
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
  } catch { return ''; }
}

// ---- 3. Optional deep read with Claude --------------------------------------
async function deepRead(text) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system: 'You judge accommodation listings. Reply with JSON only, no markdown.',
        messages: [{ role: 'user', content:
          `Is this a PRIVATE, STANDALONE cottage (a separate building or unit the guest has to themselves), as opposed to a room in a shared house/homestay/resort block? ` +
          `Return {"private_cottage":boolean,"confidence":0-100,"reason":"one sentence","price_per_night_inr":number|null}.\n\nLISTING:\n${text.slice(0, 6000)}` }],
      }),
    });
    const j = await r.json();
    return JSON.parse(j.content[0].text.replace(/```json|```/g, '').trim());
  } catch { return null; }
}

// ---- API -------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  if (!BRAVE_API_KEY) return res.status(500).json({ error: 'Set BRAVE_API_KEY in your environment.' });
  const area = (req.query.area || 'Coorg').toString();
  const maxPrice = Number(req.query.maxPrice) || Infinity;
  try {
    const queries = [
      `private independent cottage ${area} for couples`,
      `${area} standalone cottage coffee estate stay`,
      `${area} cottage airbnb OR booking.com OR makemytrip`,
    ];
    const hits = (await Promise.all(queries.map(braveSearch))).flat();
    const unique = [...new Map(hits.map(h => [h.url, h])).values()].slice(0, 20);

    const results = await Promise.all(unique.map(async h => {
      const page = await readPage(h.url);
      const text = `${h.title}. ${h.snippet}. ${page}`;
      const rule = scoreListing(text);
      const ai = rule.score > -20 ? await deepRead(text) : null; // only spend AI on plausible ones
      const prices = extractPrices(text);
      const price = ai?.price_per_night_inr || prices[0] || null;
      const isCottage = ai ? ai.private_cottage && ai.confidence >= 60 : rule.score >= 30;
      return { ...h, score: ai ? ai.confidence : rule.score, pros: rule.pros, cons: rule.cons,
               reason: ai?.reason || null, price, isCottage };
    }));

    const cottages = results
      .filter(r => r.isCottage && (!r.price || r.price <= maxPrice))
      .sort((a, b) => b.score - a.score);
    res.json({ checked: unique.length, deepRead: !!ANTHROPIC_API_KEY, cottages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Cottage Finder on http://localhost:${PORT}`));
