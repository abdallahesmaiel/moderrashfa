// يتحقق أن الطلب قادم من أدمن مسجّل دخوله في Firebase.
// يفحص توقيع توكن الجلسة محليًا بشهادات Google العامة (بدون مكتبات وبدون مفتاح API).
// المتغيرات: ADMIN_UIDS (إجباري) , FIREBASE_PROJECT_ID (اختياري، الافتراضي rashfa-9d95d)
const crypto = require('crypto');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { certs: null, exp: 0 };

async function getCerts(force) {
  if (!force && certCache.certs && Date.now() < certCache.exp) return certCache.certs;
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error('certs_unavailable');
  const m = /max-age=(\d+)/.exec(r.headers && r.headers.get ? (r.headers.get('cache-control') || '') : '');
  certCache = { certs: await r.json(), exp: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  return certCache.certs;
}

const b64json = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function verifyIdToken(token, projectId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('bad_format');
  const header = b64json(parts[0]);
  const payload = b64json(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad_header');

  let certs = await getCerts(false);
  if (!certs[header.kid]) certs = await getCerts(true);   // الشهادات تتبدل دوريًا
  const cert = certs[header.kid];
  if (!cert) throw new Error('unknown_key');

  const okSig = crypto.createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(cert, Buffer.from(parts[2], 'base64url'));
  if (!okSig) throw new Error('bad_signature');

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error('expired');
  if (payload.iat && payload.iat > now + 300) throw new Error('bad_iat');
  if (payload.aud !== projectId) throw new Error('wrong_project');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('wrong_issuer');
  if (!payload.sub) throw new Error('no_subject');
  return { uid: payload.sub, email: payload.email || '' };
}

async function requireAdmin(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) { res.status(401).json({ error: 'لم يصل توكن الدخول، سجّل الدخول من جديد.', code: 'NO_TOKEN' }); return null; }

  const admins = String(process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!admins.length) { res.status(500).json({ error: 'المتغير ADMIN_UIDS غير مضاف في Vercel.', code: 'MISSING_ADMIN_UIDS' }); return null; }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'rashfa-9d95d';

  let user;
  try { user = await verifyIdToken(m[1], projectId); }
  catch (e) {
    const msg = e.message || '';
    if (msg === 'certs_unavailable') { res.status(502).json({ error: 'تعذر الاتصال بخوادم Google للتحقق.', code: 'CERTS_UNAVAILABLE' }); return null; }
    const text = msg === 'expired' ? 'انتهت الجلسة، حدّث الصفحة وسجّل الدخول من جديد.'
      : msg === 'wrong_project' || msg === 'wrong_issuer' ? 'مشروع Firebase غير مطابق (FIREBASE_PROJECT_ID).'
      : 'جلسة الدخول غير صالحة.';
    res.status(401).json({ error: text, code: 'BAD_TOKEN_' + msg }); return null;
  }

  if (!admins.includes(user.uid)) {
    // نُظهر الـ UID لصاحب الحساب نفسه ليضيفه في ADMIN_UIDS بسهولة
    res.status(403).json({ error: 'حسابك غير مضاف في ADMIN_UIDS. الـ UID: ' + user.uid, code: 'NOT_ADMIN' });
    return null;
  }
  return user;
}

function onlyPost(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return false; }
  return true;
}

module.exports = { requireAdmin, onlyPost, verifyIdToken };
