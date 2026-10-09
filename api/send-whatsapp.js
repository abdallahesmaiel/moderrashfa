// POST /api/send-whatsapp   { phone, message }
// المتغيرات: CONVOBEST_TOKEN , CONVOBEST_INSTANCE_ID , (اختياري) CONVOBEST_API_URL
const { requireAdmin, onlyPost } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!onlyPost(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const token = process.env.CONVOBEST_TOKEN;
  const instance = process.env.CONVOBEST_INSTANCE_ID;
  if (!token || !instance) return res.status(500).json({ error: 'خدمة الواتساب غير مهيأة' });

  const { phone, message } = req.body || {};
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  const text = String(message || '');
  if (cleanPhone.length < 8 || cleanPhone.length > 15) return res.status(400).json({ error: 'رقم هاتف غير صالح' });
  if (!text.trim() || text.length > 4000) return res.status(400).json({ error: 'نص الرسالة غير صالح' });

  try {
    const r = await fetch(process.env.CONVOBEST_API_URL || 'https://api.convobest.com/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instance, access_token: token, phone: cleanPhone, message: text })
    });
    const d = await r.json().catch(() => ({}));
    const ok = r.ok && (d.success || d.status === 'success' || d.status === 'sent' || d.id);
    // لا نُرجع للمتصفح إلا ما يلزم (بدون أي بيانات حساسة)
    if (ok) return res.status(200).json({ success: true, id: d.id || null });
    return res.status(502).json({ success: false, message: d.message || d.error || 'فشل الإرسال' });
  } catch (_) {
    return res.status(502).json({ success: false, message: 'تعذر الاتصال بخدمة الواتساب' });
  }
};
