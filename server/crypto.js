import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

let secret = null;

// One server secret, created on first run. Every per-player code and seed is
// derived from it, so it never leaves the server.
export function loadSecret(file) {
  if (process.env.NIGHTSHIFT_SECRET) {
    secret = Buffer.from(process.env.NIGHTSHIFT_SECRET);
    return;
  }
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  secret = Buffer.from(readFileSync(file, "utf8").trim());
}

export const sha256 = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

export const newToken = () => randomBytes(32).toString("hex");

export const newId = () => randomBytes(9).toString("base64url");

const hmac = (...parts) =>
  createHmac("sha256", secret).update(parts.join("\u0000")).digest();

// Crockford-ish alphabet: no 0/O or 1/I/L to misread on paper.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short code only this player can produce, e.g. for a hidden egg. */
export function playerCode(playerId, label, length = 8) {
  const bytes = hmac("code", playerId, label);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** A stable integer seed for generating a personal variant of a case. */
export function playerSeed(playerId, label) {
  return hmac("seed", playerId, label).readUInt32BE(0);
}

const PASS_WORDS = (
  "amber anchor archive atlas badge beacon binder bolt cactus candle " +
  "cipher cobalt comet compass copper corridor crane dawn delta desk " +
  "drawer ember falcon ferry fiber filing flint fox glacier harbor " +
  "hinge index ivory jade kettle lantern ledger lemon locker maple " +
  "marble meadow memo mint monsoon nickel nimbus oasis orbit otter " +
  "pantry pebble pepper pixel plaza printer quartz quill radar raven " +
  "relay ribbon river saffron signal silver sparrow stapler static " +
  "storm summit tango thistle timber toner tulip velvet vertex walnut " +
  "willow window zephyr"
).split(" ");

export function newPassphrase() {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => PASS_WORDS[b % PASS_WORDS.length]).join("-");
}

export function hashSecret(value) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(value), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifySecret(value, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(String(value), Buffer.from(saltHex, "hex"), 32);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
