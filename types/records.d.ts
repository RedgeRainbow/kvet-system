/* The records of every collection, for the type checker (npm run typecheck).
   Required fields mirror functions/_lib/shapes.js (enforced by the database); the optional ones are every other field the
   code writes. A field missing here is a type error where it is read, so typos in field names are caught. */
export interface Trainee {
  att: string;
  certLang?: string;
  co?: string;
  consent?: any | null;
  createdAt?: string;
  createdBy?: any;
  docType?: string;
  email?: string;
  father?: string;
  fatherEn?: string;
  fin?: string;
  finRemovedAt?: string;
  foreign?: boolean;
  hash?: string;
  id: string;
  linkPending?: string;
  login?: string;
  name?: string;
  nameEn?: string;
  nationality?: string;
  on?: boolean;
  phone?: string;
  pv?: number;
  registeredAt?: string;
  salt?: string;
  sk?: string;
  surname?: string;
  surnameEn?: string;
  temp?: boolean;
  wasTemp?: string;
}
export interface Trainer {
  createdAt?: string;
  email?: string;
  father?: string;
  fatherEn?: string;
  fin?: string;
  foreign?: boolean;
  hash?: string;
  id: string;
  login: string;
  name: string;
  nameEn?: string;
  on?: boolean;
  phone?: string;
  pv?: number;
  salt?: string;
  specialty?: string;
  surname?: string;
  surnameEn?: string;
}
export interface Company {
  address?: string;
  contactPerson?: string;
  contractDate?: string;
  contractNo?: string;
  createdAt?: string;
  email?: string;
  hash?: string;
  id: string;
  login: string;
  name: string;
  notes?: string;
  on?: boolean;
  phone?: string;
  pv?: number;
  reqOptional?: boolean;
  salt?: string;
  taxId?: string;
}
export interface StaffRecord {
  email: string;
  expires?: string;
  mfa?: boolean;
  name?: string;
  role: string;
  sigKey?: string;
  title?: string;
}
export interface LoginEntry {
  id?: string;
  login: string;
}
export interface Session {
  bid: string;
  by?: string;
  cancelReason?: string;
  cancelled?: any;
  certDetails?: string;
  certReg?: string;
  closed?: boolean;
  coMode?: string;
  coText?: string;
  createdAt?: string;
  date: string;
  docsOpen?: any;
  endDate?: string;
  exam?: any;
  examCount?: number;
  examId?: string;
  examLink?: string;
  examMinutes?: number;
  examMode?: string;
  id: string;
  keySeen?: any;
  location?: string;
  materials?: any[];
  notes?: string;
  sheetId?: string;
  tbt?: any;
  tid?: string;
  time?: string;
  traineeIds?: any[];
}
export interface Enrolment {
  absent?: any;
  att?: string;
  attBy?: string;
  days?: any;
  doh?: any;
  ev?: any;
  exam?: any;
  fb?: any;
  final?: any;
  prac?: any;
  sid: string;
  tbtAck?: any;
  test?: any;
  tid: string;
}
export interface Cert {
  approval?: any;
  att?: string;
  bid: string;
  by?: string;
  co?: string;
  cox?: string;
  direct?: boolean;
  end?: string;
  esign?: any;
  exp?: string;
  expiry?: string;
  issuedAt?: string;
  no: string;
  rem?: any;
  renewed?: string;
  revoked?: any;
  sid?: string;
  sign?: any;
  sk?: string;
  snap: any;
  start: string;
  tid: string;
  vh?: string;
}
export interface Blank {
  category?: string;
  createdAt?: string;
  credits?: number;
  defaultSheetId?: string;
  descAz?: string;
  descEn?: string;
  footAz?: string;
  footEn?: string;
  id: string;
  labels?: any;
  months?: number;
  name: string;
  note?: string;
  prefix?: string;
  provider?: string;
  qualAz?: string;
  qualEn?: string;
  titleAz?: string;
  titleEn?: string;
}
export interface Sheet {
  createdAt?: string;
  disq?: any[];
  disqNote?: string;
  headerFields?: any[];
  id: string;
  mode?: string;
  name: string;
  note?: string;
  rule?: any;
  sections?: any[];
  subtitle?: string;
  timePenalty?: boolean;
  timeRate?: number;
  title?: string;
}
export interface Test {
  bid?: string;
  createdAt?: string;
  draft?: boolean;
  grading?: string;
  id: string;
  intro?: string;
  owner?: any;
  passRate?: number;
  pick?: number;
  pickBy?: any;
  proposal?: any;
  questions: any[];
  review?: any;
  source?: string;
  status?: string;
  timeLimit?: number;
  title: string;
  updatedAt?: string;
}
export interface Group {
  by?: string;
  createdAt?: string;
  id: string;
  name: string;
  note?: string;
  traineeIds?: any[];
}
export interface CompanyGroup {
  at?: string;
  co: string;
  id: string;
  ids: any[];
  name: string;
}
export interface CertRequest {
  at?: string;
  bid?: string;
  certs?: any[];
  co: string;
  coName?: string;
  contact?: string;
  count?: number;
  date?: string;
  id: string;
  kind?: string;
  note?: string;
  people?: any[];
  reply?: string;
  status: string;
  updatedAt?: string;
  updatedBy?: string;
}
export interface CandidateRequest {
  at?: string;
  by?: string;
  co: string;
  coName?: string;
  consent?: boolean;
  id: string;
  person?: any;
  review?: any;
  status: string;
  traineeId?: string;
}
export interface Signature {
  at?: string;
  by?: any;
  code?: string;
  doc: string;
  hash: string;
  id: string;
  ref?: any;
  role: string;
}
export interface AuditEntry {
  action: string;
  at: string;
  by?: any;
  changes?: any[];
  detail?: string;
  eid?: string;
  entity?: any;
  ip?: string;
}
export interface Note {
  a?: any[];
  at: string;
  k: string;
  link?: string;
  to: string;
}
export interface Thread {
  acc: string;
  att?: string;
  id: string;
  kind: string;
  last?: string;
  lastAt?: string;
  lastFrom?: string;
  name?: string;
  unreadAcc?: number;
  unreadStaff?: number;
}
export interface Message {
  at?: string;
  by?: string;
  editedAt?: string;
  from: string;
  id: string;
  text: string;
  th: string;
  uid?: string;
}
export interface LibraryDoc {
  at?: string;
  by?: string;
  category?: string;
  ext?: string;
  fileName?: string;
  id: string;
  key: string;
  size?: number;
  title: string;
}
export interface Material {
  at?: string;
  by?: string;
  fileName?: string;
  format?: string;
  id: string;
  key?: string;
  review?: any;
  size?: number;
  slides?: number;
  status?: string;
  title: string;
}
export interface LinkRequest {
  at?: string;
  existingId?: string;
  fin?: string;
  id: string;
  phone?: string;
  review?: any;
  status: string;
  tempId?: string;
}
export interface ErrorEntry {
  at: string;
  body?: string;
  method?: string;
  msg?: string;
  path: string;
  ref?: string;
  stack?: string;
  status?: number;
  who?: string;
}

export interface Records {
  trainees: Trainee;
  trainers: Trainer;
  companies: Company;
  staff: StaffRecord;
  logins: LoginEntry;
  sessions: Session;
  enr: Enrolment;
  certs: Cert;
  blanks: Blank;
  sheets: Sheet;
  tests: Test;
  groups: Group;
  cogroups: CompanyGroup;
  requests: CertRequest;
  candreq: CandidateRequest;
  signs: Signature;
  audit: AuditEntry;
  notes: Note;
  threads: Thread;
  msgs: Message;
  libdocs: LibraryDoc;
  materials: Material;
  links: LinkRequest;
  errlog: ErrorEntry;
}
