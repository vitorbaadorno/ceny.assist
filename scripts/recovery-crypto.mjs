import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function recoveryKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new Error("Chave de recuperação inválida.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Chave de recuperação inválida.");
  return key;
}
export function encryptRecovery(bytes, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("ceny-recovery-v1"));
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([Buffer.from("CENY1"), iv, cipher.getAuthTag(), data]);
}
export function decryptRecovery(bytes, key) {
  if (bytes.subarray(0, 5).toString() !== "CENY1" || bytes.length < 33)
    throw new Error("Cópia inválida.");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(5, 17));
  decipher.setAAD(Buffer.from("ceny-recovery-v1"));
  decipher.setAuthTag(bytes.subarray(17, 33));
  return Buffer.concat([decipher.update(bytes.subarray(33)), decipher.final()]);
}
