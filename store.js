import { Redis } from "@upstash/redis";
const useKv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
let kv = null;
if (useKv){
  kv = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN
  });
}
const memory = new Map();
async function get(key){ 
  if (useKv) return await kv.get(key);
  return memory.get(key);
}
async function set(key, val){ 
  if (useKv) return await kv.set(key, val);
  memory.set(key, val); return true;
}
async function push(listKey, val){
  const arr = (await get(listKey)) || [];
  arr.push(val);
  await set(listKey, arr);
  return arr;
}
async function update(listKey, predicateFn, updaterFn){
  const arr = (await get(listKey)) || [];
  const next = arr.map(item => predicateFn(item) ? updaterFn(item) : item);
  await set(listKey, next);
  return next;
}
async function filter(listKey, predicateFn){
  const arr = (await get(listKey)) || [];
  const next = arr.filter(predicateFn);
  await set(listKey, next);
  return next;
}
export default { get, set, push, update, filter };
