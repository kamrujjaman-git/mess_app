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

export type ProfileUpdateResponse = ProfileUpdateSuccess | ProfileUpdateFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isProfileUpdateResponse(value: unknown): value is ProfileUpdateResponse {
  if (!isRecord(value)) return false;
  if (value.ok === true) {
    return typeof value.name === "string" &&
      (typeof value.photoURL === "string" || value.photoURL === null);
  }
  return value.ok === false &&
    typeof value.error === "string" &&
    typeof value.step === "string";
}
