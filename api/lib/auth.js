// يتحقق أن الطلب قادم من أدمن مسجّل دخوله في Firebase (بدون أي مكتبات إضافية).
// المتغيرات المطلوبة في Vercel: FIREBASE_API_KEY , ADMIN_UIDS
async function requireAdmin(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) { res.status(401).json({ error: 'غير مصرح' }); return null; }

  const key = process.env.FIREBASE_API_KEY;
  const admins = String(process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!key || !admins.length) { res.status(500).json({ error: 'الخادم غير مهيأ (FIREBASE_API_KEY / ADMIN_UIDS)' }); return null; }

  let r;
  try {
    r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: m[1] })
    });
  } catch (_) { res.status(502).json({ error: 'تعذر التحقق من الهوية' }); return null; }

  if (!r.ok) { res.status(401).json({ error: 'جلسة غير صالحة' }); return null; }
  const d = await r.json().catch(() => ({}));
  const user = d.users && d.users[0];
  if (!user || !admins.includes(user.localId)) { res.status(403).json({ error: 'ليس لديك صلاحية' }); return null; }
  return user;
}

function onlyPost(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return false; }
  return true;
}

module.exports = { requireAdmin, onlyPost };
