// POST /api/cloudinary-delete   { public_id }
// المتغيرات: CLOUDINARY_CLOUD_NAME , CLOUDINARY_API_KEY , CLOUDINARY_API_SECRET
const crypto = require('crypto');
const { requireAdmin, onlyPost } = require('./_lib/auth');

const ALLOWED_FOLDERS = ['rashfa-products', 'rashfa-promo', 'rashfa-logo'];

module.exports = async (req, res) => {
  if (!onlyPost(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  const missing = [['CLOUDINARY_CLOUD_NAME', cloud], ['CLOUDINARY_API_KEY', apiKey], ['CLOUDINARY_API_SECRET', secret]].filter(x => !x[1]).map(x => x[0]);
  if (missing.length) return res.status(500).json({ error: 'متغيرات ناقصة في Vercel: ' + missing.join(', '), code: 'MISSING_ENV' });

  const publicId = String((req.body || {}).public_id || '');
  const inAllowedFolder = ALLOWED_FOLDERS.some(f => publicId.startsWith(f + '/'));
  if (!inAllowedFolder || publicId.includes('..') || !/^[\w\-\/.]+$/.test(publicId)) {
    return res.status(400).json({ error: 'معرف صورة غير مسموح' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1')
    .update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${secret}`).digest('hex');

  try {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature, invalidate: 'true' })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && (d.result === 'ok' || d.result === 'not found')) return res.status(200).json({ success: true, result: d.result });
    return res.status(502).json({ success: false, error: (d.error && d.error.message) || 'فشل الحذف' });
  } catch (_) {
    return res.status(502).json({ success: false, error: 'تعذر الاتصال بـ Cloudinary' });
  }
};
