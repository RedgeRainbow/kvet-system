# KVET Training Management System: deployment

Browser -> Cloudflare Pages (static pages in `public/` + the `/api` Function in `functions/`) -> Supabase (data + staff sign-in) and R2 (logo, signature, stamp, presentations, camera snapshots, backups).
No secret is stored in any file. Only the Supabase URL and publishable key are in `wrangler.toml` (public by design). The frontend never talks to Supabase directly.

## Portals
| URL | Who |
|---|---|
| `/` | Portal chooser |
| `/admin.kvet` | Superadmin / Admin / Editor / Reader (Supabase sign-in by e-mail). Not linked anywhere; `/admin` and `/admin.html` give 404. To change the address, edit `public/_redirects`. For real protection on top of the sign-in + two-factor, put Cloudflare Access (Zero Trust, free up to 50 users) in front of `/admin.kvet*` so only your staff's e-mail addresses even see the page. |
| `/audit.kvet` | External auditors (ECITB, IOSH, ISO, AITT…): same sign-in as staff, read-only. Create them in Admin -> Users with role **Auditor** and an end date; the account stops working after that date. Every page they open is written to the audit trail. |
| `/trainer` | Trainers (login + password created in Admin -> Trainers) |
| `/trainee` | Trainees (login = learner number, password generated; see Excel import) |
| `/company` | Companies (login + password created in Admin -> Companies) |
| `/verify.html?n=…&h=…` | Public QR page: learner number, name(s), training dates, expiry date, status only. No certificate view or download. |

## 0-ci. Automatic checks and deploys (GitHub Actions)
The project includes `.github/workflows/ci.yml`. Put the project in a GitHub repository; every push then runs the type
check, the schema check, all tests and the browser tests. To let pushes to `main` deploy automatically, add two
repository secrets (Settings -> Secrets and variables -> Actions): `CLOUDFLARE_API_TOKEN` (permission "Cloudflare
Pages: Edit") and `CLOUDFLARE_ACCOUNT_ID`. Database changes are never automatic: when CHANGES.md says to run
`schema.sql`, run it in Supabase before pushing. The scheduler Worker (`workers/cron`) is deployed by hand as before.

## 0. Upgrading to round 20 (one table per collection) — do this BEFORE deploying the new code
1. Supabase -> Database -> Backups: make sure there is a backup from today (or download one from Admin -> System -> Backups).
2. Supabase -> SQL Editor -> paste the whole `schema.sql` -> Run. It converts the single `records` table into one table per
   collection (`rec_trainees`, `rec_certs` …), copies every row (checked by count), and keeps the old table as
   `records_v4`. It runs as one transaction: if anything fails, nothing changes. A few seconds for tens of thousands of rows.
3. Read the messages under the editor. A line such as `rec_trainees: 3 old rows break the shape rule` means some rows
   saved by an old version miss a required field. See them with `select * from shape_problems;` and send the list to the
   developer: these rows can still be read, but saving them is refused until they are corrected.
4. Deploy. System -> Health shows "Database structure: 38 tables · no rule problems".
5. After a few weeks without problems: `drop table records_v4;` (frees the space of the old copy).
   Going back: just deploy the previous version. It works with the new tables as they are (same columns, same
   functions), so no data written after the upgrade is lost.

## 0a. Upgrading to the "years of data" version (round 17) — do this BEFORE deploying the new code
1. Supabase -> SQL Editor -> paste the whole `schema.sql` -> Run. It adds the database indexes the lists now rely on
   (search, certificate status, sessions by date, open results …), the `pg_trgm` extension for name search, and the
   `records_in` function (many records in one call). Safe to re-run. If `pg_trgm` is refused, enable it under
   Database -> Extensions, then run the file again.
2. Deploy. The first time an office user opens the panel, existing trainees and certificates get their search key and
   renewal flags (one-time, a few seconds with tens of thousands of records).
3. Nothing else changes for users, except: the Trainees and Certificates pages search on the server (type to search,
   "Show more" for the next page); the Sessions page shows the last 4 months and loads older ones on request; the audit
   trail shows the last 3 months unless dates are chosen; the trainer portal lists the last 12 months ("Show older").

1. Supabase -> SQL Editor -> paste `schema.sql` -> Run (adds login counters, the restore staging table and new functions; safe to re-run).
2. Add the new secrets (section 3): `CRON_SECRET` (required for the scheduler), optionally `RESEND_API_KEY` + `MAIL_FROM`, `SUPABASE_JWT_SECRET`, `SMS_WEBHOOK_URL`.
3. Deploy, then deploy the scheduler Worker (section 3b).
4. Admin -> System -> **Repair login registry** once (portal sign-in no longer scans for unregistered accounts).
5. Admin -> Practical sheets -> **Update starter sheets** to load the Overhead Crane / Appointed Person layouts that match the paper forms.
6. If you used the camera bridge: replace it with the new `tools/camera-bridge.mjs` and start it with `--origin https://<your domain>`; paste the printed token in Admin -> Cameras -> Camera bridge.

## 1. Database (Supabase)
SQL Editor -> paste `schema.sql` -> Run. (Re-running is safe.)
**Supabase -> Authentication -> Sign In / Providers -> turn OFF "Allow new users to sign up".** The publishable key is public by design; with sign-ups off nobody can create an account with it. Staff are only created in Admin -> Users.

## 2. First superadmin
Supabase -> Authentication -> Users -> Add user (e-mail + password, tick "auto confirm").
Put the same e-mail in `wrangler.toml` as `BOOTSTRAP_ADMIN_EMAIL`: that user is superadmin on first sign-in. The bootstrap only works while the system has **no superadmin at all**; after the first sign-in it is ignored (you can also delete the line).
Further staff (superadmin / admin / editor / reader) are added in the app: Admin -> Users.

## 3. Deploy
    npx wrangler login
    npx wrangler pages project create kvet-certificates --production-branch main
    npx wrangler pages secret put SUPABASE_SERVICE_KEY --project-name kvet-certificates
    npx wrangler pages secret put TOKEN_SECRET --project-name kvet-certificates      # any long random string
    npx wrangler pages secret put CRON_SECRET --project-name kvet-certificates       # another long random string (scheduler)
    # optional:
    npx wrangler pages secret put RESEND_API_KEY --project-name kvet-certificates    # e-mail reminders (resend.com)
    npx wrangler pages secret put MAIL_FROM --project-name kvet-certificates         # e.g. KVET <noreply@kvet.edu.az> (domain verified in Resend)
    npx wrangler pages secret put SUPABASE_JWT_SECRET --project-name kvet-certificates  # only for older projects with the legacy HS256 JWT secret
    npx wrangler pages secret put SMS_WEBHOOK_URL --project-name kvet-certificates   # your SMS gateway: receives POST {to, text}
    npx wrangler pages secret put EMERGENCY_PASSWORD --project-name kvet-certificates  # optional: break-glass account, see 5c
    npx wrangler pages deploy public --project-name kvet-certificates
R2 is connected through the `BUCKET` binding, so no R2 keys are needed.
`TOKEN_SECRET` also encrypts the camera passwords at rest: do not change it later (saved camera passwords would have to be typed again).

## 3b. Scheduler (daily backup, expiry reminders, ID/FIN retention)
    cd workers/cron
    # set APP_URL in workers/cron/wrangler.toml to your live address
    npx wrangler secret put CRON_SECRET          # same value as the Pages secret
    npx wrangler deploy
It runs every day at 04:17 Baku time. Test it: `curl -H "x-cron-key: <CRON_SECRET>" https://kvet-cron.<account>.workers.dev/` (opening `…/?key=<CRON_SECRET>` in a browser still works, but leaves the secret in the browser history).
Without the scheduler a backup is still made when an admin opens the panel (at most once a day), but reminders and retention do not run.

## 3c. Backups and disaster recovery (v3.36)

**What a backup is.** One file per night in the R2 bucket (`backups/…​.kvb`, 90 kept): every record, the audit trail, the
user list with roles, the counters, and the small pictures (logo, accreditation logos, signatures, stamp). It is written
as a stream, so its size is not limited by the worker's memory, and it is **encrypted** (AES-256-GCM). Not in it: session
photos, presentations and question pictures (they stay in R2) and staff passwords (they live in Supabase Auth).

**The key.** By default the key is derived from `TOKEN_SECRET`. Better: set a separate secret and keep a copy of it
*outside Cloudflare* (a password manager, a sealed envelope) - a backup without its key cannot be read by anybody:

    npx wrangler pages secret put BACKUP_KEY --project-name kvet-certificates     # any long random text; then redeploy

Files made before the key changed need the old key: keep old values. System -> Backups -> "✓ Check" says whether the
current key opens a file.

**Every night** the scheduler writes the backup, reads it back, decrypts it and counts its records. If that fails,
superadmins get a notification and the audit trail gets a `backup.bad` row.

**Keep a copy elsewhere.** System -> Backups -> ⬇ downloads the encrypted file. "📄 Readable copy" downloads it decrypted
(plain text, one record per line) - that download is written to the audit trail; treat the file like the database itself.

**To restore** (superadmin): System -> Backups -> Restore, or "Upload a backup" first when the file is not in the bucket
any more. The file is checked completely before anything changes, a safety backup of the current state is made first,
and the swap is one database transaction. Afterwards: the audit trail is kept as it is (its rows are added back only
where they are missing - a new, empty database gets the whole trail); users of the backup who no longer exist in
Supabase Auth must be re-invited.

**After losing the whole Supabase project:** create a project, run `schema.sql`, set the Pages variables to it, sign in
with the `BOOTSTRAP_ADMIN_EMAIL` account, upload the backup, restore.

**Drills.** Two scripts prove the path end to end by deleting every record and comparing checksums before and after:

    # on any computer with PostgreSQL installed: the real storage code against a real database, nothing of yours touched
    npm run drill:local -- --psql "psql -h localhost -U postgres -d kvet_drill" --people 500
    # on a STAGING copy (a second Pages project + a second Supabase project); refuses the production project
    npm run drill:staging -- --api https://kvet-staging.pages.dev --email you@kvet.az --password '…' \
         --supabase-url https://<staging-ref>.supabase.co --service-key '<staging service key>' --confirm <staging-ref>

Run the staging drill once now and after every change to `schema.sql`; write the date down.

## 3d. Certificates for candidates and companies (v3.36)

**The switch:** Settings -> Two-factor sign-in card -> "Draw certificates on the server" (superadmin; **off** after the
upgrade; every change is written to the audit trail).

| | Off (Workers Free plan) | On (Workers Paid plan) |
|---|---|---|
| Who draws a candidate's / company's certificate | their browser, as before v3.36 | the server: a finished PDF (`certpdf.js`) |
| Signature picture | sent only to the signed-in owner of that certificate (`GET /api/portal/…/cert/sig`) | never sent to a portal |
| Processor time per certificate | none on the server | 50-150 ms for the first drawing, then served from R2 |

Turn it on the day you move to the Paid plan (Cloudflare -> Workers & Pages -> Plans), open one certificate as a
candidate and one as a company, and turn it off again if you go back to Free. Nothing else has to be changed either way.
On the Free plan with the switch on, requests may be cut off by the 10 ms limit (error 1102) and certificates will not open.

In both positions:

- Signature and stamp pictures are **not public files any more**. `/api/asset/<name>` serves only the current logo and
  accreditation logos; every other picture needs the office pass that signed-in staff pages receive (it changes daily).
  Addresses that earlier versions handed to portals stopped working with this deploy - nothing to rotate.
- (On) A certificate is drawn on its first request and kept in R2 (`certpdf/`); it is drawn again only after it changes
  (signature, correction, logo). Prepared pictures are kept in `pdfimg/`. Both folders can be emptied at any time.
- The office preview and print still use the browser version (`public/js/cert.js`). **A change to the certificate's
  layout must be made in both files**; `test/phase4.test.mjs` checks that the words agree.

## 4. First run
Admin -> Settings: company info, logo, stamp, accreditation logos, certificate numbering (default `CRT/26/0001`, restarts every year).
Certificate signatures are personal: each admin/superadmin opens **My account** (top right), fills in **name and title**, and optionally uploads their **signature image**. Only admin and superadmin can sign certificates (electronically or with their image); editors, readers, trainers and trainees cannot.
Then: Certificate blanks (use "Add starter templates" for samples), Practical sheets, Presentations, Companies, Trainers, Trainees (Excel template available), Sessions.

## 5. Roles
- **Superadmin**: everything, including deleting records, backups/restore, users, cameras; signs certificates and documents.
- **Admin**: everything except deleting, users and cameras. Sees and enters ID/FIN, issues (releases) certificates, enters results, confirms company candidates. Does not sign certificates.
- **Editor**: manages certificate blanks, practical sheets, presentations, question banks and sessions. Cannot see ID/FIN or issue certificates.
- **Approver**: the Approvals queue (question banks, presentations, certificates, company candidates; return needs a comment), reads Trainings and Certificates, and signs certificates and every session document (electronic signature or own uploaded signature image under My account). Creates and deletes nothing.
- **Auditor**: reads the training section only (Trainings with documents, Certificates, Analytics), without ID/FIN or contact details, and cannot download, print or export files. Signs in at `/audit.kvet`; give the account an end date. The former "reader" role is now the auditor role.
- What needs approval is set by the superadmin in Settings -> **Approvals**. Trainers' own question banks always go to the queue.
- If someone cannot sign in: the sign-in screen names the reason, and Admin -> Audit trail lists every failed sign-in with it (wrong password, no role in KVET, account period ended, locked).

## 5b. AI module (optional, off by default)
Everything is set up by the superadmin in Admin -> **AI**. Nothing has to be added to Cloudflare.
1. Choose a **provider** and paste its **API key** (the link under the field opens the page where you get one).
2. Optionally press **Load models** and pick a model (empty = the default shown in grey).
3. Press **Test connection**: it should answer "Working: <model>".
4. Tick **Switch on the AI module**, choose chatbot / explanations and the daily limit per person, **Save**.

| Provider | Cost | Key |
|---|---|---|
| Google Gemini | free tier (limits per Google project; free-tier prompts may be used by Google to improve its products) | aistudio.google.com/apikey |
| Groq | free tier (per-minute and per-day limits) | console.groq.com/keys |
| Cloudflare Workers AI | free daily allowance (10,000 "neurons"/day) | Cloudflare account ID + API token with "Workers AI" permission, or the `[ai] binding = "AI"` in wrangler.toml (then no key) |
| OpenRouter | models ending in `:free` are free with a small daily limit | openrouter.ai/keys |
| Anthropic Claude | paid per use | console.anthropic.com |
| Other | any OpenAI-compatible service (base URL + key) | — |

- The key is stored **encrypted** (with `TOKEN_SECRET`) and is never shown again or sent to any browser; the page only shows its last 4 characters. Leave the field empty to keep it; tick "Remove the saved key" to delete it. A Cloudflare secret (`GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, …) still works as a fallback.
- **Knowledge base**: admins add the centre's approved texts (paste, .txt, .md or .docx). The trainee chatbot answers only from these texts, in AZ/EN/RU; when they do not cover a question it says so and refers to the trainer.
- **Test explanations**: after the exam of a session is ended, candidates can ask for an explanation of each multiple-choice question. Explanations never change scores, keys or certificates. Each explanation is generated once per language and reused.
- **Trainee portal**: the "Süni intellekt" tab (chatbot + the trainee's tests with explanations). Explanations appear automatically under each question once the trainer has ended the exam.
- **Analytics & reports**: admin panel (superadmin, admin, auditor), trainer portal and company portal. The figures work without AI; the AI summary needs the module on and "AI summary in reports" ticked.
- One chatbot question uses 1–2 model calls; the daily limit per person controls usage. Chat questions are recorded in the audit trail.

## 5c. Emergency account (superadmin lockout)
A hidden break-glass account for when no superadmin can sign in (lost password, lost authenticator, person left):

    npx wrangler pages secret put EMERGENCY_PASSWORD --project-name kvet-certificates   # 20+ random characters

Keep the value offline (sealed envelope / safe). Sign in at `/admin.kvet` with **admin_emergency** and that password, go to Users and give the superadmin a new password or reset their two-factor, then sign out. Afterwards change or delete the secret (`npx wrangler pages secret delete EMERGENCY_PASSWORD`): that ends every emergency session at once. Without the secret the account does not exist.
It has admin rights plus user management, cannot delete or restore backups, and every use is logged and shown to the superadmin.

## 6. Decisions made on the brief (change on request)
- **ID/FIN** is visible and creatable only by admin and superadmin; never in QR page, company, trainer or trainee portals.
- **Result flow**: absent -> FAIL; any failed practical = automatic FAIL; otherwise the admin enters the exam result and releases PASS (certificate) or FAIL (no certificate).
- **Transliteration** az -> en (q->g, x->kh, j->zh, ə->a, ş->sh, ç->ch, ğ->gh, ı->i, ö->o, ü->u, "oğlu"->"oghlu"); always editable. Foreigners have an English name only.
- **Renewals** keep ID/FIN and learner number and get a new certificate number; certificate numbers are unique and never reused.
- **Presentations** open only inside the system (rendered in the page, no download/print buttons, shortcuts and right-click blocked, watermark). A determined person can still photograph a screen; no web page can prevent that.
- **Certificate**: layout, font (Mulish, bundled in `public/fonts`) and accreditation logos follow the supplied sample; every line is within 1 px of it. English names follow the brief's transliteration (q->g: "Qocayev" -> "Gojayev"); the sample PDF from the old system printed "Qojayev". The English name is editable per person. Company line: Settings -> Results and certificate (off = as on the sample).
- **Foreign candidates**: document type (passport / residence permit / ID / other), nationality, and an English-only certificate if wanted.
- **Feedback before PASS** (Settings, on by default): a PASS is released only after the trainee gave feedback; FAIL needs none.
- **Practical sheets**: printouts reproduce the two paper forms. A penalty sheet only gives a result once the examiner ticks "Test completed" (an empty sheet is never a pass); disqualification or going over the limit is a FAIL immediately.
- **Requests**: companies request trainings / renewals in their portal; staff answer in Admin -> Requests.
- **Cameras**: superadmin can connect a browser/USB camera, take snapshots, save set-ups (also IP camera links) and clear everything.
- **Deleting (superadmin only)**: every list has 🗑. The confirm box first shows what else goes with it (sessions, enrolments, certificates…). Certificates are never destroyed by a delete: they move to **Certificates → Archive**, where they can be restored or deleted for good. Trainers, companies, sheets and presentations are removed and whatever pointed at them keeps working without the link.
- **Delete old data**: System → *Delete old data*: tick the kinds, optionally "older than" a date, see the counts, type DELETE. A backup is made first. The audit trail is never deleted.
- **Audit trail** (Admin and up): own menu item. Sign-ins (also failed ones with the reason), every create/update/delete with before → after values, IP address, filters, paging, Excel export. ID/FIN values are never written to it.
- **Dashboard**: period (this month / last month / this year / any month), tiles that open the filtered list (e.g. *Expiring ≤90 days* → Certificates filtered), training volume by company, most delivered courses. Tiles, days-ahead and list length: Settings → Dashboard. Pass rate = passed ÷ released results.
- **Trainer portal**: a trainer can add existing candidates to his/her own session or register a new one (ID/FIN is write-only and never shown back; one-time login is shown for printing).
- **Practical sheets** follow the paper forms: faults × penalty = award (range items such as 3-5 pick the points), time block with duration and excess time calculated, time penalty suggested from *points per minute* (sheet setting, default 1, examiner can overwrite), mandatory disqualification, examiner reg. number. Settings fields can auto-fill from the session (candidate, company, date…). Use *Practical sheets → Update starter sheets* once to load the new Overhead Crane / Appointed Person layouts.
- Legacy data from the previous app (feedback, old certificates) is **not** migrated; ask if you want a migration script.

## 6b. Certificates and cameras (round 2)
- **Certificate layout** follows the supplied sample PDF (A4, absolute positions: logo, title, number, name, course, validity, red notice, signature, QR, up to 7 accreditation logos from Settings, address line). The Mulish font files are included in `public/fonts` (SIL Open Font License, `public/fonts/OFL.txt`).
- **Camera at another place**: run the bridge where the camera is with `--tunnel` (the "remote" start file installs cloudflared on Windows). It prints an `https://….trycloudflare.com` address. Enter it plus the token in Admin -> Cameras -> Camera bridge from anywhere. The address changes each time the bridge restarts; for a fixed address create a named Cloudflare Tunnel (e.g. `camera.kvet.edu.az`) pointing at `http://127.0.0.1:8899`.
- **Frame rate**: video-stream cameras (IP Webcam `/video`, MJPEG, RTSP) are passed through at the camera's own rate (RTSP converted at 15 fps). Snapshot-only cameras are turned into a 15 fps stream by the bridge. The viewer shows the real rate measured by the bridge. In IP Webcam, lower the resolution / quality if the Wi-Fi is slow.
- **Network (IP) cameras on Wi-Fi / LAN**: browsers cannot open `http://` cameras from an https page, play RTSP or do Digest login. Run the small bridge on a PC in the same network as the camera: `node tools/camera-bridge.mjs --origin https://<your domain>` (needs Node; ffmpeg only for RTSP). It prints a token: paste it once in Admin -> Cameras -> Camera bridge. Only your admin page may use the bridge, only with the token, and it only relays pictures from local-network cameras. Env: `PORT` (default 8899), `BIND` (default 127.0.0.1), `ALLOW_ORIGIN`, `BRIDGE_TOKEN`. Admin -> Cameras -> *Camera bridge* shows the same help and a Test button. Enter IP, port, login, password and press *Detect & connect*; the picture is shown live and the camera is saved (superadmin-only; password is stored with the camera record). The bridge only talks to private (LAN) addresses. Phone apps: *IP Webcam* (Android) -> IP of the phone, port 8080 (the system tries `/video`, `/shot.jpg`); phone and PC must be on the same Wi-Fi and the bridge must be running on that PC.

## 7. Security
- Rotate any key that was ever pasted in a chat (Supabase service key; R2 keys if created).
- **Required:** Cloudflare dashboard -> your domain -> Security -> WAF -> Rate limiting rules -> Create:
  *If* `URI Path` *is in* `/api/login`, `/api/staff/login`, `/api/staff/mfa/verify` (method POST) -> *rate* 20 requests per 1 minute per IP -> *action* Block for 10 minutes.
  The app itself counts every attempt first and atomically in the database: 8 attempts per account and 40 per IP address, then 15 minutes locked.
- Security headers (Content-Security-Policy, HSTS, no framing) are set in `public/_headers`. If you add a custom domain with sub-domains you do not control over HTTPS, remove `includeSubDomains` from HSTS.
- Two-factor sign-in for staff: Settings -> Two-factor sign-in (optional / admins / all staff). Each person sets it up from the account button (top right). A superadmin can reset it in Users (lost phone).
- Backups contain every ID/FIN and the password hashes: they are encrypted in the bucket, and only a superadmin can download them (section 3c). Camera passwords are stored encrypted.
- Trainers only see people from their own sessions; anyone else is added by exact learner number. A trainer who registers an existing ID/FIN only learns "already registered".
- Custom domain: Pages project -> Custom domains. QR codes use the domain the certificate was opened on, so open certificates on the final domain.

## 7a. Notes
- PDF presentations open in the browser's own PDF viewer. Some mobile browsers (older Android) show a download link instead of the page; PowerPoint files are always shown as slides.
- Presentations: up to 60 MB per file.

## 7b. Electronic signatures
Documents are signed with the signed-in account (with two-factor sign-in this is a strong internal e-signature). Every signature carries a code that anyone can check at `/verify.html?s=CODE`; it detects later changes.
For a **qualified electronic signature** with the legal force of a handwritten one under Azerbaijani law (ASAN İmza / e-imza with a certificate from the national certification centre), the documents would be signed as PDF files with the signer's ASAN İmza through its signing service. That needs a contract and integration with the provider and is not included.

## 7c. Demo copy for outside reviewers (web developers, auditors)
Never give reviewers the project files, your real system, your keys or a superadmin account. Give them a separate demo instead:
1. `npm run build:demo` → folder `dist-demo/` (browser code bundled + minified, copyright notice on every file, orange DEMO banner, no docs/tests/tools).
2. Create a **new** Supabase project (run `schema.sql` there, turn sign-ups off, add yourself as a user) and a new R2 bucket `kvet-demo`. Put the demo project's URL, publishable key and your e-mail in `dist-demo/wrangler.toml`.
3. `cd dist-demo` → `npx wrangler pages project create kvet-demo` → add the secrets (`SUPABASE_SERVICE_KEY` of the DEMO project, a new `TOKEN_SECRET`) → `npx wrangler pages deploy public --project-name kvet-demo`.
4. Fill it with fake data and create the reviewer logins (read-only by default):
   `node seed-demo.mjs --url https://kvet-demo.pages.dev --email <you> --password <yours> --reviewers dev1@x.com,dev2@y.com` (add `--role editor` if they must try changing things). It prints all logins to send.
5. Recommended: Cloudflare Zero Trust → Access → Application for `kvet-demo.pages.dev` → allow only the reviewers' e-mails → session duration e.g. 3 days.
6. Afterwards: delete the reviewer users, or the whole `kvet-demo` Pages project, Supabase project and bucket.
Everything reviewers do is in Admin → Audit trail (sign-ins with IP address).

## 8. Tests
    npm test                             # API workflow, roles, numbering, scoring, i18n key coverage
    node tools/dev-server.mjs            # local app on http://localhost:8787 (boss@kvet.az / bosspass123, in-memory data)
