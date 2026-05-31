// Pull "total hours" out of a SET e-Learning certificate PDF.
// SET certs print a line like:  รวมระยะเวลา 1 ชั่วโมง   /   "Total time: 1 hour"

let _getDocument;
async function loadPdfjs() {
  if (!_getDocument) {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
    _getDocument = mod.getDocument;
  }
  return _getDocument;
}

export async function extractPdfText(buffer) {
  const getDocument = await loadPdfjs();
  const data = new Uint8Array(buffer);
  const task = getDocument({ data, useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;
  let all = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    all += content.items.map(it => it.str || '').join(' ') + '\n';
  }
  await doc.cleanup();
  return all;
}

// SET e-Learning certs encode duration two ways:
//   short courses → "รวมระยะเวลา 60 นาที" (minutes)
//   longer ones   → "รวมระยะเวลา 2 ชั่วโมง" or mixed "1 ชั่วโมง 30 นาที"
// We normalize everything to hours, rounded to 0.5 increments.
function num(s) { return parseFloat(String(s).replace(',', '.')); }
function roundHalf(h) { return Math.round(h * 2) / 2; }

export function extractCertHours(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');

  // Thai: (รวม)?ระยะเวลา … with hours and/or minutes (order can vary, either may be missing).
  const thai = t.match(
    /(?:รวม\s*)?ระยะ\s*เวลา\s*(?:การ\s*อบรม\s*|การ\s*เรียน\s*รู้\s*|การ\s*เรียน\s*)?(?:([0-9]+(?:[.,][0-9]+)?)\s*ชั่ว?\s*โมง)?\s*(?:([0-9]+(?:[.,][0-9]+)?)\s*นาที)?/
  );
  if (thai && (thai[1] || thai[2])) {
    const hours = thai[1] ? num(thai[1]) : 0;
    const minutes = thai[2] ? num(thai[2]) : 0;
    const total = hours + minutes / 60;
    if (total > 0) return roundHalf(total);
  }

  // English: "Total time: 1 hour 30 minutes" / "Duration: 90 minutes"
  const en = t.match(
    /(?:total(?:\s+time)?|duration)\s*[:\-]?\s*(?:([0-9]+(?:[.,][0-9]+)?)\s*(?:hours?|hrs?))?\s*(?:([0-9]+(?:[.,][0-9]+)?)\s*(?:minutes?|mins?))?/i
  );
  if (en && (en[1] || en[2])) {
    const hours = en[1] ? num(en[1]) : 0;
    const minutes = en[2] ? num(en[2]) : 0;
    const total = hours + minutes / 60;
    if (total > 0) return roundHalf(total);
  }

  // Last resort: exactly one "N ชั่วโมง" or "N นาที" mention anywhere in the doc.
  const hourMatches = [...t.matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*ชั่ว?\s*โมง/g)];
  const minMatches = [...t.matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*นาที/g)];
  if (hourMatches.length === 1 && minMatches.length === 0) {
    return roundHalf(num(hourMatches[0][1]));
  }
  if (minMatches.length === 1 && hourMatches.length === 0) {
    return roundHalf(num(minMatches[0][1]) / 60);
  }

  return null;
}

export function extractCertDate(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const thaiMatch = t.match(/([0-9]{1,2})\s+([ก-ฮะ-์]+)\s+([0-9]{4})/);
  if (thaiMatch) {
    const d = parseInt(thaiMatch[1], 10);
    const mStr = thaiMatch[2];
    let y = parseInt(thaiMatch[3], 10);
    const mIndex = thaiMonths.findIndex(m => m === mStr);
    if (mIndex !== -1) {
      if (y > 2400) y -= 543;
      const mm = (mIndex + 1 < 10 ? '0' : '') + (mIndex + 1);
      const dd = (d < 10 ? '0' : '') + d;
      return `${y}-${mm}-${dd}`;
    }
  }

  const enMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const enMatch = t.match(/([0-9]{1,2})\s+([a-zA-Z]+)\s+([0-9]{4})|([a-zA-Z]+)\s+([0-9]{1,2})[,\s]+([0-9]{4})/);
  if (enMatch) {
    let d, mStr, y;
    if (enMatch[1]) {
      d = parseInt(enMatch[1], 10);
      mStr = enMatch[2].toLowerCase();
      y = parseInt(enMatch[3], 10);
    } else {
      mStr = enMatch[4].toLowerCase();
      d = parseInt(enMatch[5], 10);
      y = parseInt(enMatch[6], 10);
    }
    const mIndex = enMonths.findIndex(m => mStr.startsWith(m.substring(0, 3)));
    if (mIndex !== -1) {
      const mm = (mIndex + 1 < 10 ? '0' : '') + (mIndex + 1);
      const dd = (d < 10 ? '0' : '') + d;
      return `${y}-${mm}-${dd}`;
    }
  }

  return null;
}
