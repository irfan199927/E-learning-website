/**
 * Message catalogs: one JSON file per screen (namespace) and language, `messages/<locale>/<Namespace>.json`.
 * English is imported statically (it types every key); Hindi and Marathi load on demand and fall back to English
 * per message. A new namespace needs an `en` import and entry below, plus `hi` and `mr` files (`{}` is fine).
 */
import Account from "../../messages/en/Account.json";
import AdminPayments from "../../messages/en/AdminPayments.json";
import AdminSettings from "../../messages/en/AdminSettings.json";
import AdminUsers from "../../messages/en/AdminUsers.json";
import Assignments from "../../messages/en/Assignments.json";
import Attendance from "../../messages/en/Attendance.json";
import Auth from "../../messages/en/Auth.json";
import Calendar from "../../messages/en/Calendar.json";
import Children from "../../messages/en/Children.json";
import CourseEditor from "../../messages/en/CourseEditor.json";
import Courses from "../../messages/en/Courses.json";
import Dashboard from "../../messages/en/Dashboard.json";
import Grades from "../../messages/en/Grades.json";
import Language from "../../messages/en/Language.json";
import Lesson from "../../messages/en/Lesson.json";
import LessonEditor from "../../messages/en/LessonEditor.json";
import Nav from "../../messages/en/Nav.json";
import Notifications from "../../messages/en/Notifications.json";
import Pay from "../../messages/en/Pay.json";
import Quizzes from "../../messages/en/Quizzes.json";
import RecordingConsent from "../../messages/en/RecordingConsent.json";
import Roles from "../../messages/en/Roles.json";
import Schedule from "../../messages/en/Schedule.json";
import Shell from "../../messages/en/Shell.json";
import SignIn from "../../messages/en/SignIn.json";
import Upload from "../../messages/en/Upload.json";
import WorkEditor from "../../messages/en/WorkEditor.json";
import type { Locale } from "./locales";

export const en = {
  Account,
  AdminPayments,
  AdminSettings,
  AdminUsers,
  Assignments,
  Attendance,
  Auth,
  Calendar,
  Children,
  CourseEditor,
  Courses,
  Dashboard,
  Grades,
  Language,
  Lesson,
  LessonEditor,
  Nav,
  Notifications,
  Pay,
  Quizzes,
  RecordingConsent,
  Roles,
  Schedule,
  Shell,
  SignIn,
  Upload,
  WorkEditor,
};
export type Messages = typeof en;
export const NAMESPACES = Object.keys(en) as (keyof Messages)[];

/** A translation as written (possibly incomplete): no English fallback applied. */
export async function loadTranslation(locale: Exclude<Locale, "en">): Promise<Record<string, unknown>> {
  const parts = await Promise.all(
    NAMESPACES.map(
      async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const,
    ),
  );
  return Object.fromEntries(parts);
}
