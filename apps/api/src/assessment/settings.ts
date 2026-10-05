import { SettingsService } from "../settings/settings.service";

/** Tunable in the SystemSetting table without a deploy (PRD section 15). */
export interface AssessmentSettings {
  sessionMinutes: number;
  maxSessions: number;
  integrityReviewThreshold: number;
  minConfidence: number;
  maxDisagreement: number;
  minProviders: number;
  defaultPassThreshold: number;
}

export const ASSESSMENT_DEFAULTS: AssessmentSettings = {
  sessionMinutes: 60,
  maxSessions: 2,
  integrityReviewThreshold: 60,
  minConfidence: 0.6,
  maxDisagreement: 20,
  minProviders: 2,
  defaultPassThreshold: 70,
};

export async function loadAssessmentSettings(svc: SettingsService): Promise<AssessmentSettings> {
  const out = { ...ASSESSMENT_DEFAULTS };
  for (const k of Object.keys(ASSESSMENT_DEFAULTS) as (keyof AssessmentSettings)[]) {
    const v = await svc.get<number>(`assessment.${k}`, ASSESSMENT_DEFAULTS[k]);
    out[k] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : ASSESSMENT_DEFAULTS[k];
  }
  return out;
}
