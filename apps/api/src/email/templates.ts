export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const NILE = "#17334B";
const AQUA = "#19687E";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }) {
  const paras = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${NILE};">${esc(p)}</p>`)
    .join("");
  const button = opts.cta
    ? `<p style="margin:28px 0;"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:${NILE};color:#ffffff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:6px;">${esc(opts.cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5b6b7a;">If the button does not work, copy this link into your browser:<br><a href="${esc(opts.cta.url)}" style="color:${AQUA};word-break:break-all;">${esc(opts.cta.url)}</a></p>`
    : "";
  const foot = opts.footnote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5b6b7a;">${esc(opts.footnote)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f8f9;font-family:Raleway,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">
      <tr><td style="background:${NILE};padding:20px 28px;color:#ffffff;font-size:20px;font-weight:600;">Baytul Wisaal</td></tr>
      <tr><td style="padding:32px 28px;">
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${NILE};">${esc(opts.heading)}</h1>
        ${paras}${button}${foot}
      </td></tr>
    </table>
    <p style="max-width:560px;margin:16px 0 0;font-size:12px;color:#5b6b7a;">Marriage is a big deal, and we are going to treat it as such.</p>
  </td></tr></table></body></html>`;
}

const plain = (lines: string[]) => lines.join("\n\n");

export const templates = {
  verifyEmail(name: string, url: string): EmailContent {
    const paragraphs = [
      `Assalamu alaikum ${name},`,
      "Thank you for starting your journey with Baytul Wisaal. Please confirm your email address to activate your account.",
    ];
    return {
      subject: "Confirm your email address",
      html: layout({
        heading: "Confirm your email",
        paragraphs,
        cta: { label: "Confirm email", url },
        footnote: "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
      }),
      text: plain([...paragraphs, `Confirm your email: ${url}`, "This link expires in 24 hours."]),
    };
  },

  accountExists(name: string, resetUrl: string): EmailContent {
    const paragraphs = [
      `Assalamu alaikum ${name},`,
      "Someone tried to create a Baytul Wisaal account with this email address, but you already have one. If that was you, you can sign in, or reset your password if you have forgotten it.",
    ];
    return {
      subject: "You already have a Baytul Wisaal account",
      html: layout({
        heading: "You already have an account",
        paragraphs,
        cta: { label: "Reset password", url: resetUrl },
        footnote: "If this was not you, no action is needed.",
      }),
      text: plain([...paragraphs, `Reset your password: ${resetUrl}`]),
    };
  },

  passwordReset(name: string, url: string): EmailContent {
    const paragraphs = [
      `Assalamu alaikum ${name},`,
      "We received a request to reset your password. Use the button below to choose a new one.",
    ];
    return {
      subject: "Reset your password",
      html: layout({
        heading: "Reset your password",
        paragraphs,
        cta: { label: "Choose a new password", url },
        footnote: "This link expires in 1 hour and works once. If you did not ask for this, you can ignore this email and your password will not change.",
      }),
      text: plain([...paragraphs, `Reset your password: ${url}`, "This link expires in 1 hour."]),
    };
  },
};
