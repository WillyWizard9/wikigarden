const DESTINATION = 'info@cymara.es';
const ALLOWED_PROBLEMS = new Set(['Stock mal localizado','Sobrestock','Planificación de compras','Conteos poco fiables','Entradas y salidas de mercancía']);
const allowedOrigin = (origin, host) => {try {return new URL(origin).host === host;} catch {return false;}};
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0,max) : '';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method !== 'POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Método no permitido.'});}
 if(!allowedOrigin(req.headers.origin,req.headers.host)) return res.status(403).json({ok:false,error:'Solicitud no autorizada.'});
 if(!req.headers['content-type']?.includes('application/json'))return res.status(415).json({ok:false,error:'Formato no válido.'});
 const data=req.body && typeof req.body==='object'?req.body:{};
 if(clean(data.website,200))return res.status(200).json({ok:true});
 const garden=clean(data.garden,120),email=clean(data.email,180),detail=clean(data.detalle,3000);
 const problems=Array.isArray(data.problemas)?data.problemas.filter(p=>ALLOWED_PROBLEMS.has(p)).slice(0,5):[];
 if(!garden||!/^\S+@\S+\.\S+$/.test(email)||!problems.length||garden.length>120)return res.status(400).json({ok:false,error:'Revisa el nombre, el email y selecciona al menos un problema.'});
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from){console.error('WikiGarden: faltan RESEND_API_KEY o RESEND_FROM_EMAIL');return res.status(503).json({ok:false,error:'El envío no está disponible temporalmente. Escríbenos a info@cymara.es.'});}
 const source=clean(data.source,120);
 const text=['Nueva solicitud desde WikiGarden','Garden: '+garden,'Email: '+email,'Problemas: '+problems.join(', '),'Origen: '+(source||'WikiGarden'),'Detalle: '+(detail||'Sin detalles')].join('\n');
 try {
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[DESTINATION],reply_to:email,subject:'WikiGarden | Nueva solicitud | '+garden,text})});
   if(!response.ok){console.error('WikiGarden: error de proveedor',response.status,(await response.text()).slice(0,300));return res.status(502).json({ok:false,error:'No hemos podido enviar la solicitud. Inténtalo de nuevo o escribe a info@cymara.es.'});}
   return res.status(200).json({ok:true});
 } catch(error){console.error('WikiGarden: error de red',error);return res.status(502).json({ok:false,error:'No hemos podido enviar la solicitud. Inténtalo de nuevo o escribe a info@cymara.es.'});}
}