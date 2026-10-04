/**
 * Brand constants shared by web, admin and email templates.
 * Source of truth: PRD section 58. Keep in sync with apps/web/app/globals.css.
 */
export const brand = {
  nileBlue: "#17334B",
  deepAqua: "#19687E",
  turquoise: "#02D3CB",
  softGold: "#D9A441",
  /** Accessible variants for text/icons on light backgrounds (PRD section 61) */
  aquaInk: "#0E7F86",
  goldInk: "#8A5F0F",
} as const;

export const API_PREFIX = "api/v1";
