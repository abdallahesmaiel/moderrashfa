// POST /api/cloudinary-sign   { folder }  ->  توقيع رفع مؤقت (صالح دقائق)
// المتغيرات: CLOUDINARY_CLOUD_NAME , CLOUDINARY_API_KEY , CLOUDINARY_API_SECRET , (اختياري) CLOUDINARY_UPLOAD_PRESET
const crypto = require('crypto');
const { requireAdmin, onlyPost } = require('./_lib/auth');

const ALLOWED_FOLDERS = ['rashfa-products', 'rashfa-promo', 'rashfa-logo'];

module.exports = async (req, res) => {
  if (!onlyPost(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  const missing = [['CLOUDINARY_CLOUD_NAME', cloud], ['CLOUDINARY_API_KEY', apiKey], ['CLOUDINARY_API_SECRET', secret]].filter(x => !x[1]).map(x => x[0]);
  if (missing.length) return res.status(500).json({ error: 'متغيرات ناقصة في Vercel: ' + missing.join(', '), code: 'MISSING_ENV' });

  const folder = String((req.body || {}).folder || '');
  if (!ALLOWED_FOLDERS.includes(folder)) return res.status(400).json({ error: 'مجلد غير مسموح' });

  const preset = process.env.CLOUDINARY_UPLOAD_PRESET || 'rashfa_preset';
  const timestamp = Math.floor(Date.now() / 1000);
  // الأحرف مرتبة أبجديًا كما يشترط Cloudinary
  const toSign = `folder=${folder}&timestamp=${timestamp}&upload_preset=${preset}`;
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex');

  return res.status(200).json({ cloud_name: cloud, api_key: apiKey, timestamp, folder, upload_preset: preset, signature });
};
