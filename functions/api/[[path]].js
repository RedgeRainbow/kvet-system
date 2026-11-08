// Cloudflare Pages Function for /api/*. The ONLY code that touches Supabase (service key) and R2.
import { createHandler } from '../_lib/index.js';
import { supabaseStore, H } from '../_lib/store.js';
import { supabaseAuth } from '../_lib/auth.js';

const trim = v => String(v || '').trim();
const handle = createHandler({
  validate(env) { for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'TOKEN_SECRET']) if (!trim(env[k])) throw new H(500, 'server'); },
  store: env => supabaseStore({ ...env, SUPABASE_URL: trim(env.SUPABASE_URL).replace(/\/+$/, ''), SUPABASE_SERVICE_KEY: trim(env.SUPABASE_SERVICE_KEY) }),
  auth: env => supabaseAuth({ ...env, SUPABASE_URL: trim(env.SUPABASE_URL).replace(/\/+$/, ''), SUPABASE_SERVICE_KEY: trim(env.SUPABASE_SERVICE_KEY), SUPABASE_PUBLISHABLE_KEY: trim(env.SUPABASE_PUBLISHABLE_KEY) }),
  bucket: env => env.BUCKET,
});
export const onRequest = ({ request, env, waitUntil }) => handle(request, env, waitUntil);
