const enc = new TextEncoder();
const dec = new TextDecoder();
export const ITERATIONS = 600000;
export const b64 = bytes => btoa(Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join(''));
export const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export async function deriveKey(password, salt, iterations = ITERATIONS) {
  if (iterations !== ITERATIONS || unb64(salt).length !== 32) throw new Error('Unsupported vault key settings.');
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt),iterations}, material, {name:'AES-GCM',length:256}, true, ['encrypt','decrypt']);
}
export async function seal(key, value, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(context),tagLength:128}, key, data);
  data.fill(0);
  return {v:1,iv:b64(iv),data:b64(ciphertext)};
}
export async function open(key, envelope, context) {
  if (envelope?.v !== 1 || unb64(envelope.iv).length !== 12) throw new Error('Unsupported encrypted record.');
  const result = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:enc.encode(context),tagLength:128},key,unb64(envelope.data));
  try { return JSON.parse(dec.decode(result)); } finally { new Uint8Array(result).fill(0); }
}
export const exportKey = key => crypto.subtle.exportKey('jwk', key);
export const importKey = jwk => crypto.subtle.importKey('jwk',jwk,{name:'AES-GCM'},true,['encrypt','decrypt']);
export const itemContext = (uid,id) => `pocket-vault:v1:${uid}:item:${id}`;
export const verifierContext = uid => `pocket-vault:v1:${uid}:verifier`;
export function generatePassword(length = 24) {
  if (!Number.isInteger(length) || length < 16 || length > 128) throw new Error('Choose 16–128 characters.');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?';
  const limit = 256 - (256 % alphabet.length);
  let result = '';
  while (result.length < length) {
    for (const x of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (x < limit) result += alphabet[x % alphabet.length];
      if (result.length === length) break;
    }
  }
  return result;
}
