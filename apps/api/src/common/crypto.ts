import { createHash, randomBytes } from "crypto";

/** 256-bit random token, URL-safe. The raw value goes to the user; only its hash is stored. */
export const newToken = (): string => randomBytes(32).toString("base64url");

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
