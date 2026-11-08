/* The data layer and the request context, for the type checker. Every route table is declared as `Routes`, so inside a
   route `c.D.get('trainees', id)` is known to give a Trainee, and a misspelt field or collection name is an error. */
import type { Records } from './records';

export type Col = keyof Records;
export type Row<T> = { id: string; data: T };
export type Op = 'eq' | 'ne' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'null' | 'nn' | 'empty' | 'has';
export interface Spec { where?: any[][]; search?: string; order?: [string, 'asc' | 'desc'?]; limit?: number; offset?: number; count?: boolean; fields?: string[] }

export interface Store {
  get<C extends Col>(col: C, id: string): Promise<Records[C] | undefined>;
  get(col: string, id: string): Promise<any>;
  getMany<C extends Col>(col: C, ids: string[]): Promise<Row<Records[C]>[]>;
  getMany(col: string, ids: string[]): Promise<Row<any>[]>;
  all<C extends Col>(col: C): Promise<Row<Records[C]>[]>;
  all(col: string): Promise<Row<any>[]>;
  query<C extends Col>(col: C, spec?: Spec): Promise<{ rows: Row<Records[C]>[]; total: number | null }>;
  query(col: string, spec?: Spec): Promise<{ rows: Row<any>[]; total: number | null }>;
  inList<C extends Col>(col: C, field: string, vals: any[], fields?: string[]): Promise<Row<Records[C]>[]>;
  inList(col: string, field: string, vals: any[], fields?: string[]): Promise<Row<any>[]>;
  byField<C extends Col>(col: C, field: string, v: any): Promise<Row<Records[C]>[]>;
  byField(col: string, field: string, v: any): Promise<Row<any>[]>;
  prefix<C extends Col>(col: C, p: string): Promise<Row<Records[C]>[]>;
  prefix(col: string, p: string): Promise<Row<any>[]>;
  put<C extends Col>(col: C, rows: Row<Records[C]>[]): Promise<any>;
  put(col: string, rows: Row<any>[]): Promise<any>;
  insert<C extends Col>(col: C, id: string, data: Records[C]): Promise<any>;
  insert(col: string, id: string, data: any): Promise<any>;
  insertMany<C extends Col>(col: C, rows: Row<Records[C]>[]): Promise<string[]>;
  insertMany(col: string, rows: Row<any>[]): Promise<string[]>;
  del(col: string, id: string): Promise<any>;
  delMany(col: string, ids: Iterable<string>): Promise<any>;
  delCol(col: string): Promise<any>;
  seq(n: string): Promise<number>;
  seqN(n: string, k: number): Promise<number>;
  peek(n: string): Promise<number>;
  bump(n: string, v: number): Promise<any>;
  counters(): Promise<{ name: string; val: number }[]>;
  setCounters(rows: { name: string; val: number }[]): Promise<any>;
  lockState(k: string): Promise<number>;
  lockFail(k: string, max: number, secs: number): Promise<number>;
  lockOk(k: string): Promise<any>;
  restore(cols: string[], data: any, ctrs?: any[]): Promise<any>;
  /** raw PostgREST call (production store only) */
  call?: (path: string, o?: any) => Promise<any>;
  [k: string]: any;
}

export interface Ctx {
  env: any; req: Request; url: URL; params: any;
  D: Store; B: any; A: any;
  now(): number; today(): string;
  user: any; me: any;
  body(): Promise<any>;
  [k: string]: any;
}
export interface Route { auth?: string; act?: string; fn(c: Ctx): any; [k: string]: any }
export type Routes = Record<string, Route>;
