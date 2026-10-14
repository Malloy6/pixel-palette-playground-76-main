const brandBlue = "#123b6d";
const accent = "#f2b544";
const ink = "#172033";
const muted = "#5b6678";

export function escapeEmailHtml(value: string) {
  return value.replace(
    /[&<>\"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

type EmailButton = { label: string; href: string };

type BrandedEmailInput = {
  title: string;
  preheader?: string;
  eyebrow?: string;
  body: string;
  button?: EmailButton;
  footerNote?: string;
};

export function renderBrandedEmail(input: BrandedEmailInput) {
  const logoUrl = "https://elimusphere.co.ke/elimusphere-logo.png";
  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px"><tr><td style="border-radius:8px;background:${accent}"><a href="${escapeEmailHtml(input.button.href)}" style="display:inline-block;padding:13px 20px;color:${ink};font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none">${escapeEmailHtml(input.button.label)}</a></td></tr></table>`
    : "";
  const footerNote = input.footerNote
    ? `<p style="margin:24px 0 0;color:${muted};font-family:Arial,sans-serif;font-size:13px;line-height:1.6">${input.footerNote}</p>`
    : "";
  const eyebrow = input.eyebrow
    ? `<p style="margin:0 0 10px;color:${accent};font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${escapeEmailHtml(input.eyebrow)}</p>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeEmailHtml(input.title)}</title></head><body style="margin:0;background:#eef3f8;color:${ink}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(input.preheader ?? input.title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef3f8"><tr><td align="center" style="padding:36px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px"><tr><td style="padding:24px 30px;background:${brandBlue};border-radius:14px 14px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><img src="${logoUrl}" width="54" height="54" alt="Elimusphere" style="display:block;border:0;border-radius:50%;background:#fff"></td><td align="right" style="color:#dce9f7;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase">Learning that moves you forward</td></tr></table><p style="margin:15px 0 0;color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:1.5px">ELIMUSPHERE</p></td></tr><tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:38px 34px 32px;background:#fff;border:1px solid #dfe7f0;border-top:0;border-radius:0 0 14px 14px">${eyebrow}<h1 style="margin:0 0 22px;color:${brandBlue};font-family:Arial,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-.2px">${escapeEmailHtml(input.title)}</h1>${input.body}${button}${footerNote}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px"><tr><td style="border-top:1px solid #e5ebf2;padding-top:18px;color:${muted};font-family:Arial,sans-serif;font-size:13px;line-height:1.7">Need help? Reply to this email or contact <a href="mailto:info@elimusphere.co.ke" style="color:${brandBlue};font-weight:700">info@elimusphere.co.ke</a>.<br><span style="color:#8792a3">Elimusphere · Live CBE classes for Kenyan learners</span></td></tr></table></td></tr></table><p style="margin:18px 0 0;color:#8792a3;font-family:Arial,sans-serif;font-size:11px;line-height:1.5;text-align:center">You are receiving this message because of activity on your Elimusphere account.</p></td></tr></table></body></html>`;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 16px;color:${ink};font-family:Arial,sans-serif;font-size:16px;line-height:1.65">${text}</p>`;
}

export function emailDetails(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;border:1px solid #e3eaf2;border-radius:10px;background:#f8fafc;border-collapse:separate;overflow:hidden">${rows.map(([label, value]) => `<tr><td style="padding:13px 15px;border-bottom:1px solid #e8edf3;color:${muted};font-family:Arial,sans-serif;font-size:14px">${escapeEmailHtml(label)}</td><td align="right" style="padding:13px 15px;border-bottom:1px solid #e8edf3;color:${ink};font-family:Arial,sans-serif;font-size:14px;font-weight:700">${escapeEmailHtml(value)}</td></tr>`).join("")}</table>`;
}

export function emailList(items: string[]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px">${items.map((item) => `<tr><td valign="top" style="padding:0 10px 10px 0;color:${accent};font-family:Arial,sans-serif;font-size:18px;line-height:1">&#9679;</td><td style="padding:0 0 10px;color:${ink};font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${item}</td></tr>`).join("")}</table>`;
}
