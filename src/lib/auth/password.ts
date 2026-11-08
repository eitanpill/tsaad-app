import "server-only";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

/** argon2id (הערך 2 ב־enum של הספרייה). פרמטרים לפי המלצת OWASP: 19 MiB, 2 איטרציות, חוט אחד. */
const ARGON2ID = 2 as Algorithm;
export const ARGON2_PARAMS = Object.freeze({
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const hashPassword = (password: string) => hash(password, ARGON2_PARAMS);

/** מחזיר false (ולא זורק) על hash פגום. */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * מריץ אימות מול hash דמה, כדי שמשתמש שלא קיים (או שלא הופעל) יעלה אותו זמן כמו סיסמה שגויה.
 * הסיסמה של ה־hash הדמה אקראית ולא ידועה.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  await verifyPassword(await dummyHash, password);
  return false;
}

export { validatePassword, passwordRequirements, type PasswordIssue } from "./policy";
