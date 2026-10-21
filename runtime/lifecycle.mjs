import { createServer } from 'node:http';

/** Own HTTP admission, then Next after() work, then database pools, in that order. */
export async function serveRuntime({host,port,healthPort,shutdownMs,initialize,ready,closePools,report=()=>{}}) {
  let handler, next, draining=false, stopping;
  const server=createServer((req,res)=>{
    const socket=req.socket;
    res.once('finish',()=>{if(draining)socket.end();});
    if(draining || !handler){res.writeHead(503,{'connection':'close'});res.end('Unavailable');return;}
    Promise.resolve(handler(req,res)).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});
  });
  server.keepAliveTimeout=5000;server.headersTimeout=10000;server.requestTimeout=30000;
  const health=createServer(async(req,res)=>{
    const socket=req.socket;
    res.once('finish',()=>{if(draining)socket.end();});
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'||!['/live','/ready'].includes(req.url??'')){res.writeHead(404);res.end();return;}
    if(draining){res.writeHead(503);res.end('Unavailable');return;}
    try{if(req.url==='/ready')await ready();res.writeHead(200);res.end('OK');}
    catch{res.writeHead(503);res.end('Unavailable');}
  });
  const listen=(s,p,h)=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(p,h,()=>{s.removeListener('error',fail);ok();});});
  const close=s=>new Promise((ok,fail)=>{if(!s.listening){ok();return;}s.close(e=>e?fail(e):ok());s.closeIdleConnections();});
  function shutdown(){
    if(stopping)return stopping;draining=true;report('draining');
    stopping=(async()=>{
      const work=(async()=>{await close(server);await next?.server.close();await closePools();await close(health);report('drained');})();
      let timer;const deadline=new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('SHUTDOWN_DEADLINE')),shutdownMs);});
      try{await Promise.race([work,deadline]);}finally{clearTimeout(timer);}
    })();return stopping;
  }
  try{
    next=await initialize(server);handler=next.requestHandler;
    server.on('upgrade',(req,socket,head)=>{if(draining)socket.destroy();else if(next.upgradeHandler)void next.upgradeHandler(req,socket,head);else socket.destroy();});
    await ready(); // No public listener until certificate, role and RLS pass.
    await listen(health,healthPort,'127.0.0.1');await listen(server,port,host);report('ready');
    return {server,health,shutdown};
  }catch(cause){
    await shutdown().catch(()=>{});throw Error('RUNTIME_STARTUP_FAILED',{cause});
  }
}
