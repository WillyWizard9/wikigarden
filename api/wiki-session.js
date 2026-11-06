import {createRemoteJWKSet,jwtVerify} from 'jose';
const issuer='https://mozmpxxlgrzbxukitpms.supabase.co/auth/v1';
const jwks=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const base='wiki_sesion=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
 if(req.method==='DELETE'){res.setHeader('Set-Cookie',base);return res.status(200).json({ok:true})}
 if(req.method!=='POST'){res.setHeader('Allow','POST, DELETE');return res.status(405).json({ok:false})}
 const origin=req.headers.origin;
 if(!origin || !req.headers.host || new URL(origin).host!==req.headers.host)return res.status(403).json({ok:false});
 const token=req.body?.token;
 if(typeof token!=='string'||token.length>8000)return res.status(400).json({ok:false});
 try{
  const {payload}=await jwtVerify(token,jwks,{issuer,audience:'authenticated'});
  if(payload.role!=='authenticated'||typeof payload.sub!=='string')return res.status(401).json({ok:false});
  const ttl=Math.max(0,Math.min(3600,Number(payload.exp||0)-Math.floor(Date.now()/1000)));
  if(ttl<10)return res.status(401).json({ok:false});
  res.setHeader('Set-Cookie','wiki_sesion='+encodeURIComponent(token)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+ttl);
  return res.status(200).json({ok:true});
 }catch{return res.status(401).json({ok:false})}
}