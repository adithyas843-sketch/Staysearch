// Rule-based "is this a private, standalone cottage?" scorer.
// Returns { score: -100..100, reasons: [...] }. Works without any API key.

const POSITIVE = [
  [/independent (cottage|villa|unit|room)/i, 30, 'Independent cottage'],
  [/stand[- ]?alone|detached cottage|separate (building|cottage|block)/i, 30, 'Standalone building'],
  [/private (cottage|entrance|sit[- ]?out|deck|balcony|patio|garden)/i, 20, 'Private entrance/outdoor space'],
  [/entire (cottage|villa|place|unit)|whole cottage/i, 25, 'Entire place for you'],
  [/stilt (cottage|house)|wooden cottage|glass cottage|cabin/i, 15, 'Cottage/cabin style'],
  [/(complete|total|full|utmost) privacy|secluded/i, 15, 'Privacy mentioned'],
  [/attached (bath|toilet|washroom)|ensuite|en-suite|private bath/i, 10, 'Private bathroom'],
  [/couples?[- ]friendly|honeymoon/i, 5, 'Suited to couples'],
];

const NEGATIVE = [
  [/room in a (villa|home|house|property)|private room in/i, -35, 'Room inside a larger house'],
  [/shared (living|lounge|kitchen|bath|toilet|common|space|area)|common (area|space)s?/i, -25, 'Shared spaces'],
  [/(live|stay|stays) with (the |our )?(host|family)|host family|main house/i, -25, 'Shared with host/family'],
  [/dormitor|hostel|bunk|shared room/i, -45, 'Dorm/shared room'],
  [/homestay/i, -8, 'Homestay (often shared)'],
  [/(\d+)\s*(rooms?|bedrooms?).*(shared|common)/i, -10, 'Multiple rooms, shared access'],
];

export function scoreListing(text) {
  let score = 0;
  const reasons = [];
  const pros = [];
  const cons = [];
  for (const [re, pts, label] of POSITIVE) if (re.test(text)) { score += pts; pros.push(label); }
  for (const [re, pts, label] of NEGATIVE) if (re.test(text)) { score += pts; cons.push(label); }
  // The word "cottage" must actually appear for a cottage search.
  if (!/cottage|cabin|villa|chalet/i.test(text)) { score -= 30; cons.push('No cottage mentioned'); }
  score = Math.max(-100, Math.min(100, score));
  return { score, pros, cons };
}

// Pulls plausible nightly prices (INR) out of page text.
export function extractPrices(text) {
  const out = [];
  const re = /(?:₹|rs\.?|inr)\s*([\d,]{3,6})/gi;
  let m;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (n >= 500 && n <= 60000) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
