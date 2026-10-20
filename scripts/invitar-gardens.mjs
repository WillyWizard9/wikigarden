// Da de alta en Supabase los emails de los gardens con acceso a la wiki.
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=... npm run invitar -- gardens.csv
// gardens.csv: una línea por persona con  email,garden  (la primera línea puede ser la cabecera).
// No envía ningún email: los gardens entran desde /acceso cuando quieran.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [archivo] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!archivo || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Falta el CSV o las variables SUPABASE_URL / SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const filas = readFileSync(archivo, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.split(/[,;]/).map((c) => c.trim()))
  .filter(([email]) => email && email.includes('@'));

let altas = 0, existentes = 0, errores = 0;
for (const [email, garden = ''] of filas) {
  const { error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    email_confirm: true,
    user_metadata: { garden },
  });
  if (!error) { altas++; console.log(`✓ ${email}`); }
  else if (/already|registered|exists/i.test(error.message)) { existentes++; console.log(`· ${email} (ya existía)`); }
  else { errores++; console.log(`✗ ${email}: ${error.message}`); }
}
console.log(`\nAltas: ${altas} · Ya existían: ${existentes} · Errores: ${errores}`);