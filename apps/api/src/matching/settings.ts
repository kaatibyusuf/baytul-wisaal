import { SettingsService } from "../settings/settings.service";

/** Tunable in the SystemSetting table without a deploy (PRD section 15). */
export interface MatchingSettings {
  /** 1 = people must finish the programme before the form and matching. 0 = off (testing only). */
  requireProgramme: number;
  minScore: number;
  maxNonNegotiable: number;
  withdrawCooldownDays: number;
}

export const MATCHING_DEFAULTS: MatchingSettings = {
  requireProgramme: 1,
  minScore: 0.6,
  maxNonNegotiable: 6,
  withdrawCooldownDays: 7,
};

export async function loadMatchingSettings(svc: SettingsService): Promise<MatchingSettings> {
  const out = { ...MATCHING_DEFAULTS };
  for (const k of Object.keys(MATCHING_DEFAULTS) as (keyof MatchingSettings)[]) {
    const v = await svc.get<number>(`matching.${k}`, MATCHING_DEFAULTS[k]);
    out[k] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : MATCHING_DEFAULTS[k];
  }
  return out;
}
