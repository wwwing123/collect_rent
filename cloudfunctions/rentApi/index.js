const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const { computeBill } = require('./billing');
const { computeVacancyBills } = require('./vacancy');

const SEED_ROOMS = [
  { code: '101',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '201',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '301',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '302',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '401',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '402',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
  { code: '朗枝岗170号',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, status: 'active' },
];

async function isAuthorized(openid) {
  const { total } = await db.collection('admins').where({ _id: openid }).count();
  return total > 0;
}

async function ensureFirstAdmin(openid) {
  const { total } = await db.collection('admins').count();
  if (total === 0) {
    await db.collection('admins').add({
      data: { _id: openid, name: '管理员', created_at: new Date() },
    });
  }
  return await isAuthorized(openid);
}

async function seedRoomsIfEmpty() {
  const { total } = await db.collection('rooms').count();
  if (total === 0) {
    for (const room of SEED_ROOMS) {
      await db.collection('rooms').add({
        data: {
          ...room,
          _openid: 'system',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }
  }
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (e) {
    console.warn(`createCollection(${name}) failed:`, e.message);
  }
}

async function setInviteCode() {
  await ensureCollection('app_config');
  const code = generateCode();
  try {
    await db.collection('app_config').doc('inviteCode').set({
      data: { code, created_at: new Date() },
    });
  } catch (e) {
    await db.collection('app_config').add({
      data: { _id: 'inviteCode', code, created_at: new Date() },
    });
  }
  return code;
}

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function requireAuth(handler) {
  return async (ctx) => {
    if (!await isAuthorized(ctx.openid)) return { errCode: 'NOT_AUTHORIZED' };
    return await handler(ctx);
  };
}

async function nextReceiptNo() {
  await ensureCollection('counters');
  const updateRes = await db.collection('counters').doc('receipt_no').update({
    data: { value: _.inc(1), updated_at: new Date() },
  });
  if (updateRes.stats.updated > 0) {
    const res = await db.collection('counters').doc('receipt_no').get();
    return res.data.value;
  }
  try {
    await db.collection('counters').add({
      data: { _id: 'receipt_no', value: 1, created_at: new Date(), updated_at: new Date() },
    });
    return 1;
  } catch (e) {
    const retryRes = await db.collection('counters').doc('receipt_no').update({
      data: { value: _.inc(1), updated_at: new Date() },
    });
    const res = await db.collection('counters').doc('receipt_no').get();
    return res.data.value;
  }
}

const handlers = {
  getOpenId: async ({ openid }) => {
    const ok = await ensureFirstAdmin(openid);
    return { openid, isAdmin: ok };
  },
  seedRooms: async () => {
    await seedRoomsIfEmpty();
    return { ok: true };
  },
  getRooms: requireAuth(async () => {
    const { data } = await db.collection('rooms').orderBy('code', 'asc').get();
    return { rooms: data };
  }),
  upsertRoom: requireAuth(async ({ openid, event }) => {
    const r = event.room;
    if (!r || !r.code) return { errCode: 'INVALID_INPUT' };
    const { _id } = r;
    delete r._id;
    const data = {
      ...r,
      updated_at: new Date(),
    };
    if (_id) {
      await db.collection('rooms').doc(_id).update({ data });
    } else {
      const { total } = await db.collection('rooms').where({ code: r.code }).count();
      if (total > 0) return { errCode: 'ROOM_CODE_DUPLICATE' };
      data._openid = openid;
      data.created_at = new Date();
      await db.collection('rooms').add({ data });
    }
    return { ok: true };
  }),
  getPrevBill: requireAuth(async ({ event }) => {
    const { roomId, yearMonth } = event;
    if (!roomId || !yearMonth) return { errCode: 'INVALID_INPUT' };
    const { data } = await db.collection('bills').where({
      room_id: roomId,
      year_month: _.lt(yearMonth),
    }).orderBy('year_month', 'desc').limit(1).get();
    return { prev: data[0] || null };
  }),
  getBill: requireAuth(async ({ event }) => {
    const { roomId, yearMonth } = event;
    const { data } = await db.collection('bills').where({
      room_id: roomId,
      year_month: yearMonth,
    }).limit(1).get();
    return { bill: data[0] || null };
  }),
  upsertBill: requireAuth(async ({ openid, event }) => {
    const { roomId, yearMonth, water_reading, elec_reading } = event;
    if (!roomId || !yearMonth) return { errCode: 'INVALID_INPUT' };
    if (typeof water_reading !== 'number' || typeof elec_reading !== 'number') {
      return { errCode: 'INVALID_READING' };
    }

    const roomRes = await db.collection('rooms').doc(roomId).get();
    const room = roomRes.data;
    if (!room) return { errCode: 'ROOM_NOT_FOUND' };

    const prevRes = await db.collection('bills').where({
      room_id: roomId,
      year_month: _.lt(yearMonth),
    }).orderBy('year_month', 'desc').limit(1).get();
    const prevBill = prevRes.data[0] || null;

    const result = computeBill(room, prevBill, { water_reading, elec_reading });

    const doc = {
      room_id: roomId,
      year_month: yearMonth,
      water_reading,
      elec_reading,
      water_fee: result.water_fee,
      elec_fee: result.elec_fee,
      base_fee: result.base_fee,
      rent: room.rent,
      garbage_fee: room.garbage_fee,
      internet_fee: room.internet_fee,
      total: result.total,
      updated_at: new Date(),
    };

    const existingRes = await db.collection('bills').where({
      room_id: roomId,
      year_month: yearMonth,
    }).limit(1).get();
    const existing = existingRes.data[0];

    if (existing) {
      doc._openid = existing._openid;
      doc.vacancy = false;
      await db.collection('bills').doc(existing._id).update({ data: doc });
      return { ok: true, _id: existing._id };
    } else {
      doc._openid = openid;
      doc.created_at = new Date();
      const addRes = await db.collection('bills').add({ data: doc });
      return { ok: true, _id: addRes._id };
    }
  }),
  getHistory: requireAuth(async ({ event }) => {
    const { roomId, limit = 12, offset = 0 } = event;
    const { data } = await db.collection('bills').where({ room_id: roomId })
      .orderBy('year_month', 'desc')
      .skip(offset)
      .limit(limit)
      .get();
    return { bills: data };
  }),
  syncVacancyMonths: requireAuth(async ({ openid, event }) => {
    const { roomId } = event;
    let roomIds;
    if (roomId) {
      roomIds = [roomId];
    } else {
      const { data: rooms } = await db.collection('rooms').where({ status: 'active' }).get();
      roomIds = rooms.map(r => r._id);
    }
    let inserted = 0;
    for (const rid of roomIds) {
      const { data: bills } = await db.collection('bills').where({ room_id: rid }).get();
      const toInsert = computeVacancyBills(bills, rid);
      for (const rec of toInsert) {
        await db.collection('bills').add({
          data: { ...rec, _openid: openid, created_at: new Date(), updated_at: new Date() },
        });
        inserted += 1;
      }
    }
    return { syncedRooms: roomIds.length, inserted };
  }),
  getInviteCode: requireAuth(async () => {
    return { code: await setInviteCode() };
  }),
  regenerateInviteCode: requireAuth(async () => {
    return { code: await setInviteCode() };
  }),
  nextReceiptNo: requireAuth(async () => {
    const value = await nextReceiptNo();
    const no = String(value).padStart(6, '0');
    return { receiptNo: no };
  }),
  joinFamily: async ({ openid, event }) => {
    const { code } = event;
    if (!code) return { errCode: 'INVALID_INPUT' };
    await ensureCollection('app_config');
    const { data } = await db.collection('app_config').doc('inviteCode').get();
    if (!data || data.code !== code) return { errCode: 'BAD_CODE' };
    const dup = await db.collection('admins').where({ _id: openid }).count();
    if (dup.total > 0) return { ok: true };
    await db.collection('admins').add({
      data: { _id: openid, name: '管理员', created_at: new Date() },
    });
    return { ok: true };
  },
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const ctx = { openid: wxContext.OPENID, event };
  const handler = handlers[event.type];
  if (!handler) return { errCode: 'UNKNOWN_TYPE', type: event.type };
  try {
    return await handler(ctx);
  } catch (e) {
    console.error(e.stack);
    return { errCode: 'INTERNAL', message: e.message };
  }
};
