// Invita miembros de ALIAT con asignación a su garden.
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... SITE_URL=https://... npm run invitar -- gardens.csv
// Por defecto SOLO comprueba el CSV. Para enviar invitaciones: añadir --send.
// CSV: email,garden,nombre (nombre es opcional). Una fila por persona.
// Ejecutar únicamente en un equipo seguro. NUNCA guardar la clave secreta en GitHub.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const args=process.argv.slice(2);
const file=args.find(arg=>!arg.startsWith('--'));
const send=args.includes('--send');
const {SUPABASE_URL,SUPABASE_SECRET_KEY,SITE_URL}=process.env;
if(!file){console.error('Uso: npm run invitar -- gardens.csv [--send]');process.exit(1)}
const rows=readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
 .filter(line=>!/^email[,;]/i.test(line)).map(line=>line.split(/[,;]/).map(x=>x.trim()));
const errors=[];
const emails=new Set();
for(const [email,garden] of rows){
 if(!/^\S+@\S+\.\S+$/.test(email||'')||!garden){errors.push('Fila inválida: '+String(email)+' / '+String(garden));continue}
 const normalized=email.toLowerCase();if(emails.has(normalized))errors.push('Email duplicado: '+normalized);emails.add(normalized)
}
if(errors.length){errors.forEach(e=>console.error(e));process.exit(1)}
console.log('Validación correcta: '+rows.length+' usuarios de '+new Set(rows.map(r=>r[1])).size+' gardens.');
if(!send){console.log('Simulación: no se ha creado ningún usuario ni enviado emails. Añade --send para invitar.');process.exit(0)}
if(!SUPABASE_URL||!SUPABASE_SECRET_KEY||!SITE_URL){console.error('Faltan SUPABASE_URL, SUPABASE_SECRET_KEY o SITE_URL');process.exit(1)}
const url=new URL(SITE_URL);
if(url.protocol!=='https:'){console.error('SITE_URL debe ser HTTPS');process.exit(1)}
const supabase=createClient(SUPABASE_URL,SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let invited=0,associated=0,failed=0;
for(const [rawEmail,garden,name=''] of rows){
 const email=rawEmail.toLowerCase();
 try{
  const {data:existing,error:listError}=await supabase.auth.admin.listUsers({page:1,perPage:1000});
  if(listError)throw listError;
  let user=existing.users.find(u=>u.email?.toLowerCase()===email);
  if(!user){
   const {data,error}=await supabase.auth.admin.inviteUserByEmail(email,{redirectTo:url.origin+'/acceso/'});
   if(error)throw error;
   user=data.user;invited++;
  }
  if(!user?.id)throw new Error('No se recibió identificador del usuario');
  const {data:group,error:gardenError}=await supabase.from('wiki_gardens').upsert({name:garden},{onConflict:'name'}).select('id').single();
  if(gardenError)throw gardenError;
  const {error:memberError}=await supabase.from('wiki_members').upsert({user_id:user.id,garden_id:group.id,display_name:name||email},{onConflict:'user_id'});
  if(memberError)throw memberError;
  associated++;
  console.log('✓ '+email+' · '+garden+(user.email_confirmed_at?' (ya registrado)':''));
 }catch(error){failed++;console.error('✗ '+email+': '+error.message)}
}
console.log('Invitaciones nuevas: '+invited+' | Miembros asociados: '+associated+' | Errores: '+failed);
if(failed)process.exitCode=1;
