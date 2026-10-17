/**
 * Email. Templates are plain functions returning { subject, text, html } so they are
 * trivially testable and translatable (add a `locale` arg when hi/mr copy lands).
 * Keep every user-supplied string passed through `esc()`.
 */
import { formatInZone } from "@elearner/core";
import nodemailer, { type Transporter } from "nodemailer";

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

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F7F9;font-family:Arial,sans-serif;color:#14161F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E3E5EA;border-radius:12px">
<tr><td style="padding:28px 32px"><div style="font-size:20px;font-weight:700;margin-bottom:16px">E-learner</div>
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</td></tr></table>
<p style="font-size:12px;color:#4B5162">You received this because you have an E-learner account at your school.</p>
</td></tr></table></body></html>`;
}

const button = (url: string, label: string) =>
  `<p><a href="${esc(url)}" style="display:inline-block;background:#2340D9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${esc(label)}</a></p>`;

export const templates = {
  verifyEmail(name: string, url: string): Message {
    return {
      subject: "Confirm your email for E-learner",
      text: `Hi ${name},\n\nConfirm your email to finish setting up your account:\n${url}\n\nThis link expires in 1 hour.`,
      html: layout(
        "Confirm your email",
        `<p>Hi ${esc(name)},</p><p>Confirm your email to finish setting up your account.</p>${button(url, "Confirm email")}<p style="color:#4B5162;font-size:13px">This link expires in 1 hour.</p>`,
      ),
    };
  },
  resetPassword(name: string, url: string): Message {
    return {
      subject: "Reset your E-learner password",
      text: `Hi ${name},\n\nReset your password here:\n${url}\n\nIf you didn't ask for this, ignore this email.`,
      html: layout(
        "Reset your password",
        `<p>Hi ${esc(name)},</p>${button(url, "Choose a new password")}<p style="color:#4B5162;font-size:13px">If you didn't ask for this, you can ignore this email.</p>`,
      ),
    };
  },
  /** First password for an account an admin created. Same link as a reset; different words. */
  invite(name: string, url: string): Message {
    return {
      subject: "You've been added to E-learner",
      text: `Hi ${name},\n\nYour school added you to E-learner. Choose a password to sign in:\n${url}\n\nThis link expires in 1 hour. If it has expired, use "Forgot password" on the sign-in page.`,
      html: layout(
        "Welcome to E-learner",
        `<p>Hi ${esc(name)},</p><p>Your school added you to E-learner. Choose a password to sign in.</p>${button(url, "Choose a password")}<p style="color:#4B5162;font-size:13px">This link expires in 1 hour. If it has expired, use “Forgot password” on the sign-in page.</p>`,
      ),
    };
  },
  /** Confirms a self-service deletion request. The account can't sign in any more, so cancelling goes via the school. */
  accountDeletion(name: string, purgeOn: string): Message {
    return {
      subject: "Your E-learner account will be deleted",
      text: `Hi ${name},\n\nYou asked us to delete your E-learner account. You've been signed out and can't sign in any more.\n\nYour account and its data will be deleted for good on ${purgeOn}. If this was a mistake, contact your school before then and an admin can cancel it.`,
      html: layout(
        "Your account will be deleted",
        `<p>Hi ${esc(name)},</p><p>You asked us to delete your E-learner account. You've been signed out and can't sign in any more.</p><p>Your account and its data will be deleted for good on <b>${esc(purgeOn)}</b>.</p><p style="color:#4B5162;font-size:13px">If this was a mistake, contact your school before then and an admin can cancel it.</p>`,
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
  }): Message {
    const when = formatInZone(p.startsAt, p.timeZone);
    const where = p.location ? `\nWhere: ${p.location}` : "";
    const lead = p.kind === "15m" ? "starts in 15 minutes" : "is tomorrow";
    return {
      subject: `${p.classTitle} ${lead}`,
      text: `Hi ${p.name},\n\n${p.classTitle} (${p.courseTitle}) ${lead} — ${when}.${where}\nJoin from your dashboard: ${p.url}`,
      html: layout(
        `${p.classTitle} ${lead}`,
        `<p>Hi ${esc(p.name)},</p><p><b>${esc(p.classTitle)}</b> · ${esc(p.courseTitle)}<br>${esc(when)}${p.location ? `<br>Where: ${esc(p.location)}` : ""}</p>${button(p.url, "Open dashboard")}<p style="color:#4B5162;font-size:13px">The Join button appears 10 minutes before the class starts.</p>`,
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
