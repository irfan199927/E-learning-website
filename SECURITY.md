# Security policy

E-learner holds data about school children, so we treat security reports as urgent.

## Reporting a vulnerability

**Don't open a public issue, PR or discussion.** Report it privately instead:

1. On GitHub, go to the repository's **Security** tab and choose **Report a vulnerability**. This opens a
   private advisory that only the maintainers can see.
2. If that button isn't there, contact the repository owner privately through their GitHub profile and ask for a
   private channel. Don't include details until you have one.

Please include:

- what an attacker can do and which role they need (none, student, parent, teacher, admin);
- steps to reproduce, or a proof of concept;
- the affected URL, endpoint or file, and the commit or deployment you tested.

Test only against your own local setup (`pnpm infra:up` and the seeded accounts). **Never** test against a school's
live deployment or access real student data. If you come across personal data by accident, stop, don't keep a
copy, and mention it in your report.

## What to expect

| Step                                             | Target          |
| ------------------------------------------------ | --------------- |
| Acknowledge the report                           | 3 working days  |
| Confirm, or explain why it isn't a vulnerability | 10 working days |
| Fix a critical or high issue                     | 30 days         |

We'll keep you updated and credit you in the advisory unless you'd rather stay anonymous.

## Supported versions

Only the latest `main` (what is deployed) gets security fixes. There are no maintained release branches.

## Scope

**In scope:** the web app and its API, the worker, the Docker images, the CI/CD workflows, and the static
landing site.

**Out of scope:**

- vulnerabilities in Google Workspace, Vercel, Render, Neon, Cloudflare or other providers (report those to them);
- denial of service by volume, and missing rate limits on endpoints that don't change data;
- reports from automated scanners with no demonstrated impact;
- social engineering of school staff or students.

How the app is secured, and the threat model, are in [docs/security.md](docs/security.md).
