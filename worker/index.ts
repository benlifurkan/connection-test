export interface Env{ALLOWED_ORIGIN?:string;ASSETS:Fetcher;GAME_ROOMS:DurableObjectNamespace}
type Player={id:string;name:string;x:number;y:number}
type State={room:string;players:Player[];scene:number;phase:'lobby'|'play'|'won';clues:Record<string,string[]>;events:{p:string;t:string}[]}
const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','vary':'Origin'}})
const id=()=>crypto.randomUUID().slice(0,6).toUpperCase()
export class GameRoom{
 state:State
 constructor(public ctx:DurableObjectState){this.state={room:'',players:[],scene:0,phase:'lobby',clues:{},events:[]}}
 async load(){const s=await this.ctx.storage.get<State>('state');if(s)this.state=s}
 async save(){await this.ctx.storage.put('state',this.state)}
 async fetch(req:Request){await this.load();const u=new URL(req.url);if(req.method==='GET'){return json(this.view(u.searchParams.get('player')||''))}
 const b=await req.json() as any
 if(b.action==='create'){this.state.room=b.room;const p={id:b.player,name:String(b.name).slice(0,18),x:22,y:70};this.state.players=[p];this.state.clues[p.id]=[];await this.save();return json(this.view(p.id))}
 if(b.action==='join'){if(this.state.players.length>=2)return json({ok:false,error:'Bu oda dolu.'},409);const p={id:b.player,name:String(b.name).slice(0,18),x:32,y:70};this.state.players.push(p);this.state.clues[p.id]=[];this.state.scene=1;this.state.phase='play';this.event('SİSTEM','İkinci oyuncu geldi. Fenerin kapısı açıldı.');await this.save();return json(this.view(p.id))}
 const p=this.state.players.find(x=>x.id===b.player);if(!p)return json({ok:false,error:'Oyuncu bulunamadı.'},403)
 if(b.action==='move'){try{const q=JSON.parse(String(b.payload));p.x=Number(q.x);p.y=Number(q.y);this.event(p.name,'hareket etti.')}catch{}}
 if(b.action==='inspect')this.inspect(p,String(b.payload))
 if(b.action==='solve')this.solve(p,String(b.payload))
 if(b.action==='chat')this.event(p.name,'“'+String(b.payload).slice(0,90)+'”')
 await this.save();return json(this.view(p.id))}
 event(p:string,t:string){this.state.events.push({p,t});this.state.events=this.state.events.slice(-20)}
 inspect(p:Player,target:string){const clues=this.state.clues[p.id]||[];const map:Record<string,string>=this.state.scene===1?{
 radio:'Radyoda 21:17 frekansında üç kısa vuruş var.',
 desk:'Masanın çekmecesinde: 148. Yanına kırmızı bir çarpı çizilmiş.',
 map:'Haritada fenerin altında gizli bir servis tüneli işaretli.',
 door:'Kapının kilidi üç haneli. Metalin üzerinde 148 kazılı.',
 lamp:'Lamba bir kez yanıp sönüyor: dışarıdan biri sinyal veriyor.'
 }:this.state.scene===2?{
 crate:'Sandığın içinde eski bir kırmızı anahtar var.',
 radio:'Tüneldeki kablo hâlâ çalışıyor. Akım kuzeye gidiyor.',
 map:'Duvar haritasında kırmızı kapı işaretlenmiş.',
 door:'Kapının camında yalnızca kırmızı ışık yanıyor.',
 lamp:'Sinyal lambası kırmızıya döndüğünde kilit açılıyor.'
 }:{
 radio:'Son sinyalde iki kısa, bir uzun vuruş var.',
 window:'Ufukta başka bir fener aynı ritmi cevaplıyor.',
 map:'Duvarın arkasında ikinci bir oda görünüyor.',
 lamp:'Lamba üçüncü vuruşta sabit yanıyor.',
 door:'Çıkış kapısında iki el için aynı anda basılacak düğme var.'
 };if(map[target]&&!clues.includes(map[target])){clues.push(map[target]);this.state.clues[p.id]=clues;this.event(p.name,'bir nesneyi inceledi.')}}
 solve(p:Player,a:string){if(this.state.scene===1&&a==='148'){this.state.scene=2;this.state.players.forEach(x=>this.state.clues[x.id]=[]);this.event(p.name,'kilidi açtı. Alt tünel ortaya çıktı.');return}if(this.state.scene===2&&a==='RED'){this.state.scene=3;this.state.players.forEach(x=>this.state.clues[x.id]=[]);this.event(p.name,'kırmızı kapıyı açtı. Çatıya çıktınız.');return}if(this.state.scene===3&&a==='TOGETHER'){this.state.phase='won';this.event('SİSTEM','İki oyuncu aynı anda son sinyali gönderdi.');return}this.event(p.name,'yanlış seçim yaptı.') }
 view(player:string){return{ok:true,room:this.state.room,player,phase:this.state.phase,scene:this.state.scene,players:this.state.players,ready:this.state.players.length,clues:this.state.clues[player]||[],events:this.state.events}}
}
export default{async fetch(request:Request,env:Env){const allowed=env.ALLOWED_ORIGIN||'*';if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':allowed,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}});const u=new URL(request.url);if(u.pathname==='/api/game'){try{if(request.method==='GET'){const room=u.searchParams.get('room')?.toUpperCase();if(!room)return json({ok:false,error:'Oda gerekli.'},400,allowed);const stub=env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room));return stub.fetch(new Request('https://room/?'+u.searchParams.toString(),request))}const b=await request.json() as any;if(!['create','join'].includes(b.action)){return json({ok:false,error:'Geçersiz giriş.'},400,allowed)}const room=b.action==='create'?id():String(b.room||'').toUpperCase();if(!room)return json({ok:false,error:'Oda kodu gerekli.'},400,allowed);b.room=room;b.player=id();const stub=env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room));return stub.fetch(new Request('https://room/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}))}catch{return json({ok:false,error:'Sinyal işlenemedi.'},500,allowed)}}return env.ASSETS.fetch(request)}}