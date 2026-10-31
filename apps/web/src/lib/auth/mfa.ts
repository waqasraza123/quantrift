export type MfaChallenge = {
  mfaRequired: true;
  nextAction: "enroll" | "verify";
  expiresAt: string;
};

export type MfaStatus = Pick<MfaChallenge, "nextAction" | "expiresAt">;
export type MfaSetup = { secret: string; otpauthUri: string; issuer: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMfaStatus(value: unknown): value is MfaStatus {
  return isRecord(value) && (value.nextAction === "enroll" || value.nextAction === "verify")
    && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt));
}

export function isMfaChallenge(value: unknown): value is MfaChallenge {
  return isMfaStatus(value) && isRecord(value) && value.mfaRequired === true;
}

export function isMfaSetup(value: unknown): value is MfaSetup {
  if (!isRecord(value) || typeof value.secret !== "string" || !/^[A-Z2-7]{32}$/.test(value.secret)
    || typeof value.otpauthUri !== "string" || value.otpauthUri.length > 1024
    || typeof value.issuer !== "string" || !value.issuer.trim()) return false;
  try {
    const uri = new URL(value.otpauthUri);
    return uri.protocol === "otpauth:" && uri.hostname === "totp" && uri.searchParams.get("secret") === value.secret;
  } catch {
    return false;
  }
}

export function isRecoveryCodes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 10 && value.every((code) => typeof code === "string" && /^[a-f0-9]{8}(-[a-f0-9]{8}){3}$/.test(code));
}
