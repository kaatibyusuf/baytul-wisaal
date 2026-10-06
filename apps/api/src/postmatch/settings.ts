import { SettingsService } from "../settings/settings.service";
import { COMPAT_DEFAULTS, CompatSettings } from "./rules";

/** Tunable in the SystemSetting table without a deploy (PRD section 15). */
export async function loadCompatSettings(svc: SettingsService): Promise<CompatSettings> {
  const out = { ...COMPAT_DEFAULTS };
  for (const k of Object.keys(COMPAT_DEFAULTS) as (keyof CompatSettings)[]) {
    const v = await svc.get<number>(`compat.${k}`, COMPAT_DEFAULTS[k]);
    out[k] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : COMPAT_DEFAULTS[k];
  }
  return out;
}
