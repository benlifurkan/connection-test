<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Player={id:string;name:string;x:number;y:number}
type GameState={
  ok:boolean;room:string;player:string;phase:'lobby'|'play'|'won';players:Player[];ready:number;scene:number;
  clues:string[];events:{p:string;t:string}[];positions:Record<string,{x:number;y:number}>
}
const API='/api/game'
const name=ref('');const roomInput=ref('');const room=ref('');const player=ref('')
const state=ref<GameState>({ok:true,room:'',player:'',phase:'lobby',players:[],ready:0,scene:0,clues:[],events:[],positions:{}})
const busy=ref(false);const error=ref('');const notice=ref('');const chat=ref('');const started=ref(false);const selected=ref('')
const pollTimer=ref<number|undefined>()
const me=computed(()=>state.value.players.find(p=>p.id===player.value))
const other=computed(()=>state.value.players.find(p=>p.id!==player.value))
const sceneTitle=computed(()=>['FENERİN İÇİ','ALT TÜNEL','DENİZ FENERİ'][Math.max(0,state.value.scene-1)]||'GİRİŞ')
const sceneSub=computed(()=>['Gece 21:17 · Bekçi odası','Suyun altında kalan servis tüneli','Son sinyalin geldiği çatı'][Math.max(0,state.value.scene-1)]||'Bekleniyor')
const sceneImage=computed(()=>['https://commons.wikimedia.org/wiki/Special:Redirect/file/Pottawatomie_Lighthouse_Interior.jpg','https://commons.wikimedia.org/wiki/Special:Redirect/file/Point_Reyes_Lighthouse_interior.jpg','https://commons.wikimedia.org/wiki/Special:Redirect/file/Lighthouse_public_domain.jpg'][Math.max(0,state.value.scene-1)]||'')
const radioImage='https://commons.wikimedia.org/wiki/Special:Redirect/file/Old_Radio.JPG'
const progress=computed(()=>Math.min(100,(state.value.scene/3)*100))
const hotspotText=computed(()=>({radio:'Eski radyo',desk:'Çalışma masası',window:'Pencere',door:'Kilitli kapı',map:'Duvar haritası',crate:'Sandık',lamp:'Sinyal lambası'} as Record<string,string>)[selected.value]||'')
async function api(body:Record<string,unknown>){const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||'Bağlantı kurulamadı');return d}
async function poll(){if(!room.value||!player.value)return;try{const r=await fetch(API+'?room='+encodeURIComponent(room.value)+'&player='+encodeURIComponent(player.value),{cache:'no-store'});if(r.ok)state.value=await r.json()}catch{}}
function startPolling(){window.clearInterval(pollTimer.value);pollTimer.value=window.setInterval(poll,1800)}
async function createRoom(){if(!name.value.trim()||busy.value)return;busy.value=true;error.value='';try{const d=await api({action:'create',name:name.value.trim().slice(0,18)});room.value=d.room;player.value=d.player;state.value=d;started.value=true;startPolling()}catch(e){error.value=e instanceof Error?e.message:'Bir şey ters gitti'}finally{busy.value=false}}
async function joinRoom(){if(!name.value.trim()||roomInput.value.trim().length!==6||busy.value)return;busy.value=true;error.value='';try{const d=await api({action:'join',room:roomInput.value.trim().toUpperCase(),name:name.value.trim().slice(0,18)});room.value=d.room;player.value=d.player;state.value=d;started.value=true;startPolling()}catch(e){error.value=e instanceof Error?e.message:'Odaya girilemedi'}finally{busy.value=false}}
async function act(action:string,payload?:string){if(busy.value)return;busy.value=true;error.value='';try{const d=await api({action,room:room.value,player:player.value,payload});state.value=d}catch(e){error.value=e instanceof Error?e.message:'Sinyal ulaşmadı'}finally{busy.value=false}}
async function inspect(target:string){selected.value=target;await act('inspect',target)}
async function move(dx:number,dy:number){const p=me.value;if(!p)return;await act('move',JSON.stringify({x:Math.max(8,Math.min(92,p.x+dx)),y:Math.max(18,Math.min(82,p.y+dy))}))}
async function solve(answer:string){await act('solve',answer)}
async function sendChat(){const v=chat.value.trim();if(!v)return;chat.value='';await act('chat',v.slice(0,90))}
function copyRoom(){navigator.clipboard?.writeText(room.value);notice.value='Oda kodu kopyalandı.';setTimeout(()=>notice.value='',1600)}
onBeforeUnmount(()=>window.clearInterval(pollTimer.value))
</script>

<template>
<div class="app">
  <header><div class="brand"><span>◈</span> KAYIP FREKANS</div><div class="signal"><i></i> 2 OYUNCU · DÜŞÜK VERİ</div></header>

  <main v-if="!started" class="landing">
    <section class="intro">
      <div class="kicker">BİRLİKTE KEŞFET · BİRLİKTE ÇÖZ</div>
      <h1>Gerçeğin sadece<br><em>yarısı sende.</em></h1>
      <p>Deniz fenerinin terk edilmiş odalarında kayıp bir sinyalin peşine düşün. İkinizin ekranı aynı dünyayı gösterir; ama bazı ayrıntılar yalnızca biriniz için görünür.</p>
      <div class="mini-scene">
        <div class="sky"></div><div class="moon"></div><div class="sea"></div><div class="rocks"></div><div class="lighthouse"><div class="beam"></div><div class="tower"><b></b><b></b><b></b></div><div class="light"></div></div><div class="figure"></div>
      </div>
    </section>
    <section class="entry">
      <div class="card"><label>OYUNCU ADI</label><input v-model="name" maxlength="18" placeholder="Örn. Elif" @keyup.enter="createRoom">
      <button class="primary" :disabled="!name.trim()||busy" @click="createRoom">YENİ OYUN <b>→</b></button>
      <div class="or"><span></span> ARKADAŞININ OYUNUNA GİR <span></span></div>
      <label>6 HANELİ ODA KODU</label><input v-model="roomInput" maxlength="6" inputmode="text" placeholder="ABC123" @input="roomInput=roomInput.toUpperCase()" @keyup.enter="joinRoom">
      <button class="secondary" :disabled="!name.trim()||roomInput.length!==6||busy" @click="joinRoom">OYUNA KATIL</button>
      <small v-if="error" class="error">{{error}}</small></div>
      <div class="promise"><span>01</span><b>Görsel dünya cihazda.</b><small>İnternet sadece küçük hareket sinyalleri taşır.</small><span>02</span><b>İki ekran, iki bakış.</b><small>Bulduğun şeyi arkadaşına anlatman gerekecek.</small></div>
    </section>
  </main>

  <main v-else class="game">
    <aside class="sidebar">
      <div class="room"><span>ODA</span><strong>{{room}}</strong><button @click="copyRoom">KOPYALA</button></div>
      <div class="players"><label>EKİP</label><div class="person"><i class="online"></i><b>{{me?.name||'Sen'}}</b><small>SEN</small></div><div class="person"><i :class="{online:!!other}"></i><b>{{other?.name||'Bekleniyor…'}}</b><small>{{other?'OYUNCU 2':'-'}}</small></div></div>
      <div class="mission"><label>VAKA 07</label><h3>Kayıp frekansın kaynağını bulun.</h3><div class="progress"><i :style="{width:progress+'%'}"></i></div><small>{{sceneSub}}</small></div>
      <div class="controls"><label>HAREKET</label><div class="pad"><button @click="move(0,-6)">▲</button><button @click="move(-6,0)">◀</button><button @click="move(6,0)">▶</button><button @click="move(0,6)">▼</button></div></div>
      <div class="lowdata">● Sinyal hafif.<br><b>{{state.players.length}} oyuncu bağlı</b><br>Son senkronizasyon otomatik.<br><br><small>Görseller: Wikimedia Commons · kamu malı / CC</small></div>
    </aside>

    <section class="world">
      <div class="worldbar"><div><label>{{sceneTitle}}</label><h2>{{sceneSub}}</h2></div><span>{{state.players.length}} / 2</span></div>
      <div v-if="state.phase==='lobby'" class="lobby"><div class="lighthouse-icon">✦</div><h1>İkinci oyuncuyu bekliyoruz.</h1><p>Arkadaşına bu kodu gönder.</p><button @click="copyRoom">{{room}} <span>↗</span></button></div>
      <template v-else-if="state.phase==='play'">
        <div class="scene" :class="'scene-'+state.scene">
          <div class="backdrop" :style="{backgroundImage:`linear-gradient(rgba(5,9,15,.48),rgba(5,9,15,.78)),url("${sceneImage}")`}"><div class="wall-light"></div><div class="window"></div><div class="floor"></div><div class="rug"></div><div class="desk" @click="inspect('desk')" :class="{selected:selected==='desk'}"><span>▤</span></div><div class="radio" @click="inspect('radio')" :class="{selected:selected==='radio'}"><img :src="radioImage" alt="Eski radyo"><span>◉</span></div><div class="map" @click="inspect('map')" :class="{selected:selected==='map'}">✦</div><div class="door" @click="inspect('door')" :class="{selected:selected==='door'}"><span>LOCK</span></div><div class="lamp" @click="inspect('lamp')" :class="{selected:selected==='lamp'}"></div><div class="crate" @click="inspect('crate')" :class="{selected:selected==='crate'}"></div><div class="beam"></div></div>
          <div v-for="p in state.players" :key="p.id" class="avatar" :class="{me:p.id===player}" :style="{left:p.x+'%',top:p.y+'%'}"><div class="avatar-head"></div><div class="avatar-body"></div><span>{{p.name}}</span></div>
          <div class="hint" v-if="selected"><b>{{hotspotText}}</b><span>{{state.clues[state.clues.length-1]||'İnceleniyor…'}}</span></div>
          <div class="objective"><span>HEDEF</span><b>{{state.scene===1?'Odayı araştır.':state.scene===2?'Tünelin sırrını çöz.':'Son sinyali gönder.'}}</b></div>
        </div>
        <div class="bottom">
          <div class="clue-strip"><label>CEPLERİNDEKİ İPUÇLARI</label><div v-if="state.clues.length" class="clues"><span v-for="(c,i) in state.clues" :key="i">◈ {{c}}</span></div><small v-else>Çevredeki nesnelere dokun ve keşfet.</small></div>
          <div class="actions">
            <button v-if="state.scene===1" class="solve" @click="solve('148')">KİLİDİ AÇ · 148</button>
            <button v-if="state.scene===2" class="solve" @click="solve('RED')">KIRMIZI KAPI</button>
            <button v-if="state.scene===3" class="solve" @click="solve('TOGETHER')">SON SİNYALİ GÖNDER</button>
          </div>
          <div class="chat"><div class="messages"><div v-for="(e,i) in [...state.events].reverse().slice(0,4)" :key="i"><b>{{e.p}}</b> {{e.t}}</div></div><div class="chatbox"><input v-model="chat" maxlength="90" placeholder="Arkadaşına bir şey söyle…" @keyup.enter="sendChat"><button @click="sendChat">→</button></div></div>
        </div>
      </template>
      <div v-else class="won"><div>✦</div><h1>Sinyali buldunuz.</h1><p>İki ayrı bakış açısı tek bir hikâyede birleşti.</p><strong>VAKA 07 · ÇÖZÜLDÜ</strong></div>
      <div v-if="notice" class="toast">{{notice}}</div><div v-if="error" class="toast error">{{error}}</div>
    </section>
  </main>
</div>
</template>