# Personal data policy (template)

Template for KVET's internal policy under the Law of the Republic of Azerbaijan "On Personal Data". Have it checked by your legal adviser and adapt the bracketed parts before you rely on it.

## 1. What we keep and why
| Data | Purpose | Who sees it |
|---|---|---|
| Name, surname, father's name (AZ + EN) | Certificates, attendance sheets | Staff, the trainer of the session, the person's company, the public QR page (name only) |
| ID/FIN or passport number | One record per real person; renewals; identity checks | Admin and superadmin only. Never shown in trainer, company or trainee portals, the QR page or the audit trail |
| Phone, e-mail | Login details, expiry reminders | Staff |
| Attendance, feedback, evaluations, practical and exam results | Proof of training and competence | Staff; results in the person's own portal |
| Certificates | Proof of competence | Person, their company, public QR page (status, dates, name) |

## 2. Consent
- When Settings -> Personal data -> "Consent tick required" is on, nobody can be registered without the consent box (also in the Excel import: column "Consent").
- The date and the staff member who recorded the consent are stored with the person.
- [Keep the signed paper consent form for each person / the consent clause in the company contract.]

## 3. How long we keep it
- ID/FIN: removed automatically [5] years after the person's last certificate expired or last training ended (Settings -> Personal data -> "Keep ID/FIN for"). Names, certificates and history stay, so certificates can still be verified.
- Backups: the last 90 daily backups. Only a superadmin can download them.
- Audit trail: kept permanently; it never contains ID/FIN values or passwords.

## 4. Requests from people
- Access / correction: staff can export and edit a person's data (Trainees).
- Deletion: superadmin -> Trainees -> delete. Certificates move to the archive and can be erased for good (Certificates -> Archive). [Decide whether certificates must be kept for a legal minimum period first.]

## 5. Security measures (technical)
Encrypted connections (HTTPS + HSTS), Content-Security-Policy, role-based access checked on the server, two-factor sign-in for staff, login rate limiting, encrypted camera passwords, daily backups, and a full audit trail of sign-ins and changes.

## 6. Responsible person
[Name, position, e-mail] is responsible for personal data at KVET.
