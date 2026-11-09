import {connect as tlsConnect} from 'node:tls';

export function sendGoogleSMTP({username,password,from,to,replyTo,subject,text}){
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

