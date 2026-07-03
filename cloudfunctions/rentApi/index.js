const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const { computeBill } = require('./billing');

const SEED_ROOMS = [
  { code: '101',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '201',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '301',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '302',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '401',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '402',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
  { code: '旧屋',  name: '', rent: 0, water_unit_price: 0, elec_unit_price: 0, garbage_fee: 0, internet_fee: 0, initial_water_reading: 0, initial_elec_reading: 0, status: 'active' },
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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const t = event.type;

  try {
    switch (t) {
      case 'getOpenId': {
        const ok = await ensureFirstAdmin(openid);
        return { openid, isAdmin: ok };
      }
      case 'seedRooms': {
        await seedRoomsIfEmpty();
        return { ok: true };
      }
      case 'getRooms': {
        if (!await isAuthorized(openid)) return { errCode: 'NOT_AUTHORIZED' };
        const { data } = await db.collection('rooms').orderBy('code', 'asc').get();
        return { rooms: data };
      }
      default:
        return { errCode: 'UNKNOWN_TYPE', type: t };
    }
  } catch (e) {
    return { errCode: 'INTERNAL', message: e.message };
  }
};
