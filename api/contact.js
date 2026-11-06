import {connect as tlsConnect} from 'node:tls';
const DESTINATION = 'info@cymara.es';
const ALLOWED_PROBLEMS = new Set(['Stock mal localizado','Sobrestock','Planificación de compras','Conteos poco fiables','Entradas y salidas de mercancía']);
const allowedOrigin = (origin, host) => {try {return new URL(origin).host === host;} catch {return false;}};
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0,max) : '';

// SMTP seguro sin dependencias externas. Google Workspace usa smtp.gmail.com:465.
function sendGoogleSMTP({username,password,from,to,replyTo,subject,text}){
 return new Promise((resolve,reject)=>{
  const socket=tlsConnect({host:'smtp.gmail.com',port:465,servername:'smtp.gmail.com',rejectUnauthorized:true});
  socket.setTimeout(15000);
  let buffer='',responseLines=[],waiting=null,ended=false;
  const fail=error=>{if(ended)return;ended=true;socket.destroy();reject(error)};
  const read=()=>new Promise((ok,bad)=>{waiting={ok,bad}});
  socket.on('error',fail);
  socket.on('timeout',()=>fail(new Error('SMTP timeout')));
  socket.on('close',()=>{if(!ended)fail(new Error('SMTP connection closed'))});
  socket.on('data',chunk=>{
   buffer+=chunk.toString('utf8');
   let pos;
   while((pos=buffer.indexOf('\r\n'))!==-1){
    const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);
    if(!/^\d{3}[ -]/.test(line))continue;
    responseLines.push(line);
    if(line[3]===' '&&waiting){
     const result={code:Number(line.slice(0,3)),message:responseLines.join('\n')};
     responseLines=[];const done=waiting;waiting=null;done.ok(result);
    }
   }
  });
  const write=data=>socket.write(data+'\r\n','utf8');
  const command=async(data,expected)=>{
   const pending=read();write(data);
   const result=await pending;
   if(!expected.includes(result.code))throw new Error('SMTP '+result.code+': '+result.message.slice(0,160));
  };
  const addr=value=>'<'+value+'>';
  const mime=value=>'=?UTF-8?B?'+Buffer.from(value,'utf8').toString('base64')+'?=';
  const safeAddress=value=>String(value).replace(/[\r\n<>]/g,'').trim();
  (async()=>{
   try{
    const greeting=await read();
    if(greeting.code!==220)throw new Error('SMTP greeting '+greeting.code);
    await command('EHLO wikigarden.cymara.es',[250]);
    await command('AUTH PLAIN '+Buffer.from('\0'+username+'\0'+password).toString('base64'),[235]);
    await command('MAIL FROM:'+addr(safeAddress(from)),[250]);
    await command('RCPT TO:'+addr(safeAddress(to)),[250,251]);
    await command('DATA',[354]);
    const message=[
     'From: '+mime('WikiGarden')+' '+addr(safeAddress(from)),
     'To: '+addr(safeAddress(to)),
     'Reply-To: '+addr(safeAddress(replyTo)),
     'Subject: '+mime(subject),
     'MIME-Version: 1.0',
     'Content-Type: text/plain; charset=UTF-8',
     'Content-Transfer-Encoding: 8bit',
     '',
     text
    ].join('\r\n').replace(/(^|\r\n)\./g,'$1..');
    await command(message+'\r\n.',[250]);
    ended=true;socket.end('QUIT\r\n');resolve();
   }catch(error){fail(error)}
  })();
 });
}

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
 const smtpUser=process.env.WIKI_SMTP_USER,smtpPassword=process.env.WIKI_SMTP_APP_PASSWORD;
 if(!(smtpUser&&smtpPassword)&&!(key&&from)){
  console.error('WikiGarden: falta configurar WIKI_SMTP_USER y WIKI_SMTP_APP_PASSWORD en Vercel');
  return res.status(503).json({ok:false,error:'El envío no está disponible temporalmente. Escríbenos a info@cymara.es.'});
 }
 const source=clean(data.source,120);
 const text=['Nueva solicitud desde WikiGarden','Garden: '+garden,'Email: '+email,'Problemas: '+problems.join(', '),'Origen: '+(source||'WikiGarden'),'Detalle: '+(detail||'Sin detalles')].join('\n');
 try {
   if(smtpUser&&smtpPassword){
    await sendGoogleSMTP({
     username:smtpUser,password:smtpPassword,from:smtpUser,to:DESTINATION,replyTo:email,
     subject:'WikiGarden | Nueva solicitud | '+garden.replace(/[\r\n]/g,' '),text
    });
    return res.status(200).json({ok:true});
   }
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[DESTINATION],reply_to:email,subject:'WikiGarden | Nueva solicitud | '+garden,text})});
   if(!response.ok){console.error('WikiGarden: error de proveedor',response.status,(await response.text()).slice(0,300));return res.status(502).json({ok:false,error:'No hemos podido enviar la solicitud. Inténtalo de nuevo o escribe a info@cymara.es.'});}
   return res.status(200).json({ok:true});
 } catch(error){console.error('WikiGarden: error de red',error);return res.status(502).json({ok:false,error:'No hemos podido enviar la solicitud. Inténtalo de nuevo o escribe a info@cymara.es.'});}
}