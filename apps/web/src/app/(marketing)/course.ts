/**
 * Copy for the public landing page. SAMPLE CONTENT: a coding course used to show how a school would
 * advertise a course. Edit it here; the page and its tests read from this file only.
 * Keep claims factual (course facts, not invented reviews or outcome statistics).
 */
export const course = {
  name: "Code Foundations",
  tagline: "Learn to code. Build real things.",
  audience: "Live coding course for Grades 8–12",
  pitch:
    "Go from your first line of code to shipping real web apps and Python programs in 12 weeks, with a teacher live on every class.",
  facts: [
    { value: "12", label: "weeks" },
    { value: "36", label: "live classes" },
    { value: "6", label: "projects you build" },
    { value: "100%", label: "of classes recorded" },
  ],
  tech: ["HTML", "CSS", "JavaScript", "Python", "Git & GitHub", "APIs", "Problem solving", "Debugging"],
  modules: [
    {
      weeks: "Weeks 1–3",
      title: "How the web works",
      summary: "Build and style your first pages, then put them online.",
      topics: ["HTML structure", "CSS layout and Flexbox", "Responsive design", "Publishing a site"],
    },
    {
      weeks: "Weeks 4–6",
      title: "Thinking in JavaScript",
      summary: "Make pages interactive and learn to think like a programmer.",
      topics: [
        "Variables, loops, functions",
        "The DOM and events",
        "Debugging in the browser",
        "Fetching data from APIs",
      ],
    },
    {
      weeks: "Weeks 7–9",
      title: "Python and problem solving",
      summary: "Solve puzzles, work with data and automate boring tasks.",
      topics: ["Python basics", "Lists and dictionaries", "Files and data", "Algorithms you can explain"],
    },
    {
      weeks: "Weeks 10–12",
      title: "Build and ship",
      summary: "Plan, build and present a project of your own, using Git like a professional.",
      topics: ["Git and GitHub", "Planning a project", "Code review with classmates", "Demo day"],
    },
  ],
  projects: [
    {
      title: "Personal portfolio",
      tech: "HTML · CSS",
      blurb: "A responsive site about you, published with a real link.",
    },
    { title: "Quiz game", tech: "JavaScript", blurb: "Timed questions, scores and a high-score table." },
    {
      title: "Weather dashboard",
      tech: "JavaScript · APIs",
      blurb: "Live forecasts for any city, pulled from a public API.",
    },
    { title: "Expense tracker", tech: "Python", blurb: "Read, total and chart your spending from a file." },
    {
      title: "Text adventure",
      tech: "Python",
      blurb: "A choose-your-path story with rooms, items and puzzles.",
    },
    {
      title: "Your own idea",
      tech: "Your choice",
      blurb: "The capstone: plan it, build it, present it on demo day.",
    },
  ],
  steps: [
    {
      title: "Join live",
      body: "Classes run on Google Meet. Your Join button lights up 10 minutes before start.",
    },
    {
      title: "Rewatch anytime",
      body: "Every class is recorded and lands in your library, so you never fall behind.",
    },
    {
      title: "Track your progress",
      body: "See lessons completed, minutes watched and your daily learning streak.",
    },
  ],
  batch: {
    starts: "Monday, 2 November 2026",
    schedule: "Mon · Wed · Fri, 4:00–5:30 pm IST",
    mode: "Live online on Google Meet",
    seats: "30 seats per batch",
    price: "Free for enrolled students",
  },
  faq: [
    {
      q: "Do I need to know any coding already?",
      a: "No. We start from zero. If you can use a browser and type, you're ready.",
    },
    {
      q: "What computer do I need?",
      a: "Any laptop or desktop from the last few years with Chrome or Edge. We code in the browser, so there's nothing to install for the first weeks.",
    },
    {
      q: "What if I miss a class?",
      a: "Every class is recorded. Watch it in your library and pick up exactly where you stopped.",
    },
    {
      q: "Can my parents see how I'm doing?",
      a: "Yes. Linked parents get a read-only view of the class schedule, so they always know when you're learning.",
    },
  ],
} as const;
