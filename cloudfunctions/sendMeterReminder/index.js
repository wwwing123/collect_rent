const cloud = require('wx-server-sdk');
const { isLastDayOfMonthBeijing, formatBeijingTime } = require('./month-end');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ==== 配置区：改文案/模板改这里，重新部署即可 ====
const TEMPLATE_ID = 'J9g9WGKUHvl40BGLE-k6LZIUTojypWyV8qs2vC7Rudw';
const THING7_TEXT = '月底了，请准时录入水电读数';
// ===============================================

// 部署提示：在微信开发者工具中右键本函数目录 → 上传并部署（云端安装依赖）
// 并勾选「同步云函数本地触发器配置」，否则 config.json 里的定时触发器不会创建

async function listAdminOpenids() {
  const MAX = 100; // 家庭场景管理员远少于 100
  const { data } = await db.collection('admins').limit(MAX).get();
  return data.map((doc) => doc._id);
}

async function sendTo(openid, timeText) {
  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: TEMPLATE_ID,
      // 触发器无 page 上下文，跳首页由用户点消息后自行操作
      page: 'pages/index/index',
      miniprogramState: 'formal',
      data: {
        time2: { value: timeText },
        thing7: { value: THING7_TEXT },
      },
    });
    return { openid, ok: true, res };
  } catch (e) {
    // 43101: 用户未订阅或额度已用尽 —— 预期内，静默
    if (e.errCode === 43101 || (e.errcode === 43101)) {
      return { openid, ok: false, skipped: true };
    }
    console.error(`send failed for ${openid}:`, e.errCode || e.errcode, e.message);
    return { openid, ok: false, skipped: false };
  }
}

exports.main = async () => {
  const now = new Date();
  if (!isLastDayOfMonthBeijing(now)) {
    return { sent: 0, reason: 'not-month-end' };
  }
  const timeText = formatBeijingTime(now);
  const openids = await listAdminOpenids();
  const results = [];
  for (const openid of openids) {
    results.push(await sendTo(openid, timeText));
  }
  const sent = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`meter reminder: sent=${sent} skipped(no-quota)=${skipped} total=${results.length}`);
  return { sent, skipped, total: results.length };
};
