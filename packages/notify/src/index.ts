/**
 * Email. Templates are plain functions returning { subject, text, html } so they are
 * trivially testable. Wording per language lives in copy.ts.
 * Keep every user-supplied string passed through `esc()`.
 */
import { formatInZone } from "@elearner/core";
import nodemailer, { type Transporter } from "nodemailer";
import { COPY, type MailLocale } from "./copy";

export { MAIL_LOCALES, mailLocale, type MailLocale } from "./copy";

export interface Message {
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(to: string, message: Message): Promise<void>;
}

export function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(title: string, bodyHtml: string, locale: MailLocale): string {
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#F6F7F9;font-family:Arial,'Noto Sans Devanagari',sans-serif;color:#14161F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E3E5EA;border-radius:12px">
<tr><td style="padding:28px 32px"><div style="font-size:20px;font-weight:700;margin-bottom:16px">E-learner</div>
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</td></tr></table>
<p style="font-size:12px;color:#4B5162">${esc(COPY[locale].footer)}</p>
</td></tr></table></body></html>`;
}

const button = (url: string, label: string) =>
  `<p><a href="${esc(url)}" style="display:inline-block;background:#2340D9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${esc(label)}</a></p>`;
const small = (text: string) => `<p style="color:#4B5162;font-size:13px">${text}</p>`;

/** Every template takes the recipient's language last (`User.locale`; English when unknown). */
export const templates = {
  verifyEmail(name: string, url: string, locale: MailLocale = "en"): Message {
    const c = COPY[locale];
    return {
      subject: c.verify.subject,
      text: `${c.hi(name)}\n\n${c.verify.lead.replace(/\.$|।$/, ":")}\n${url}\n\n${c.linkExpires}`,
      html: layout(
        c.verify.title,
        `<p>${esc(c.hi(name))}</p><p>${esc(c.verify.lead)}</p>${button(url, c.verify.button)}${small(esc(c.linkExpires))}`,
        locale,
      ),
    };
  },
  resetPassword(name: string, url: string, locale: MailLocale = "en"): Message {
    const c = COPY[locale];
    return {
      subject: c.reset.subject,
      text: `${c.hi(name)}\n\n${c.reset.title}:\n${url}\n\n${c.reset.ignoreText}`,
      html: layout(
        c.reset.title,
        `<p>${esc(c.hi(name))}</p>${button(url, c.reset.button)}${small(esc(c.reset.ignoreHtml))}`,
        locale,
      ),
    };
  },
  /** First password for an account an admin created. Same link as a reset; different words. */
  invite(name: string, url: string, locale: MailLocale = "en"): Message {
    const c = COPY[locale];
    return {
      subject: c.invite.subject,
      text: `${c.hi(name)}\n\n${c.invite.lead.replace(/\.$|।$/, ":")}\n${url}\n\n${c.linkExpires} ${c.invite.expired}`,
      html: layout(
        c.invite.title,
        `<p>${esc(c.hi(name))}</p><p>${esc(c.invite.lead)}</p>${button(url, c.invite.button)}${small(`${esc(c.linkExpires)} ${esc(c.invite.expired)}`)}`,
        locale,
      ),
    };
  },
  /** Confirms a self-service deletion request. The account can't sign in any more, so cancelling goes via the school. */
  accountDeletion(name: string, purgeOn: string, locale: MailLocale = "en"): Message {
    const c = COPY[locale].deletion;
    return {
      subject: c.subject,
      text: `${COPY[locale].hi(name)}\n\n${c.lead}\n\n${c.when(purgeOn)} ${c.mistake}`,
      html: layout(
        c.title,
        `<p>${esc(COPY[locale].hi(name))}</p><p>${esc(c.lead)}</p><p>${esc(c.when(purgeOn)).replace(esc(purgeOn), `<b>${esc(purgeOn)}</b>`)}</p>${small(esc(c.mistake))}`,
        locale,
      ),
    };
  },
  classReminder(p: {
    name: string;
    classTitle: string;
    courseTitle: string;
    startsAt: Date;
    timeZone: string;
    kind: "24h" | "15m";
    url: string;
    /** Room or place, for classes that meet in person. */
    location?: string | null;
    locale?: MailLocale;
  }): Message {
    const locale = p.locale ?? "en";
    const c = COPY[locale].reminder;
    const when = formatInZone(p.startsAt, p.timeZone, `${locale}-IN`);
    const where = p.location ? `\n${c.where}: ${p.location}` : "";
    const lead = c.lead(p.kind);
    return {
      subject: `${p.classTitle} ${lead}`,
      text: `${COPY[locale].hi(p.name)}\n\n${p.classTitle} (${p.courseTitle}) ${lead} — ${when}.${where}\n${c.join}: ${p.url}`,
      html: layout(
        `${p.classTitle} ${lead}`,
        `<p>${esc(COPY[locale].hi(p.name))}</p><p><b>${esc(p.classTitle)}</b> · ${esc(p.courseTitle)}<br>${esc(when)}${p.location ? `<br>${esc(c.where)}: ${esc(p.location)}` : ""}</p>${button(p.url, c.button)}${small(esc(c.joinHint))}`,
        locale,
      ),
    };
  },
  /** Once a day: unread in-app notifications the person hasn't been emailed about. */
  notificationDigest(p: {
    name: string;
    items: { title: string; body: string; url: string }[];
    /** Unread ones not listed (the email shows the newest few). */
    more: number;
    inboxUrl: string;
    settingsUrl: string;
    locale?: MailLocale;
  }): Message {
    const locale = p.locale ?? "en";
    const c = COPY[locale].digest;
    const subject = c.subject(p.items.length + p.more);
    const list = p.items.map((i) => `- ${i.title}${i.body ? ` — ${i.body}` : ""}\n  ${i.url}`).join("\n");
    const moreText = p.more > 0 ? `\n${c.more(p.more)}` : "";
    const items = p.items
      .map(
        (i) =>
          `<li style="margin-bottom:8px"><a href="${esc(i.url)}" style="color:#2340D9;font-weight:700">${esc(i.title)}</a>${i.body ? `<br><span style="color:#4B5162">${esc(i.body)}</span>` : ""}</li>`,
      )
      .join("");
    const optOut = c.optOutText.slice(0, c.optOutText.length - c.optOutLink.length);
    return {
      subject,
      text: `${COPY[locale].hi(p.name)}\n\n${c.lead}\n\n${list}${moreText}\n\n${c.seeAllText}: ${p.inboxUrl}\n\n${c.optOutText}: ${p.settingsUrl}`,
      html: layout(
        subject,
        `<p>${esc(COPY[locale].hi(p.name))}</p><p>${esc(c.lead)}</p><ul style="padding-left:20px">${items}</ul>${p.more > 0 ? `<p>${esc(c.more(p.more))}</p>` : ""}${button(p.inboxUrl, c.button)}${small(`${esc(optOut)}<a href="${esc(p.settingsUrl)}" style="color:#4B5162">${esc(c.optOutLink)}</a>.`)}`,
        locale,
      ),
    };
  },
};

export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport: Transporter = nodemailer.createTransport(smtpUrl);
  return {
    async send(to, message) {
      await transport.sendMail({
        from,
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}

/** Collects messages in memory — for tests and for local runs without SMTP. */
export function createMemoryMailer(): Mailer & { sent: { to: string; message: Message }[] } {
  const sent: { to: string; message: Message }[] = [];
  return {
    sent,
    async send(to, message) {
      sent.push({ to, message });
    },
  };
}
