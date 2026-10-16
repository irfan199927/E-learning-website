/**
 * Children's data (DPDP Act 2023, s.9): under-18s need verifiable parental consent before we process their data.
 * Pure helpers shared by the web app's consent service and its tests.
 */
export const ADULT_AGE = 18;

/**
 * Version of the consent notice the parent agrees to. Bump it (YYYY-MM-DD) whenever the notice text changes;
 * each Consent row records the version the parent saw.
 */
export const CONSENT_NOTICE_VERSION = "2026-10-16";

/** How long a consent link emailed to a parent stays valid. */
export const CONSENT_LINK_TTL_MS = 7 * 24 * 3600_000;

/** Whole years between a date of birth and `today` (both compared as calendar dates in UTC). */
export function ageOn(dateOfBirth: Date, today: Date): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export const isMinorOn = (dateOfBirth: Date, today: Date) => ageOn(dateOfBirth, today) < ADULT_AGE;
