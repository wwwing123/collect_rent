export async function callRentApi(type, data = {}) {
  const res = await wx.cloud.callFunction({ name: 'rentApi', data: { type, ...data } });
  if (res.result && res.result.errCode) {
    const err = new Error(res.result.errCode);
    err.code = res.result.errCode;
    throw err;
  }
  return res.result;
}
