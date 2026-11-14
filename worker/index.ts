export interface Env {
  ALLOWED_ORIGIN?: string
  ASSETS: Fetcher
  GAME_ROOMS: DurableObjectNamespace
}

type Player={id:string;name:string}
type State={room:string;players:Player[];scene:number;phase:'lobby'|'play'|'won';clues:Record<string,string[]>;events:{p:string;t:string}[]}

const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','vary':'Origin'}})
const id=()=>crypto.randomUUID().slice(0,8).toUpperCase()

export class GameRoom {
  state:State
  constructor(public ctx:DurableObjectState){this.state={room:'',players:[],scene:0,phase:'lobby',clues:{},events:[]}}
  async load(){const s=await this.ctx.storage.get<State>('state');if(s)this.state=s}
  async save(){await this.ctx.storage.put('state',this.state)}
  async fetch(req:Request){
    await this.load(); const u=new URL(req.url)
    if(req.method==='GET'){
      const p=u.searchParams.get('player')||''; return json(this.view(p))
    }
    const b=await req.json() as any
    if(b.action==='create'){this.state.room=b.room;const p={id:b.player,name:String(b.name).slice(0,18)};this.state.players=[p];this.state.clues[p.id]=[];await this.save();return json(this.view(p.id))}
    if(b.action==='join'){
      if(this.state.players.length>=2)return json({ok:false,error:'Bu oda dolu.'},409)
      const p={id:b.player,name:String(b.name).slice(0,18)};this.state.players.push(p);this.state.clues[p.id]=[];this.state.scene=1;this.state.phase='play';this.event('SİSTEM','İkinci sinyal bağlandı. Dosya açıldı.');await this.save();return json(this.view(p.id))
    }
    const p=this.state.players.find(x=>x.id===b.player);if(!p)return json({ok:false,error:'Oyuncu bulunamadı.'},403)
    if(b.action==='inspect')this.inspect(p,b.payload)
    if(b.action==='solve')this.solve(p,b.payload)
    if(b.action==='chat')this.event(p.name,'“'+String(b.payload).slice(0,90)+'”')
    await this.save();return json(this.view(p.id))
  }
  event(p:string,t:string){this.state.events.push({p,t});this.state.events=this.state.events.slice(-20)}
  inspect(p:Player,target:string){
    const clues=this.state.clues[p.id]||[]
    const map:any={
      terminal:'Terminal ekranında tek satır var: 21:17 · 148',
      desk:'Masanın altında: “Renkleri sayı san. Sırayı sen bulma.”',
      wall:'Duvar notu: KIRMIZI=1 · MAVİ=4 · SARI=8',
      symbol:'Semboller sırayla: △ · ○ · □. Notta “üçüncüden önce ikinci” yazıyor.',
      paper:'Yırtık kâğıt: “Mavi kapı gerçek değil. Kırmızı, içerideki ışığı saklıyor.”',
      signal:'Sinyalin içinde üç kısa vuruş ve ardından uzun bir boşluk var.',
      window:'Pencerede dışarıdan değil, içeriden çizilmiş bir ok var. Ok diğer oyuncuyu gösteriyor.'
    }
    if(map[target]&&!clues.includes(map[target])){clues.push(map[target]);this.state.clues[p.id]=clues;this.event(p.name,'bir ipucu buldu.')}
  }
  solve(p:Player,answer:string){
    if(this.state.scene===1&&answer==='148'){this.state.scene=2;this.event(p.name,'ilk kilidi açtı.');this.state.players.forEach(x=>this.state.clues[x.id]=[]);return}
    if(this.state.scene===2&&answer==='RED'){this.state.scene=3;this.event(p.name,'kırmızı kapıyı seçti.');this.state.players.forEach(x=>this.state.clues[x.id]=[]);return}
    if(this.state.scene===3&&answer==='TOGETHER'){this.state.phase='won';this.event('SİSTEM','İki oyuncu aynı anda son sinyali gönderdi.');return}
    this.event(p.name,'yanlış bir seçim yaptı. Sistem sessiz kaldı.')
  }
  view(player:string){return{ok:true,room:this.state.room,player,phase:this.state.phase,scene:this.state.scene,players:this.state.players,ready:this.state.players.length,clues:this.state.clues[player]||[],events:this.state.events}}
}

export default {
 async fetch(request:Request,env:Env){
  const origin=request.headers.get('Origin')||'*',allowed=env.ALLOWED_ORIGIN||'*'
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':allowed,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}})
  const u=new URL(request.url)
  if(u.pathname==='/api/game'){
    try{
      if(request.method==='GET'){
        const room=u.searchParams.get('room')?.toUpperCase(); if(!room)return json({ok:false,error:'Oda gerekli.'},400,allowed)
        const stub=env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room)); return stub.fetch(new Request('https://room/?'+u.searchParams.toString(),request))
      }
      const b=await request.json() as any
      if(!['create','join'].includes(b.action))return json({ok:false,error:'Geçersiz giriş.'},400,allowed)
      const room=b.action==='create'?id():String(b.room||'').toUpperCase()
      if(!room)return json({ok:false,error:'Oda kodu gerekli.'},400,allowed)
      b.room=room;b.player=id()
      const stub=env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(room))
      return stub.fetch(new Request('https://room/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}))
    }catch(e){return json({ok:false,error:'Sinyal işlenemedi.'},500,allowed)}
  }
  return env.ASSETS.fetch(request)
 }
}