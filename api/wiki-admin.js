import {createClient} from '@supabase/supabase-js';

const PROJECT='https://mozmpxxlgrzbxukitpms.supabase.co';
const PUBLIC_KEY='sb_publishable_OtrtVuzuiJJefDs0oM6wuQ_LmexlzFk';
const ADMIN_ID='d60df3d9-0ce5-4136-ac23-f8e7003535e6';
const emailOK=value=>typeof value==='string'&&value.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'Método no permitido.'});}
 if(req.method==='POST'){
  let origin;
  try{origin=new URL(req.headers.origin)}catch{return res.status(403).json({ok:false,error:'Origen no válido.'})}
  if(origin.protocol!=='https:'||origin.host!==req.headers.host)return res.status(403).json({ok:false,error:'Origen no autorizado.'});
 }
 const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/i)?.[1];
 if(!token||token.length>8000)return res.status(401).json({ok:false,error:'Inicia sesión.'});
 const publicClient=createClient(PROJECT,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:identityError}=await publicClient.auth.getUser(token);
 if(identityError||identity?.user?.id!==ADMIN_ID)return res.status(403).json({ok:false,error:'Solo el administrador de WikiGarden puede gestionar usuarios.'});
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)return res.status(503).json({ok:false,error:'Falta configurar SUPABASE_SECRET_KEY en Vercel.'});
 const db=createClient(PROJECT,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 if(req.method==='GET'){
  const {data,error}=await db.from('wiki_gardens').select('id,name').order('name');
  if(error)return res.status(500).json({ok:false,error:'No se pudieron cargar los gardens.'});
  return res.status(200).json({ok:true,gardens:data});
 }
 const payload=req.body&&typeof req.body==='object'?req.body:{};
 const email=clean(payload.email,180).toLowerCase();
 const displayName=clean(payload.name,120);
 const accountMode=payload.accountMode==='direct'?'direct':'invite';
 const password=typeof payload.password==='string'?payload.password:'';
 if(accountMode==='direct'&&(password.length<8||password.length>128))
  return res.status(400).json({ok:false,error:'La contraseña inicial debe tener entre 8 y 128 caracteres.'});
 const gardenId=clean(payload.gardenId,50);
 const newGarden=clean(payload.newGarden,120);
 if(!emailOK(email)||!displayName||(!gardenId&&!newGarden)||(gardenId&&newGarden))
  return res.status(400).json({ok:false,error:'Introduce nombre, email y un garden válido.'});
 try{
  let garden;
  if(newGarden){
   const {data,error}=await db.from('wiki_gardens').upsert({name:newGarden},{onConflict:'name'}).select('id,name').single();
   if(error)throw error;
   garden=data;
  }else{
   const {data,error}=await db.from('wiki_gardens').select('id,name').eq('id',gardenId).maybeSingle();
   if(error||!data)return res.status(400).json({ok:false,error:'El garden seleccionado no existe.'});
   garden=data;
  }
  // No se reenvían invitaciones ni se cambian gardens de usuarios existentes por accidente.
  let existing=null;
  for(let page=1;page<=10;page++){
   const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
   if(error)throw error;
   existing=data.users.find(u=>u.email?.toLowerCase()===email)||null;
   if(existing)break;
   if(data.users.length<1000)break;
  }
  if(existing)return res.status(409).json({ok:false,error:'Ese correo ya tiene cuenta. No se ha modificado su garden.'});
  const {data:created,error:createError}=accountMode==='direct'
   ? await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}})
   : await db.auth.admin.inviteUserByEmail(email,{
      redirectTo:'https://wikigarden.cymara.es/acceso/?action=invite',
      data:{display_name:displayName}
     });
  if(createError)throw createError;
  if(!created?.user?.id)throw new Error('Supabase no devolvió el usuario creado.');
  const {error:memberError}=await db.from('wiki_members').insert({
   user_id:created.user.id,garden_id:garden.id,display_name:displayName
  });
  if(memberError){
   console.error('WikiGarden: usuario creado pero sin membresía',created.user.id,memberError.message);
   return res.status(500).json({ok:false,error:'La cuenta se creó pero no quedó vinculada al garden. No intentes repetir el alta; revisa la membresía en Supabase.'});
  }
  return res.status(200).json({ok:true,email,garden:garden.name,accountMode});
 }catch(error){
  console.error('WikiGarden: error de invitación',error?.message);
  return res.status(502).json({ok:false,error:'No se pudo completar la invitación. Comprueba el correo y el registro de Supabase.'});
 }
}
