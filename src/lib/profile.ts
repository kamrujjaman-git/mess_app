export interface ProfileUpdateSuccess {
  ok: true;
  name: string;
  photoURL: string | null;
}

export interface ProfileUpdateFailure {
  ok: false;
  error: string;
  step: string;
}

export interface ProfileUpdateErrorPayload {
  error: string;
  step?: string;
}

export type ProfileUpdateResponse = ProfileUpdateSuccess | ProfileUpdateFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isProfileUpdateSuccess(value: unknown): value is ProfileUpdateSuccess {
  if (!isRecord(value)) return false;
  return value.ok === true &&
    typeof value.name === "string" &&
    (typeof value.photoURL === "string" || value.photoURL === null);
}

export function isProfileUpdateFailure(value: unknown): value is ProfileUpdateErrorPayload {
  if (!isRecord(value)) return false;
  return (value.ok === undefined || value.ok === false) &&
    typeof value.error === "string" &&
    value.error.trim().length > 0 &&
    (value.step === undefined || typeof value.step === "string");
}
