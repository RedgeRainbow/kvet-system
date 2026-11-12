# Version 3: what changed

Every item from the review, in the same order. "Test" names the automated test that proves it (`npm test`: 56 tests).

## Security
| # | Item | Fix | Test |
|---|---|---|---|
| 1 | Trainer could look up anyone by ID/FIN | A trainer who enters an existing ID/FIN only gets "already registered", with no name or number. Admins still see who it is. | v3 / features: trainer + dupFin |
| 2 | Lockout bypassed by parallel guesses | Every attempt is counted **first**, atomically in Postgres (`login_fail`), then the password is checked: 8 per account, 40 per IP, 15 min lock. The WAF rule is now a required step in DEPLOY.md. | v3: 40 parallel guesses → at most 8 checked; per-IP limit |
| 3 | Restore wiped the audit trail / could stop half-way | The audit trail is never restored. The restore runs as one database transaction (rows staged in `records_restore`, swapped in by `apply_restore`). A safety backup is made first and logins are re-registered. | v3: restore keeps audit |
| 4 | Camera bridge open to any website | The bridge refuses to start without `--origin`; other origins get 403; control calls need the bridge token; pictures are served only through random one-camera links (no passwords in URLs), and only image/video responses are relayed. The public download copy is removed. | bridge.test |
| 5 | No CSP; tokens in browser storage | `_headers`: Content-Security-Policy (scripts only from the site itself), HSTS, COOP, no framing. Checked in a browser: no violations on any page. | browser check |
| 6 | Backups: camera passwords, hashes, FIN, Admin download | Download is superadmin only. Camera passwords are AES-GCM encrypted at rest (and so also in backups). | v3: backups |
| 7 | Trainers saw all trainees | Only people from their own sessions; others by exact learner number (logged in the audit trail). | features: trainer |
| 8 | Supabase sign-ups / permanent bootstrap admin | DEPLOY.md: turn sign-ups off. `BOOTSTRAP_ADMIN_EMAIL` only works while no superadmin exists. | v3: bootstrap |
| 9 | Unknown login scanned the whole table | Removed. System → "Repair login registry" rebuilds the registry (also done automatically after a restore). | features: repair |
| 10 | Double certificate on parallel "issue" | Each release first reserves the enrolment with a unique row (`rel`); a second request gets "already released". | v3: 4 parallel clicks → 1 certificate |

## Bugs
- "Pass" showed "Parol / Password": fixed ("Keçdi / Pass").
- Company logins: only Azerbaijani letters are folded ("Caspian Drilling" → `caspiandrilling…`).
- An empty penalty sheet gave PASS: it now stays "Incomplete" until the examiner ticks **Test completed**. A disqualification or going over the limit is a FAIL right away.
- Trainers cannot change attendance, evaluations or practicals once a session is closed or cancelled.
- Feedback before release: there's a new setting (on by default). The "Give feedback" button disappears once a result is released.
- Lock time is now 15 minutes, as documented.
- The Mulish fonts are bundled (`public/fonts`, open licence).
- Scheduled jobs: `workers/cron` (daily backup, keeping 90; reminders; ID/FIN retention).
- Renumbering a certificate retires the old number, so it is never handed out again.
- Deletes go by id only, so they can't sweep up records created in the meantime.

## Certificate
- It reproduces the sample PDF: every line is within 1 px, with the same font, sizes, colours and logo positions (see `certificate-comparison.png`).
- The seven accreditation logos from the sample are built in as defaults; they can be removed, reordered or replaced in Settings.
- There's an English-only variant for foreign candidates.
- The company line is optional (off by default, as on the sample).
- PDF downloads render at about 290 dpi (previously 190). Print gives a vector PDF identical to the sample.
- Print-all and a ZIP of PDFs are available per session, after a bulk release, and for any selection.

## Practical sheets (rebuilt from the two Word forms)
- **Overhead Crane, page 1:**
  - Candidate, Truck Type and Time boxes.
  - Two-column criteria table (Faults × Penalty = Award), with the chosen value shown for 3-5 items.
  - Carry Forward, Time Penalties, TOTAL, and the W/A note.
  - Mandatory Disqualification tick boxes.
- **Overhead Crane, page 2:** PASS/FAIL (over 40), test date, both signatures, examiner name and reg. number, and comments.
- **Appointed Person:**
  - Delegate / Company details.
  - Duties rated 1-5 / N/A, with grey section rows.
  - Task / Comments box and the green scale legend.
  - Theory / Practical / TOTAL block with examiner name, signature and Pass/Fail.
- The entry form has the same boxes, live totals and the "Test completed" tick.
- The sheet editor gained:
  - form title lines
  - a box name per field
  - "starts the right column" per section
  - the disqualification note
- Use Practical sheets → **Update starter sheets** once.

## Scaling
Done:
- Excel import runs in 100-row requests, each using about 5 bulk database calls (previously about 4 per person).
- Staff tokens are verified locally (JWKS / JWT secret) instead of calling Supabase on every request.
- Release, restore and login counting run as database operations.
- New indexes.

**Not done yet:** moving to separate tables, and server-side paging for the certificate and trainee lists. It's a data migration that is safer to do as a separate step. The current design is comfortable up to a few thousand people.

## UI/UX
- On phones, list tables become cards (labelled fields).
- The dashboard uses 2 columns on phones.
- The month picker is now a dropdown.
- Drawn SVG icons replace the emoji in the navigation, and icon-only buttons have labels.
- Unknown errors now show their code; network errors say "check the connection".
- Issue queue: tick boxes, "Release selected", bulk release in blocks of 50, and a badge that refreshes.

## Features
1. **Expiry reminders:** e-mail through Resend, with an optional SMS webhook. Companies get one digest each and trainees get their own message, once per threshold (default 90 and 30 days). Settings has a preview and a "send now" button.
2. **Scheduled backups:** the cron Worker. Also enable Supabase PITR (point-in-time recovery) if your plan has it.
3. **Two-factor sign-in for staff** (Supabase MFA, TOTP):
   - The policy can be optional, required for admins, or required for all staff.
   - Set-up uses a QR code.
   - A superadmin can reset someone's 2FA.
   - A token signed in with the password only stops working once 2FA is on.
4. **Bulk work:** bulk release, print all, ZIP of PDFs.
5. **Portal users change their own password.** Their other devices are signed out.
6. **QR page:** "Not valid" for deleted certificates; revoked certificates show the date they were revoked.
7. **Company portal:**
   - training and renewal requests, with status and reply
   - "Request renewal" on expiring certificates
   - Excel export of staff and certificates
   - staff answer requests in Admin → Requests
8. **Sessions calendar** (month view). Clashes (the same trainer, or the same room at the same time) are shown in red and warned about when saving.
9. **Exam results from CSV** (learner number; score; optional PASS/FAIL, or a pass mark).
10. **Personal data:**
    - an optional required consent tick (also an Excel column)
    - automatic ID/FIN removal after N years, with a preview
    - `PRIVACY.md` policy template

**Foreign candidates:** document type, nationality, and an English-only certificate.

## Note on transliteration
The original brief asked for q→g ("Qocayev → Gojayev", "Vüqar → Vugar") and the tests keep that. Your sample PDF, made by the old system, prints "Qojayev". The English name can be edited per person. If you want q kept everywhere, it's a one-line change in `public/js/shared.js`.

## Round 4
- **Standard blank:** Certificate blanks → "＋ Standard KVET blank" re-creates the blank from the sample certificate (wording identical to the PDF). Settings → Accreditation logos → "Restore the 7 logos from the sample".
- **Signed certificate:** the signature image now replaces the `________` after "İmza / Signature". The unsigned version keeps the line, as on the sample.
- **Credits:** when a blank has credits, "2 Kredit / 2 Credits" is printed under the training name (İş İcraçısı / Performing Authority).
- **"Learner number" → "Attendance number / İştirakçı nömrəsi"** everywhere: certificate, screens, exports, practical sheets.
- **Electronic signatures on every document:**
  - What gets signed:
    - certificate: signed by the staff member who released it
    - attendance sheet: signed by the trainer or staff, "Sign electronically" button
    - practical sheet: signed automatically by the examiner when it is completed; the candidate countersigns in the trainee portal
  - What is printed: "Signed electronically by Name Surname, Title · 31.10.2026 13:54 · code 8F02-4CBB", plus a check address.
  - Checking: `/verify.html?s=CODE` shows the signer and time, and whether the document changed since signing. The document's content is fingerprinted with SHA-256.
  - Withdrawal: any later change (attendance, marks) withdraws the signature automatically, so the document has to be signed again.
  - Signer names: each staff member sets their name and job title (account button, or Users). Without a name, staff sign as "<role> · <organisation>", never with their e-mail.
- Old records without an internal id (blank names) can be opened, edited and deleted.

## Round 5
- **Blank editor preview fixed:** the live preview box used the CSS class `box`, which the certificate stylesheet also uses (comment boxes on practical sheets, keeping line breaks). Every line break of the template became visible space, so the text slid down over the dates. The preview now uses its own class, and certificates ignore source line breaks wherever they are shown. Issued certificates, prints and PDFs were not affected.
- **Camera bridge set-up:**
  - The admin page offers one-click downloads: `camera-bridge.mjs`, plus a ready-made `start-camera-bridge.bat` (Windows) or `.sh` (Mac/Linux) with this site's address filled in.
  - If the camera's or phone's address is typed as the bridge address, a warning appears with a one-click fix.
  - The dialog shows the bridge-free option (the phone's own camera).
  - Tested end to end with an IP Webcam-style stream.

## Round 6
- **Camera frame rate:** snapshot cameras were polled with a 600 ms pause (about 1.6 fps), and the fps counter for streams was wrong.
  - The bridge now turns snapshot cameras into a continuous stream (15 fps) and passes video streams through at the camera's rate. RTSP runs at 15 fps.
  - The viewer shows the real rate, as measured by the bridge.
  - Tested: snapshot-only camera 15.1 fps; 5 fps stream shows 5.0 fps.
- **Cameras at another place:** `--tunnel` gives the bridge a secure public address through Cloudflare. There is a "remote" Windows start file that installs cloudflared. The camera is never exposed directly.
- **Hidden admin panel:**
  - The admin panel is only at `/admin.kvet`.
  - It is removed from the home page.
  - `/admin` and `/admin.html` return a 404 page.

## Round 7
- **Camera showed one still picture:** this happened when the new admin page ran against an older `camera-bridge.mjs`, with the camera saved under its snapshot address. Fixes:
  - The page now detects an outdated bridge: the badge shows "Bridge outdated – download it again". Meanwhile the page fetches pictures itself, so the image still moves (tested: about 15 fps).
  - Camera detection tries the real video addresses first (IP Webcam `/video`), one at a time with more time to start, before falling back to snapshots.
  - A stream that stops for about 6 s reconnects automatically.
  - Bridge version 3.

## Round 8
- Certificate: the start / completion date lines are replaced by "Təlimin Başlama Tarixi / Training Start Date - dd.mm.yyyy", with "N Kredit / N Credits" directly under it (only when the blank has credits). Nothing is printed under the training name any more. The English-only variant reads "Training Start Date - …" / "N Credits".

## Round 9: demo for reviewers
- `npm run build:demo` builds `dist-demo/`:
  - browser code bundled and minified
  - copyright notice in every script and page
  - DEMO banner on every page
  - separate `wrangler.toml` (project `kvet-demo`, bucket `kvet-demo`)
  - none of the docs, tests or readable source
- `seed-demo.mjs` fills a demo with fictional data and creates read-only reviewer logins. It refuses to run against an address without "demo" in it.
- Menu headings with no visible items are hidden (e.g. "System" for readers).

## Round 9 — who signs what
- **Attendance:** trainees can no longer confirm their own attendance (the trainee confirm route is gone). Trainers confirm per person or with **"Confirm attendance for all"** in the trainer portal, and sign the attendance sheet there.
- **Practical sheets:** signed only by the trainer, from the trainer portal. A completed sheet is signed automatically when the trainer saves it; if the office edits it later, the signature is withdrawn and the trainer gets a **Sign** button. Trainees cannot sign anything.
- **Certificates:** only **admin and superadmin** (`cert.sign`) can sign, in two ways:
  - **Electronic signature:** a stamp on the signature line, with name, title, date/time and a verification code.
  - **Signature image:** their own uploaded image on the signature line, with name, title and the code.
  The signer's own **name and surname** are shown, never the role. A signer without a name set is refused (`needName`).
- Signing is available from the release dialog (sign later / electronic / my image), the certificate preview, the bulk-issue result and a session's certificate list. **Withdraw signature** is also available. Editing a certificate withdraws its signature.
- **My account** (top right): name, title, and for admins a signature image upload (PNG/JPG; white background made transparent). The company-wide signature upload in Settings was removed.
- Certificates are released **unsigned** unless a sign option is chosen.

## Round 9b — IP Webcam "No picture received"
- Camera bridge v4: the video stream's content-type is passed on exactly as the camera sends it. v3 lowercased it, which broke IP Webcam's mixed-case stream boundary (`Ba4oTvQ0…`), so the browser received data but could not show any frame.
- If `/video` still fails, the page also tries the camera's `/shot.jpg` (turned into a ~15 fps stream by the bridge).
- The admin page asks for bridge v4 (shows the "update the bridge" notice for older ones). Test added.

## Round 9c — checking electronic signatures
- The certificate QR page now also shows who signed it (name, title, electronic/image, date and time) and the signature code, which links to the full signature check. An unsigned certificate shows "Not signed".
- `/verify.html` opened without anything shows a box to type a signature code (e.g. `2B96-87D7`).

## Round 10 — online tests, declaration of health, toolbox talk, session documents
- **Question bank** (Admin -> Library -> Question bank): a test per training, headed with the training name. Multiple-choice questions (choose the correct answer) and open questions, points per question, optional time limit.
  - Marking: **pass rate %** (automatic; a test with open questions still goes to review) or **needs review** (the session's trainer, an admin or a superadmin marks it and chooses PASS / FAIL).
  - Import questions by pasting text (numbered questions, `A) B) C)`, `*` or `Answer: B` for the correct one) or from Excel (template in the dialog).
- **Session exam**: none / external link / test from the question bank.
  - Trainees take the test in their portal after attendance (and feedback, when required). One attempt, timer, answers kept on the device until submitted. The correct answers are never sent to the trainee.
  - A graded test becomes the session's exam result. The grader signs it electronically. Admin can give a new attempt.
- **Declaration of health** (form KLN-A-006): compulsory for sessions with a practical part.
  - The trainee fills it in and signs it in the portal; YES answers need details and are flagged to the trainer and staff.
  - The trainer or staff can record a paper form instead. The practical sheet cannot be filled until the declaration exists.
- **Toolbox talk** (form KLN-HS-001): trainer (or staff) fills topic, company, location and trades; the trainer signs it electronically. Available for sessions with a practical part.
- **Session documents (ZIP)**: one click on a session gives PDFs of the attendance sheet, trainer evaluation, training evaluation (summary + per trainee), practical sheets, exam results + answer sheets, declarations of health and the toolbox talk.
- The signature check page knows the new documents (declaration, toolbox talk, test).
- PDF export splits multi-page documents properly (practical sheet page 2, long answer sheets).

## Round 10b — exam-az.com questions
- **Import exam-az file** (Question bank): reads the `exam-az-questions.json` export (49 sets, 2,971 questions). Each set becomes one test; you choose the training per set (or one for all). Already imported sets are marked.
- **Drafts**: questions without a correct answer (413 on exam-az) are kept; the test is a draft until each has one, and a draft cannot be chosen for a session.
- **Questions per attempt**: a random selection per trainee, in total or per section (taken over from exam-az, e.g. 35 of 86).
- Questions that had a picture on exam-az are marked "[🖼 Picture — in the original question]" (pictures are not copied).

## Round 10c — question bank separate from trainings
- A test needs only a name; linking it to a training is optional (it only sorts the list and the session's test picker).
- The exam-az import creates all selected sets at once, without choosing trainings.
- In the session form any test can be chosen; tests linked to the session's training are listed first.

## Round 11 — live updates
- Every portal checks for changes every 8–20 seconds (only while the tab is visible) and refreshes itself when something it shows changed: admin (8 s), trainer (8 s), trainee (10 s), company (20 s).
- The check is one tiny counter read (`GET /rev`, `/portal/*/rev`); data is fetched again only when the counter moved. Counters are per session, trainer, trainee and company, so a trainee's page does not reload because of other trainees.
- Nothing typed is lost: while a dialog is open, someone is typing, a trainee is filling a form or taking a test, or an admin is on a page with inline forms (settings, users…), the page waits and shows a "New changes · Refresh" button instead (none during a test).
- ↻ button in the top bar of every portal refreshes immediately. Your own changes do not cause a second reload.

## Round 12 — exams, approvals, auditors, AI, Russian
- **Groups** of candidates (Admin -> Groups); a whole group is added to a session in one step.
- **Random questions per candidate**: the session sets how many questions each candidate gets from the chosen bank (error if the bank has fewer). Questions and answer options are shuffled per candidate; the draw is kept when the page is reloaded. Answers are checked by option id, so shuffling can never mark a right answer wrong.
- **Exam start/end**: the test is locked (no questions visible) until the trainer or admin presses **Start exam**. **End exam** submits all open attempts with what was answered.
- **Progressive saving**: every answer is saved immediately; a reload, lost connection or new device continues where the candidate stopped.
- **Attendance by roll call**: everyone is present by default; the trainer ticks only the absentees and presses **Confirm attendance**. Adding and removing candidates from a session stays (removal blocked only once results exist).
- **Certificates of company candidates**: the candidate sees only that he holds the certificate and its expiry date; the company views, prints and downloads it. Private candidates see their own certificate.
- **Company portal**: results of its own candidates (attendance, practical, exam, trainer feedback).
- **PDF presentations** next to PowerPoint.
- **Russian** interface in all portals (AZ / EN / RU).
- **Approver role** with an approvals queue (question banks, presentations, certificates; approve or return with a comment). Trainers create their own question banks (Trainer portal -> My question banks) and send them for approval.
- **Auditor role** (read-only, end date, `/audit.kvet`); every page an auditor opens is logged.
- **Audit trail** additionally records user deletion, attendance and result changes, exam start/end, approvals and certificate generation.
- **AI module** (off by default; superadmin): knowledge-base chatbot for trainees (answers only from approved texts, AZ/EN/RU) and explanations of test questions after the exam. Never changes scores.
- **Light / dark / automatic theme** button in every portal; all tables sortable by clicking the header, long tables get a filter box; the top bar fits narrow phones.
- Already in place before this round: no open registration, hashed passwords, HTTPS only, concurrent sign-ins, daily automated backups.

## Round 12b — AI set up in the admin panel
- Admin -> AI (superadmin): choose the provider (Google Gemini, Groq, Cloudflare Workers AI, OpenRouter, Anthropic Claude or any OpenAI-compatible service), paste the API key, load the available models, **Test connection**.
- Keys are stored encrypted and never sent back to the browser (only the last 4 characters are shown). Cloudflare secrets still work as a fallback.
- Clear messages for a wrong key and for a provider's rate limit.

## Round 12c — knowledge base for KVET
- Folder `knowledge-base/`: 7 ready documents written from kvet.edu.az (about KVET, accreditations and contacts; industrial machinery and crane operator courses; lifting, rigging and inspection; workplace safety; risk management and permit to work; trainee guide to training day, exam and certificates; glossary). Azerbaijani text with course names in English and Russian.
- Admin -> AI -> **Upload files**: several .md / .txt / .docx files at once; a file with the same title replaces the existing document.
- The knowledge base keeps each paragraph (one course, one question) as one passage, so answers cite the right course.
- Test screen text now says that answers are saved on the server (continue after reload or on another device).

## Round 13 — AI throughout the platform
**11.1 Chatbot**: the trainee portal has a permanent **"Süni intellekt"** section (tab next to "My training") with the knowledge-base chatbot, suggested questions, clear-chat, and the list of the trainee's marked tests. The AI switches now come with the trainee's main data, so the section appears as soon as the module is on (a page refresh is enough).
**11.2 Test explanations**: on the results page an explanation is generated **automatically under every multiple-choice question** (two at a time, cached), explaining the correct answer and the option the trainee chose. Language switch AZ / EN / RU. Shown only after the trainer ends the exam (so answers never leak to others still writing). Explanations have their own daily limit (300) and never change scores, keys or certificates.
**11.3 AI reports and dashboards** ("Analytics & reports"):
- Computed from platform data: attendance, training feedback (by topic, trainer, training, score distribution, anonymous comments), trainers' evaluations of candidates, platform tests (pass rates, hardest questions with the most chosen wrong answer, marking turnaround), practical assessments, declarations of health, outcomes, certificates (issued, valid, expiring, pending approval), group dynamics per session (size, attendance, average, spread, pass rate, feedback) and the monthly trend.
- **Needs attention**: fixed, visible rules (attendance < 85 %, pass rate < 70 %, feedback < 7/10, questions under 40 % correct, missing evaluations or declarations, tests waiting for marking > 3 days, certificates expiring within 30 days…).
- **AI summary** on top: overview, needs-attention and recommendations, written from the figures only (no names or learner numbers are sent to the AI). Cached; "Regenerate" button; can be switched off separately (Settings → AI → "AI summary in reports").
- Role-based: superadmin / admin — whole system with filters (period, training, trainer, company); auditor — feedback and evaluation oversight (no people lists, no certificate pipeline); trainer — only their own sessions (Trainer portal → Analytics); company — only its own employees (Company portal → Analytics tab). Period presets and custom dates; print.

## Round 14 — roles, signatures, multi-day attendance, candidates, exam integrity, performance analysis
**Sign-in / users (bug fixes)**
- Creating a staff user now works even when the e-mail already has a Supabase sign-in account (created in the Supabase dashboard, an old sign-up, or left over after deleting a user): that account is linked and gets the new password. Before, the user was created without a working sign-in.
- Precise messages: "no role in KVET", "account period ended", "locked until hh:mm", "user exists", "password not accepted", "end date in the past". Every failed sign-in is in the audit trail with the reason.
- An end date in the past is refused (it locked the account at once).

**Roles**
- The **reader** role is removed; old reader accounts sign in as **auditors**.
- **Auditor**: only the training section (Trainings with their documents, Certificates, Analytics). No question banks or answer keys, no dashboard, people, settings or audit trail; **no downloads** (PDF, ZIP, Excel, print are hidden and refused).
- **Approver**: approval queue + reading Trainings and Certificates; **signs certificates and every session document**.
- **Certificates are signed only by the superadmin and approvers** (electronic signature or their own uploaded signature image). Admins release; approving a certificate in the queue signs it in the same step.

**Approval signatures on documents**
- Session → Documents: every document (attendance sheet, trainer evaluation, training evaluation, practical sheets, test sheets, declarations of health, toolbox talk) can be viewed and countersigned by an approver / the superadmin, electronically or with the signature image. The approval is printed on the document and in the ZIP, and can be checked on the verification page.

**Multi-day trainings**
- The end date fills in from the training's credits (2 credits = 2 days) and can be changed.
- Roll call per day (day selector); the trainee table, the attendance sheet (one column per day) and the analytics show each day. Attended = present on at least one day; a day that has not come yet cannot be marked.

**Trainees: ID/FIN and phone**
- Admin / superadmin may register a trainee without FIN and phone. Trainers and companies must give both.
- At the first sign-in the trainee must enter the missing FIN and phone; the portal opens only after that.

**Company candidates**
- Company portal → "Candidate registrations": the company adds new candidates (only for itself; FIN and phone required). They appear in Approvals → Candidate registrations; the superadmin, an admin or an approver confirms (the trainee is registered, sign-in details shown once) or returns with a reason.
- Requests page: company requests, candidate registrations and candidates added by trainers.

**Exams**
- Pictures for questions (PNG / JPEG / WebP; shrunk in the browser), shown in the test, review, approval preview and the printed sheet.
- Exam duration per session (overrides the test's time limit).
- Exam integrity: no copying, cutting, right-click or long-press; leaving the exam page (other tab, window or app) is a warning; the 3rd warning ends the attempt at once and shows the result. Warnings are counted on the server and shown to the trainer.
- The trainer can give one candidate a **new attempt** (new random questions). If the trainer has opened answers with the key in this session, a warning asks for explicit agreement; it is recorded in the audit trail. Trainers can now also open tests that are waiting for marking.

**AI performance analysis** (superadmin / admin): Admin → "AI performance analysis": trainers and trainees with attendance, feedback by topic, tests, practical, outcomes, evaluations, exam warnings and flags; an AI comparison of all trainers / trainees and an AI analysis of each person. Names, learner numbers and FIN are not sent to the AI (people are codes T1…, P1…).

## Round 15 — identity by FIN, temporary accounts, company Excel, direct certificates, emergency account
**Candidates are identified by ID/FIN**
- People may share name, surname and father's name; FIN and learner number are unique (one each per candidate). A FIN that is already registered is never created a second time (office form, Excel, company requests, first sign-in).
- Registered by the office without FIN or phone -> a **temporary account** (sign-in "T-XXXXXX", no learner number, no certificate). At the first sign-in the candidate gives FIN and phone; the system then registers them completely: a learner number is attached to the FIN, the sessions and results move along, and from then on the sign-in is the learner number (same password).
- If the FIN given at the first sign-in already belongs to a registered candidate (a returning candidate), no second record is made: a request appears in Approvals -> "Returning candidates (same FIN)". Confirming moves the new training onto the existing record and learner number; the temporary account is removed.
- Renewal: the same record and learner number; the newer certificate for the same training replaces the older one (status RENEWED).

**Excel**
- Office template and import: FIN and phone may be empty (temporary accounts); the help sheet explains FIN identity and uniqueness.
- Companies: "Upload from Excel" (same template) sends many candidates for confirmation at once. FIN and phone are compulsory for companies; admin / superadmin can make them optional for a chosen company (Companies -> edit -> "may add candidates without ID/FIN and phone").

**Direct certificate (superadmin only)**: Certificates -> "Direct certificate": without a session, any registered trainee, template, dates, expiry and number (unique across all certificates, including retired and archived numbers), and every printed text can be changed: names, training name, credits, trainer, company, titles, qualification, description, footer, provider. Optional signing on issue. Temporary accounts cannot receive a certificate (no learner number yet).

**Emergency account "admin_emergency"** (for a superadmin lockout)
- Exists only while the Cloudflare secret `EMERGENCY_PASSWORD` (at least 16 characters) is set; sign in at /admin.kvet with "admin_emergency" and that password.
- Admin rights plus managing users (new password, two-factor reset, roles) so the superadmin can be restored; it cannot delete, restore backups or sign, and nobody can be given this role. Not listed in Users.
- 4-hour sessions; changing or removing the secret ends them. Red banner during use; every sign-in and change is in the audit trail, and the superadmin sees a red warning with the times and IP addresses until acknowledged.

## Round 16 — speed and responsiveness
Measured with 40 ms added to every database query (a realistic Supabase round trip from Cloudflare):

| Screen | Before | After |
|---|---|---|
| Training session (office) | 523 ms | 122 ms |
| Training session (trainer portal) | 887 ms | 284 ms |
| Trainee home | 645 ms | 124 ms |
| Start-up data (`/state`) | 283 ms | 164 ms |
| Issue queue / Approvals | 322 ms | 82 ms |
| Trainer home | 202 ms | 161 ms |

**Server**
- Per-request read cache (`functions/_lib/cache.js`): each record is read once per request; lookups issued together are merged into one query (`id=in.(…)`); writes update the cache so a request always sees its own changes.
- Independent reads run in parallel instead of one after another: sign-in check + settings, the seven signature lists of a session, the trainees of a session (one query instead of one per person), issue queue, approvals, trainee home, session view.

**Browser**
- Russian dictionary (≈120 KB) is downloaded only when Russian is chosen.
- `modulepreload` hints: every page asks for all of its scripts at once instead of discovering them level by level. Generated by `node tools/preload.mjs` (run it after changing imports; `test/preload.test.mjs` fails when a page is out of date).
- JSZip no longer blocks the first paint (`defer`).
- Office panel: the code for every section is fetched in the background after sign-in, so switching sections does not wait for downloads; the menu counters (issue / approvals / requests) are loaded together, in the background, and at most every 20 s unless something was saved (before: three requests one after another on every section change).
- Trainer portal: after signing or marking attendance, session and home are reloaded together.
- Feedback while waiting: a thin progress bar at the top when a request takes longer than a moment; placeholder layout when a section is still loading; the button that started a save shows a spinner and ignores repeated clicks until the server answers. Background polling and exam autosave stay silent.

## Round 17 — built for years of data
Tested with five years of data: 40,000 trainees, 1,920 sessions, 48,000 enrolments, 48,000 certificates, 144,000 signatures, 77,000 audit entries.

| Screen | Before (rows read · sent to the browser) | After |
|---|---|---|
| Office panel start-up (`/state`) | 89,930 rows · 19.2 MB | ~4,000 light rows · 129 KB |
| Certificates page | 48,001 rows · 21.3 MB | 52 rows · 24 KB per page |
| Issue queue | 137,927 rows | only open results |
| Dashboard numbers | 137,930 rows | the period's sessions + database counts |
| Analytics | 137,928 rows | the period only |
| Approvals / Requests / Audit | 88,004 / 40,004 / 76,813 rows | pending items / last 12 months / last 3 months |
| Trainer portal home | 49,923 rows · 1.8 MB | last 12 months |
| Trainee portal | every session scanned | indexed lookup |

**Database** (`schema.sql`, run again before deploying — see DEPLOY.md 0a)
- `store.query()`: filters, sorting, counting and paging done by Postgres; whole collections are no longer read by pages. Pages of 1,000 rows are fetched in parallel where a full list is still needed (exports, maintenance).
- Indexes for every filter the app uses (certificate status / expiry / period / company, sessions by date / template / trainer / participant, open results, queues, audit by record), trigram index for name search, prefix index for signatures and audit months.
- `records_in()`: any number of records by id in one call (Cloudflare limits the number of database calls per request).

**Derived fields** (`functions/_lib/search.js`, kept up to date on every write, filled in once for older records)
- `sk`: normalised search key (names AZ/EN, learner number; "Məmmədov", "MEMMEDOV" and "memmedov" all match). ID/FIN, phone and e-mail are found by exact match and only for staff allowed to see them; the key is never sent to browsers.
- Certificates: `exp`, `cox` and `renewed` (newer certificate of the same person and training), recomputed for the person concerned when a certificate is added, revoked, restored or deleted; so Active / Expiring / Expired / Renewed are database queries.

**Server**
- New: `GET /trainees/find`, `POST /people`, `POST /fins/check`, `GET /trainee/history`, `GET /sessions/find`, `GET /usage`, `GET /portal/company/cert`; `GET /certs` now takes filters + `page`/`size` and returns counts.
- Session view brings its participants; issue queue reads only enrolments without a decision; deletes plan their cascade from the affected records only; reminders and ID/FIN retention read only what they need.
- Session clash checks look at overlapping dates only (a session lasts at most 62 days).
- The request cache keeps loaded collections as maps (bulk updates O(1) instead of a linear search per row).

**Browser**
- Trainees and Certificates: search as you type (on the server), "Show more" pages, tiles counted by the server, Excel export of the filtered list (up to 20,000 rows).
- Session / group pickers and the direct-certificate person field search the server. Names of the people a page shows are fetched as needed.
- Sessions: recent sessions at start-up; older ones a year at a time (button, calendar months, dashboard links).
- Library pages count usage across all years; dashboard numbers come from the server.
- Company portal: current certificates only with a light snapshot (the full certificate is fetched to view / download); long lists drawn 200 rows at a time.

Tests: `test/scale.test.mjs` (query layer, cache, start-up window, search and FIN visibility, certificate status upkeep through renew / revoke / restore / delete, backfill of older records). `npm test`: 98 tests.

## Round 17b — presentation watermark
The viewer's watermark (staff e-mail, or trainer name + session) was white at 7 % opacity and almost invisible on white slides. It is now a tiled diagonal pattern over the whole screen, grey text with a light outline (readable on light and dark slides), and carries the date and time of viewing, so a photographed slide shows who opened it and when.

## Round 17c — presentation viewer fidelity
Checked slide by slide against a reference rendering of "Level 3 – Appointed Person Rigging" (115 slides) and a test deck reproducing the reported screenshots.

| Problem | Cause | Fix |
|---|---|---|
| Bullets missing (•, ○, ✓ …) | the bullet was moved left twice and clipped; colours / sizes / symbol fonts ignored | hanging indent as in PowerPoint; bullet colour, size, Wingdings / Symbol / Courier "o" mapped to the characters they show; numbered lists |
| Second title line cut off | text boxes clipped their text | text is never clipped (as in PowerPoint); line spacing, spacing before / after, autofit shrink |
| Mirrored title ("tnetnoc esruoC") | a horizontal flip mirrored the text too | flips apply to the shape / picture only; text stays readable |
| Footer line missing | 0 px high lines were not painted | lines drawn with padding; colours from the line style; arrow heads; dashes |
| Titles / text without the layout's size, colour, position | layout / master placeholder styles were only used when the slide had no position of its own | always inherited (list styles and text-box settings) |
| Wrong colours / fonts in decks with several masters | only the first theme was read | theme colours and fonts per slide master |
| Different line breaks on Mac / phone / Linux | Calibri missing there | Carlito (open font, Calibri's exact letter widths) bundled, used only where Calibri is not installed |
| Photos / embedded tables missing (WMF, EMF, embedded Word/Excel objects) | browsers cannot show Windows metafiles | `emf.js`: picture inside a metafile extracted; EMF drawings converted to SVG; embedded objects show their preview |
| Shapes in nested groups misplaced; lines in groups invisible | nested group coordinates not mapped | mapped at any depth (rotated children included) |
| Cylinders, cubes, chords / arcs, freehand shapes missing | not drawn | can, cube, chord, arc, pie, arrows, custom geometry drawn as SVG |
| Orange boxes behind pictures | "Set transparent colour" ignored | applied |

Tests: `test/emf.test.mjs`. `npm test`: 101 tests.

## Round 17d — browser tab icon
The tab icon was the whole wide logo squeezed into a square (unreadable). It is now the round mark only, with a white figure that stays visible on light and dark browser tabs: `favicon.ico` (16/32/48 px), `img/icon-32.png`, `img/icon-192.png` (Android / high-DPI), `img/apple-touch-icon.png` (iPhone / iPad home screen, on white). Every page links them; `img/logo.png` stays the logo inside the pages and documents.

## Round 18 — signatures, multi-day trainings, certificate texts, library, company requests

**Confidential questions.** Candidates no longer see their test questions after the exam (no review, no AI explanation); they see the score only.

**Who signs what.** Admins sign nothing. Certificates are signed only by the superadmin and the approver.
- Attendance sheet: trainer only, no stamp. For a multi-day training it is signed once per day.
- Trainer's evaluation: trainer only, no stamp.
- Training evaluation: each candidate signs their own, during the training.
- Toolbox talk: the trainer opens it, every candidate acknowledges and signs it (date and time), then the trainer signs.
- Exam results: the trainer signs once every result is confirmed.
- A changed document withdraws its signature.

**Multi-day trainings (2+ days).** Attendance is taken and signed every day. The feedback forms, exam, practical, toolbox talk and declaration of health belong to the final day: the trainer opens them on that day (the office can also open them).

**Unsigned-document warnings.**
- Trainer: a to-sign list per session.
- Candidate: documents waiting for their signature.
- Approver and superadmin: a badge and pill showing certificates waiting for signature, an "Unsigned" tab and "sign all shown".

**Certificates.**
- New layout following the sample: company line as plain text, details under the training name, a separator line, start and completion dates, Learner Number, and a registration line above "Valid till". Long texts shrink to fit instead of overlapping.
- The company line can follow Settings, show the company name, be hidden, or use custom text. Set it per session or per certificate. This fixes the company-name bug: edits had no effect and long names overlapped.
- Details and registration line are entered in the training session, not the template.
- Every fixed text (intro, provider, dates, credits, learner number, trainer, valid till, signature, title) can be edited in the template; an empty one hides its line.
- An issued certificate can be fully edited (names, all texts, credits, labels, dates, number, language) with a live preview.

**Library.**
- Blank forms: attendance (single and multi-day), toolbox talk, declaration of health, trainer's evaluation, training evaluation, exam results and every practical sheet. Each can be viewed, printed or saved as PDF.
- Additional documents: admin and superadmin upload, rename and delete; trainers view and download them in their portal; editors, approvers and auditors have no access.

**Company requests.** The candidate picker has search, filters (no valid certificate for the chosen training, expiring, valid, never trained, selected), select shown or clear, and saved company groups.

**Login cards.** After a session is created you are offered the candidates' login cards: new passwords printed 24 per A4 page with cut lines, showing the training and date.

**Accounts.**
- Candidate passwords are easy to remember (e.g. `CdC12345`); the account lockout protects them.
- Staff change their own password from the account dialog. "Reset password" in Users is clearly labelled and no longer opens the role dialog.
- A candidate without ID/FIN who has the same name, surname and father's name as an existing person gives a warning; you can still proceed.

Tests: `test/round18.test.mjs`. `npm test`: 111 tests.

## Round 18b — notifications and messages
- **Approvals → "Certificates to sign"** (approver, superadmin): every certificate waiting for a signature, with preview, sign one, and sign all shown (electronic or own signature image). It is counted in the Approvals badge. The reminder pill now leads there.
- **🔔 Notifications in every portal.**
  - *To do* counts: certificates to sign, approvals, new requests, unread messages, a trainer's documents to sign, a candidate's documents to sign, a company's expiring certificates and returned registrations.
  - *Recent* events:
    - session assigned or candidate added;
    - final-day documents opened;
    - toolbox talk opened;
    - certificate ready (holder and company);
    - request sent or answered;
    - candidate sent, approved or returned;
    - new message.
  - The panel polls every 45 s. Opening it marks the events as read.
- **Messages.** Each trainer, company and candidate has one conversation with the training centre, opened from 🔔 → Messages.
  - Admin and superadmin answer from Admin → Messages, or start a conversation with anyone.
  - Messages are kept. Staff appear under their profile name (never their e-mail address).
  - A portal account can send at most 30 messages an hour.

Tests: `test/round18.test.mjs` (notifications, messages). `npm test`: 113 tests.

## Round 18c — people lists: filters, batch select and delete; folding menu
- **Filters** (⚙ Filters, remembered while you move between pages):
  - Candidates: company, status, type (local / foreign / temporary), registration date from–to, sort (newest, oldest, name, learner number).
  - Trainers: status, with or without trainings, registration date, sort.
  - Companies: status, registration date, contract date, sort.
  - Groups: company, size, creation date, sort.
- **Registration date column** on candidates, trainers and companies; creation date on groups.
- **Batch select and delete.** Each row has a checkbox, and the header checkbox selects the rows shown. "Select all that match the filters" works with any filter combination (up to 5000 candidates). "Delete selected" shows what goes with them; certificates are archived, never lost. Deleting more than 20 needs you to type DELETE, and a backup is made first (server `POST /delete/many`, groups `POST /groups/delete`).
- **Folding menu.** Click a section heading (Training, Library, People, System) to hide or show its items. This browser remembers the choice, and the open page always stays visible.

Tests: `test/round18.test.mjs`. `npm test`: 114 tests.

## Round 18d — message editing, import of many candidates, page click fix
- **Messages.**
  - Candidates, trainers and companies can edit (marked "edited") and delete their own messages.
  - Staff edit their own answers and may delete any message.
  - "Delete conversation" removes the whole history with one person; this is written to the audit trail.
- **Fixed: clicking a candidate opened "New group".** A page's click handlers stayed active after leaving it (Groups → Candidates). Each page now starts on a fresh page area.
- **Fixed: importing hundreds of candidates failed.**
  - The cause was database calls per person: the live-update counter and, for people without an ID/FIN, the same-name check, login and save. These went past the hosting platform's per-request limits.
  - A 50-row part now takes about 10 database calls, whether or not the rows have an ID/FIN.
  - The import sends 50 rows at a time with a progress count and retries a failed part once. Already-created accounts and passwords are always shown.
  - Same names, whether already registered or repeated in the file, are reported.

Tests: `test/round18.test.mjs`. `npm test`: 116 tests.

## Round 18e — certificate lines of an existing session
- The details line, registration line and company line can be edited on an existing session (Edit → "Printed on the certificates").
- If certificates were already issued from that session and their lines differ, the office is asked whether to update them:
  - **Update, keep signatures:** a signature covers the name, number, training and dates, which do not change.
  - **Update, withdraw signatures:** the certificates are signed again, and approved again when certificate approval is on.
  - **Not now.**
- Revoked certificates are not changed. Every update is written to the audit trail (`POST /session/cert-lines`).

Tests: `test/round18.test.mjs`. `npm test`: 117 tests.

## Round 19 — audit, security fixes, diagnostics, dark-mode logo
- **Logo in dark mode:** it sits on a small white plate with rounded corners (home, sign-in, top bar, verification page).
- **Phone layout:**
  - The home page no longer scrolls sideways (the portal cards were cut off).
  - The top bar fits on 375 px screens.
  - Long text in phone tables wraps.
- **Security fixes found by the audit:**
  - A company request could carry another company's certificate numbers. They are now dropped.
  - Two tabs handing in the same exam at the same moment could both be graded. The hand-in is now claimed atomically (one per attempt).
  - Sign-in limit per address:
    - Only failed attempts count now (100 in 15 minutes); before, a successful sign-in reset the counter, so someone guessing could reset it with an account of their own.
    - A classroom behind one address never trips it.
    - Failures older than 15 minutes are forgotten. This needs the `login_fail` function from `schema.sql`.
- **Diagnostics:**
  - Unexpected server failures are written to System → Error log, with a reference the person sees in the message.
  - The app tells hosting refusals (rate limit, block, outage) apart from its own errors.
- **Database:** new indexes for notifications, messages, company groups, the error log and import checks. Run `schema.sql` again; it is safe to repeat.
- **Load:** the bell in the portals polls every 90 s, and imports go 25 rows per request.
- **Code hygiene:** 77 unused imports removed; the demo build is fixed (target es2022) and rebuilt.
- **New tests:**
  - `test/audit.test.mjs`: every route × every kind of account (≈1,700 requests); no 5xx on malformed input; data isolation; forged and expired tokens; disaster recovery (wipe everything, restore, compare record by record); error log; sign-in limits.
  - `test/load.test.mjs`: 300 candidates hand in at the same moment.
- **Staging load test:** `tools/loadtest.k6.js` (100 / 300 / 500 / 1000 candidates).

`npm test`: 124 tests.

## Round 19b — offline-safe exams, system health, bulk import, fixes
- **Fix: logo and images missing.** The previous package left out every PNG file (a packaging mistake): the logo, icons and accreditation logos. They are back.
- **Exams through a network outage.**
  - Answers are kept on the phone at every change and reach the server 3 s after the last change: at least every 15 s while typing, and before the hand-in. Nothing is saved per keystroke.
  - If the network drops, answering goes on. The hand-in waits on the phone and is sent by itself when the connection returns (it is retried every 8 s and on reconnect); after a reload the exam reopens from the phone's copy.
  - The phone's copy belongs to one attempt. Before, after a reset, answers of the previous attempt could reappear.
  - **Fix: a hand-in after the time limit could still change answers.** Now answers sent more than 5 minutes after the time limit do not count, only those saved in time. The trainer sees "sent N min after the time limit".
- **System → Health** (opens first):
  - database and file storage response times, the last backup, errors in 24 h / 7 days, API requests today against the Cloudflare plan's daily limit, and the database size against the Supabase plan;
  - each line is green / amber / red with what to do;
  - API requests are counted by the app (1 in 10 sampled, ±10 %); the plan choice is in the same tab. Database size needs `schema.sql` run again.
- **Bulk import:**
  - up to 300 rows per request (one database write per part);
  - the browser starts with parts of 100 and, if the hosting plan cuts a part off (CPU: every new password is hashed), resends it in halves;
  - a part sent twice never creates anyone twice: the first run's results come back, and passwords not shown are marked for reset.
- **Exam pictures** are served from Cloudflare's edge cache (no signing, no storage read per candidate).
- **Network errors** show "No internet connection" instead of "Server error".

`npm test`: 127 tests.

## Round 19c — lists a page at a time
- Long lists show one page at a time: 25, 50 or 100 rows (50 by default). Each list remembers its choice in the browser.
- The pager has numbered pages, previous / next, and "go to page" when there are more than 7 pages. A new search or filter starts again at page 1.
- **Paged by the server** (only the page shown is fetched): candidates, certificates, audit trail.
- **Paged on screen:** trainers, companies, groups, trainings, tests, certificate templates, practical sheets, presentations, additional documents, requests, archive, certificates to sign.
- **Portals:** the company's certificates and people, and the trainer's list of sessions.
- Batch selection ("select the rows shown") works on the page shown; "select all that match" still covers every page.

## Round 20 — type checking; one table per collection with database rules
**Type checking** (`npm run typecheck`, `npm run check` = type check + tests)
- `tsconfig.json` checks every server and browser file (`checkJs`); the code stays plain JavaScript (no build step), the
  types come from JSDoc and `types/*.d.ts`. Result: **0 errors** (217 at the start).
- `types/records.d.ts` describes the records of 24 collections; `types/store.d.ts` the data layer. Every route table is
  declared as `Routes`, so inside a route `c.D.get('trainees', id)` is a `Trainee` and a misspelt field is an error.
- Real bugs it found: PowerPoint import lost the Wingdings/Symbol bullet characters (3 duplicate empty keys — ✓ ■ ➢ •
  bullets showed as the raw private-use characters); the trainee portal "Back" button referenced variables that did not
  exist (fixed in 19b, found by this); several dates handled as numbers.
- Not yet `strict` mode: `null` checks and implicit `any` are the next step (see "Next").

**Database: one table per collection** (`schema.sql` v5)
- `records` is now a partitioned table: each collection has its own table (`rec_trainees`, `rec_certs`, `rec_sessions`,
  `rec_enr`, `rec_audit` … 38 in all, plus `rec_other`). Postgres sends every read and write only to that collection's
  table; each has its own indexes, statistics, vacuum and size (System → Health → "Largest tables").
- Database-enforced rules for 24 collections (`functions/_lib/shapes.js`): required fields and their types, the record
  key must match the id / certificate number, dates must be YYYY-MM-DD. A write that breaks them is refused by Postgres
  whatever code makes it (error "badRecord", logged with a reference). The tests run the same rules on every write.
- `schema.sql` is generated from `shapes.js` (`node tools/gen-schema.mjs`; a test fails if they drift apart).
- Upgrade is non-destructive: the old table is kept as `records_v4` with every row; the copy is counted and the whole
  run is one transaction. Old rows that break a rule are listed by `select * from shape_problems;` and reported on
  System → Health; their rule stays "not validated" until they are fixed. Tested on Postgres 16 with 7,379 records.
- Unchanged: the app code, the API, backups and restore (one transaction), the stored data format.
- Found by the new rules on the live data: 5 enrolments saved before v3 had no trainee field (`tid`), so the current
  version did not show their attendance, exam and feedback. They now get it from their key when read or restored
  (an old backup restores cleanly), and a one-off SQL fills it in the database.
- Tests: 133 pass.

## Round 21 — strict type checking, CI/CD pipeline, security hardening, browser tests
**Strict mode** (`tsconfig.json`: `"strict": true`)
- Every strict check is on: null / undefined handling, strict function types, `unknown` in catch blocks, `this`,
  property initialisation. 1,190 findings fixed; `npm run typecheck` reports 0 errors.
- One check stays off on purpose: `noImplicitAny`. In plain JavaScript it would demand a written type on each of
  ~2,800 function parameters; filling them with `any` would be strictness on paper only, and real types for all of
  them amount to rewriting the project in TypeScript. Records, the data layer, routes and helpers are typed.
- `need()` is now an assertion the checker understands, so "record found" checks narrow the types after them.
- Real bugs strict mode found and fixed:
  - Profile, signature and two-factor set-up crashed (500) for a staff account created directly in Supabase without a
    staff record; it is now started on first use.
  - Editing a certificate without an end date or with no expiry was refused as "bad date".
  - The office panel threw an error when a list finished loading after the person had already moved to another page
    (found by the new browser tests); all 20 page redraws now stop when their page is gone.
  - Damaged PowerPoint / Excel files now give "bad file" instead of a script error.

**CI/CD** (`.github/workflows/ci.yml`)
- On every push and pull request: type check, schema check, 134 tests, demo build, and the browser tests in Chromium.
- On `main`, when all pass: deploy to Cloudflare Pages (needs the secrets `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`; skipped without them). The database is never changed by the pipeline.
- `npm run check` runs the same checks locally.

**Security hardening**
- Security headers now also on every API answer (`nosniff`, `DENY` framing, `default-src 'none'` CSP, no-store,
  same-origin resource policy): the site's `_headers` file does not reach Functions.
- Requests that change data are refused when they come from a page on another website (`badOrigin`). Bearer-token
  sign-in already prevented cross-site forgery; this is a second lock.
- JSON bodies limited to 2 MB (`tooLarge`, 413); the largest real one is ~150 KB.
- `db_size` / `table_sizes` (security-definer functions) have a fixed `search_path` (Supabase's linter rule).
- Already in place and re-checked: sign-in limits per account and per address, row-level security with no policies,
  role checks on every route, input length limits, HTML escaping, CSP and HSTS on pages.

**Browser tests** (`e2e/flows.e2e.mjs`, `npm run e2e`): office sign-in and every menu page; certificate list, preview
and the public QR page; trainer, company and candidate portals with the bell; an online exam where the network drops
before the hand-in (answers kept on the phone, sent when it is back, all counted); wrong password; phone width.

## Round 22 — learner numbers, numbering per year, notification controls
**Change a candidate's learner (attendance) number** — Candidate → Change number (admin and superadmin).
- For people from earlier years: give them back their old number. Sessions, results, signatures and certificates stay
  attached (the record keeps its key). The sign-in name follows the number when it was the number; the password stays.
- Certificates keep the number printed on them, unless "also change it on this person's certificates" is ticked: then
  they change too, and signed ones must be signed again (their content changed).
- A number already used by someone else is refused. The person can still be found by their previous number.

**Numbering**
- Learner numbers now restart at 00001 every 1 January (Baku time), like certificate numbers; this year continues from
  the current number. Every counter only goes up: numbers of deleted people or certificates are never given again
  (gaps are expected, and required for certificates: a number that was printed must never point at someone else).
- A number typed in by hand (e.g. an earlier year's, or this year's next one) is skipped when the counter reaches it,
  in single registration, approvals, first sign-in of temporary accounts and Excel import.

**Notification panel** (every portal)
- To-dos (certificates to sign, approvals, requests, …): ⏰ "remind me tomorrow" hides one until the next day; it comes
  back at once if more of that work arrives, and disappears by itself when the work is done.
- Events: ✓ removes one, "Clear all" empties the list, 🔕 never shows that kind again (information only: things that need
  action cannot be muted). "Show everything again" undoes all of it. Each person's choices are their own.
- Events tied to work vanish for everybody once it is handled: a new company request (when its status changes), a
  candidate to approve (when decided), a new message (when read or answered), in the portals too.
- schema.sql: one new index for this (optional; run it when convenient, the app works without it).
- Tests: 137 pass; browser tests: 7 pass.

## Round 23 — messages between office users; clearing conversations; deleted accounts
**Team messages** (Admin → Messages, every office role, approvers and auditors included)
- "New message" → Colleague: a one-to-one conversation with another office user. Unread count on the menu and in the
  bell; the "new message" event disappears once read. Each person edits or deletes only their own messages.
- "Clear conversation" clears it for me only; once both people have cleared it, those messages are deleted for good.
- Admins and the superadmin see team and portal conversations in one list (👥 colleague, 🎓 trainer, 🏢 company, 👤 candidate).

**Portal conversations**
- Trainers, companies and candidates can clear the conversation on their side (🔔 → Messages → Clear conversation);
  the training centre keeps its copy. Office: "Delete conversation" removes it for everybody (as before).

**Bug fixed: deleted accounts left their messages behind**
- Deleting a trainer, company or candidate (one or many) now removes their conversation, its messages, their bell
  events and panel settings. Deleting an office user removes their team conversations.
- Conversations left over from accounts deleted earlier disappear (and are removed) the next time Messages is opened.
- A temporary candidate account that becomes a registered one keeps its conversation.
- Tests: 140 pass; browser tests: 8 pass.

## Round 23b — signature reminder; Cloudflare build step
- The "certificates waiting for your signature" reminder (bottom of the screen) follows the bell: when it is put off
  until tomorrow (⏰ in the bell, or the new ✕ on the reminder itself) it stays hidden, also after reloading, until
  tomorrow or until more certificates arrive. It no longer covers the bottom of the menu.
- `npm run build` exists (prepares the preload list), so a Cloudflare build command of `npm run build` works.
- Browser tests: 9 pass.
