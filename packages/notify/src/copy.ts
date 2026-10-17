/**
 * Email wording per language. English is the source; Hindi and Marathi follow it line for line (they still need
 * a native speaker's review, like apps/web/messages). Plain text only: templates escape it for HTML.
 */
export const MAIL_LOCALES = ["en", "hi", "mr"] as const;
export type MailLocale = (typeof MAIL_LOCALES)[number];

/** The stored `User.locale`, or English for anything unknown. */
export function mailLocale(value: string | null | undefined): MailLocale {
  return (MAIL_LOCALES as readonly string[]).includes(value ?? "") ? (value as MailLocale) : "en";
}

export interface MailCopy {
  footer: string;
  hi: (name: string) => string;
  linkExpires: string;
  verify: { subject: string; title: string; lead: string; button: string };
  reset: { subject: string; title: string; button: string; ignoreText: string; ignoreHtml: string };
  invite: { subject: string; title: string; lead: string; button: string; expired: string };
  deletion: {
    subject: string;
    title: string;
    lead: string;
    when: (date: string) => string;
    mistake: string;
  };
  reminder: {
    lead: (kind: "24h" | "15m") => string;
    where: string;
    join: string;
    button: string;
    joinHint: string;
  };
  digest: {
    subject: (total: number) => string;
    lead: string;
    more: (n: number) => string;
    seeAllText: string;
    button: string;
    optOutText: string;
    optOutLink: string;
  };
}

export const COPY: Record<MailLocale, MailCopy> = {
  en: {
    footer: "You received this because you have an E-learner account at your school.",
    hi: (name) => `Hi ${name},`,
    linkExpires: "This link expires in 1 hour.",
    verify: {
      subject: "Confirm your email for E-learner",
      title: "Confirm your email",
      lead: "Confirm your email to finish setting up your account.",
      button: "Confirm email",
    },
    reset: {
      subject: "Reset your E-learner password",
      title: "Reset your password",
      button: "Choose a new password",
      ignoreText: "If you didn't ask for this, ignore this email.",
      ignoreHtml: "If you didn't ask for this, you can ignore this email.",
    },
    invite: {
      subject: "You've been added to E-learner",
      title: "Welcome to E-learner",
      lead: "Your school added you to E-learner. Choose a password to sign in.",
      button: "Choose a password",
      expired: 'If it has expired, use "Forgot password" on the sign-in page.',
    },
    deletion: {
      subject: "Your E-learner account will be deleted",
      title: "Your account will be deleted",
      lead: "You asked us to delete your E-learner account. You've been signed out and can't sign in any more.",
      when: (date) => `Your account and its data will be deleted for good on ${date}.`,
      mistake: "If this was a mistake, contact your school before then and an admin can cancel it.",
    },
    reminder: {
      lead: (kind) => (kind === "15m" ? "starts in 15 minutes" : "is tomorrow"),
      where: "Where",
      join: "Join from your dashboard",
      button: "Open dashboard",
      joinHint: "The Join button appears 10 minutes before the class starts.",
    },
    digest: {
      subject: (total) => (total === 1 ? "1 new update on E-learner" : `${total} new updates on E-learner`),
      lead: "Here's what you haven't seen yet:",
      more: (n) => `…and ${n} more.`,
      seeAllText: "See everything",
      button: "See all notifications",
      optOutText: "Don't want these emails? Switch them off on your Account page",
      optOutLink: "Switch them off on your Account page",
    },
  },
  hi: {
    footer: "आपको यह ईमेल इसलिए मिला क्योंकि आपके स्कूल में आपका E-learner खाता है।",
    hi: (name) => `नमस्ते ${name},`,
    linkExpires: "यह लिंक 1 घंटे में समाप्त हो जाएगा।",
    verify: {
      subject: "E-learner के लिए अपना ईमेल पुष्टि करें",
      title: "अपना ईमेल पुष्टि करें",
      lead: "अपना खाता बनाना पूरा करने के लिए अपना ईमेल पुष्टि करें।",
      button: "ईमेल पुष्टि करें",
    },
    reset: {
      subject: "अपना E-learner पासवर्ड बदलें",
      title: "अपना पासवर्ड बदलें",
      button: "नया पासवर्ड चुनें",
      ignoreText: "अगर आपने यह नहीं माँगा था, तो इस ईमेल को अनदेखा करें।",
      ignoreHtml: "अगर आपने यह नहीं माँगा था, तो आप इस ईमेल को अनदेखा कर सकते हैं।",
    },
    invite: {
      subject: "आपको E-learner में जोड़ा गया है",
      title: "E-learner में आपका स्वागत है",
      lead: "आपके स्कूल ने आपको E-learner में जोड़ा है। साइन इन करने के लिए पासवर्ड चुनें।",
      button: "पासवर्ड चुनें",
      expired: 'अगर लिंक समाप्त हो गया है, तो साइन-इन पेज पर "पासवर्ड भूल गए?" का उपयोग करें।',
    },
    deletion: {
      subject: "आपका E-learner खाता हटा दिया जाएगा",
      title: "आपका खाता हटा दिया जाएगा",
      lead: "आपने अपना E-learner खाता हटाने को कहा है। आपको साइन आउट कर दिया गया है और आप अब साइन इन नहीं कर सकते।",
      when: (date) => `आपका खाता और उसका डेटा ${date} को हमेशा के लिए हटा दिया जाएगा।`,
      mistake: "अगर यह गलती से हुआ है, तो उससे पहले अपने स्कूल से संपर्क करें, एडमिन इसे रद्द कर सकते हैं।",
    },
    reminder: {
      lead: (kind) => (kind === "15m" ? "15 मिनट में शुरू होगी" : "कल है"),
      where: "जगह",
      join: "अपने डैशबोर्ड से जुड़ें",
      button: "डैशबोर्ड खोलें",
      joinHint: "क्लास शुरू होने से 10 मिनट पहले जुड़ें बटन दिखेगा।",
    },
    digest: {
      subject: (total) => `E-learner पर ${total} नई सूचनाएँ`,
      lead: "जो आपने अभी तक नहीं देखा:",
      more: (n) => `…और ${n} सूचनाएँ।`,
      seeAllText: "सब देखें",
      button: "सभी सूचनाएँ देखें",
      optOutText: "ये ईमेल नहीं चाहिए? अपने खाता पेज पर इन्हें बंद करें",
      optOutLink: "अपने खाता पेज पर इन्हें बंद करें",
    },
  },
  mr: {
    footer: "तुमच्या शाळेत तुमचे E-learner खाते असल्यामुळे तुम्हाला हा ईमेल आला आहे.",
    hi: (name) => `नमस्कार ${name},`,
    linkExpires: "ही लिंक 1 तासात कालबाह्य होईल.",
    verify: {
      subject: "E-learner साठी तुमचा ईमेल निश्चित करा",
      title: "तुमचा ईमेल निश्चित करा",
      lead: "तुमचे खाते तयार करणे पूर्ण करण्यासाठी तुमचा ईमेल निश्चित करा.",
      button: "ईमेल निश्चित करा",
    },
    reset: {
      subject: "तुमचा E-learner पासवर्ड बदला",
      title: "तुमचा पासवर्ड बदला",
      button: "नवीन पासवर्ड निवडा",
      ignoreText: "तुम्ही हे मागितले नसेल, तर या ईमेलकडे दुर्लक्ष करा.",
      ignoreHtml: "तुम्ही हे मागितले नसेल, तर तुम्ही या ईमेलकडे दुर्लक्ष करू शकता.",
    },
    invite: {
      subject: "तुम्हाला E-learner मध्ये जोडले आहे",
      title: "E-learner मध्ये तुमचे स्वागत आहे",
      lead: "तुमच्या शाळेने तुम्हाला E-learner मध्ये जोडले आहे. साइन इन करण्यासाठी पासवर्ड निवडा.",
      button: "पासवर्ड निवडा",
      expired: 'लिंक कालबाह्य झाली असल्यास, साइन-इन पेजवर "पासवर्ड विसरलात?" वापरा.',
    },
    deletion: {
      subject: "तुमचे E-learner खाते हटवले जाईल",
      title: "तुमचे खाते हटवले जाईल",
      lead: "तुम्ही तुमचे E-learner खाते हटवण्यास सांगितले आहे. तुम्हाला साइन आउट केले आहे आणि तुम्ही आता साइन इन करू शकत नाही.",
      when: (date) => `तुमचे खाते आणि त्याचा डेटा ${date} रोजी कायमचा हटवला जाईल.`,
      mistake: "ही चूक असल्यास, त्याआधी तुमच्या शाळेशी संपर्क साधा, प्रशासक ते रद्द करू शकतात.",
    },
    reminder: {
      lead: (kind) => (kind === "15m" ? "15 मिनिटांत सुरू होईल" : "उद्या आहे"),
      where: "ठिकाण",
      join: "तुमच्या डॅशबोर्डवरून सामील व्हा",
      button: "डॅशबोर्ड उघडा",
      joinHint: "वर्ग सुरू होण्याच्या 10 मिनिटे आधी सामील व्हा बटण दिसेल.",
    },
    digest: {
      subject: (total) => `E-learner वर ${total} नवीन सूचना`,
      lead: "तुम्ही अजून न पाहिलेले:",
      more: (n) => `…आणि आणखी ${n} सूचना.`,
      seeAllText: "सर्व पाहा",
      button: "सर्व सूचना पाहा",
      optOutText: "हे ईमेल नको आहेत? तुमच्या खाते पेजवर ते बंद करा",
      optOutLink: "तुमच्या खाते पेजवर ते बंद करा",
    },
  },
};
