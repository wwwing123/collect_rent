import { callRentApi } from './api.js';

let _openid = null;
let _isAdmin = null;

export async function getOpenId() {
  if (_openid) return _openid;
  const res = await callRentApi('getOpenId');
  _openid = res.openid;
  _isAdmin = res.isAdmin;
  return _openid;
}

export async function isAdmin() {
  if (_isAdmin === null) await getOpenId();
  return _isAdmin === true;
}

export async function joinFamily(code) {
  const res = await callRentApi('joinFamily', { code });
  _isAdmin = true;
  return res;
}

export function clearSession() {
  _openid = null;
  _isAdmin = null;
}
