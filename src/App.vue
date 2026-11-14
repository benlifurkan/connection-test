<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Player = { id: string; name: string }
type GameState = {
  ok: boolean; room: string; player: string; phase: 'lobby'|'play'|'won'
  players: Player[]; ready: number; scene: number; clues: string[]
  events: { p:string; t:string }[]; message?: string
}

const API = '/api/game'
const name = ref('')
const roomInput = ref('')
const room = ref('')
const player = ref('')
const state = ref<GameState>({ ok:true, room:'', player:'', phase:'lobby', players:[], ready:0, scene:0, clues:[], events:[] })
const busy = ref(false)
const error = ref('')
const notice = ref('')
const chat = ref('')
const pollTimer = ref<number | undefined>()
const started = ref(false)

const me = computed(() => state.value?.players.find(p => p.id === player.value))
const other = computed(() => state.value?.players.find(p => p.id !== player.value))
const sceneTitle = computed(() => ['GİRİŞ','MAVİ ODA','KİLİTLİ KORİDOR','SON SİNYAL'][state.value?.scene ?? 0])
const progress = computed(() => Math.min(100, ((state.value?.scene ?? 0) / 3) * 100))

async function api(body: Record<string, unknown>) {
  const r = await fetch(API, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), cache:'no-store' })
  const data = await r.json()
  if (!r.ok || data.ok === false) throw new Error(data.error || 'Bağlantı kurulamadı')
  return data
}
async function poll() {
  if (!room.value || !player.value) return
  try {
    const r = await fetch(API + '?room=' + encodeURIComponent(room.value) + '&player=' + encodeURIComponent(player.value), { cache:'no-store' })
    if (r.ok) state.value = await r.json()
  } catch {}
}
function startPolling() {
  window.clearInterval(pollTimer.value)
  pollTimer.value = window.setInterval(poll, 2200)
}
async function createRoom() {
  if (!name.value.trim() || busy.value) return
  busy.value = true; error.value = ''
  try {
    const d = await api({ action:'create', name:name.value.trim().slice(0,18) })
    room.value=d.room; player.value=d.player; state.value=d; started.value=true; startPolling()
  } catch(e) { error.value=e instanceof Error?e.message:'Bir şey ters gitti' } finally { busy.value=false }
}
async function joinRoom() {
  if (!name.value.trim() || !roomInput.value.trim() || busy.value) return
  busy.value=true; error.value=''
  try {
    const d=await api({ action:'join', room:roomInput.value.trim().toUpperCase(), name:name.value.trim().slice(0,18) })
    room.value=d.room; player.value=d.player; state.value=d; started.value=true; startPolling()
  } catch(e) { error.value=e instanceof Error?e.message:'Odaya girilemedi' } finally { busy.value=false }
}
async function act(action:string, payload?:string) {
  if (busy.value) return
  busy.value=true; error.value=''; notice.value=''
  try { const d=await api({action,room:room.value,player:player.value,payload}); state.value=d }
  catch(e){ error.value=e instanceof Error?e.message:'Sinyal ulaşmadı' }
  finally{busy.value=false}
}
async function sendChat(){ const v=chat.value.trim(); if(!v)return; chat.value=''; await act('chat',v.slice(0,90)) }
function copyRoom(){ navigator.clipboard?.writeText(room.value); notice.value='Oda kodu kopyalandı.'; setTimeout(()=>notice.value='',1800) }
onBeforeUnmount(()=>window.clearInterval(pollTimer.value))
</script>

<template>
<div class="app">
  <div class="grain"></div>
  <header><div class="brand"><span class="mark">◈</span> KAYIP FREKANS</div><div class="signal"><i></i> LOW DATA MODE</div></header>

  <main v-if="!started" class="landing">
    <section class="hero">
      <div class="kicker">İKİ KİŞİ · TEK SİNYAL · 10–15 DK</div>
      <h1>Birbirinizde olmayan<br><em>ipuçlarını bulun.</em></h1>
      <p>Telefon ekranınızın tamamını değil, yalnızca küçük sinyalleri paylaşın. Aynı odadasınız. Ama gerçeğin yalnızca yarısı sizde.</p>
    </section>
    <section class="entry">
      <div class="card">
        <label>ADIN</label><input v-model="name" maxlength="18" placeholder="Örn. Elif" @keyup.enter="createRoom">
        <button class="primary" :disabled="!name.trim() || busy" @click="createRoom">ODA OLUŞTUR <b>→</b></button>
        <div class="or"><span></span> veya <span></span></div>
        <label>ODA KODU</label><input v-model="roomInput" maxlength="6" placeholder="ABC123" @keyup.enter="joinRoom" @input="roomInput=roomInput.toUpperCase()">
        <button class="secondary" :disabled="!name.trim() || roomInput.length<4 || busy" @click="joinRoom">ODA'YA KATIL</button>
        <small v-if="error" class="error">{{error}}</small>
      </div>
      <div class="promise"><span>01</span><div><b>Çok küçük paketler.</b><br>Oyun, görüntü veya ses taşımıyor.</div><span>02</span><div><b>Birlikte çözülüyor.</b><br>İkinizin gördüğü şey aynı değil.</div></div>
    </section>
  </main>

  <main v-else class="game">
    <aside class="side">
      <div class="room-code"><span>ODA</span><b>{{room}}</b><button @click="copyRoom">KOPYALA</button></div>
      <div class="players"><span class="label">BAĞLANTI</span>
        <div class="person"><i class="on"></i><span>{{me?.name || 'Sen'}}</span><em>Sen</em></div>
        <div class="person"><i :class="{on:!!other}"></i><span>{{other?.name || 'Bekleniyor…'}}</span><em>{{other?'Oyuncu 2':'-'}}</em></div>
      </div>
      <div class="mission"><span class="label">GÖREV</span><h3>İkinizin bildiklerini<br>tek bir gerçeğe çevir.</h3><div class="bar"><i :style="{width:progress+'%'}"></i></div><small>{{state?.scene===0?'Diğer oyuncuyu bekliyoruz.':sceneTitle}}</small></div>
      <div class="tip">⚡ <b>Bağlantı ipucu</b><br>Her hareket birkaç küçük veri paketinden oluşur. Sinyal düşerse oyun tekrar denemeyi kendisi yapar.</div>
    </aside>

    <section class="board">
      <div class="board-top"><div><span class="label">DOSYA 07</span><h2>{{sceneTitle}}</h2></div><span class="tiny">{{state?.players.length}} / 2 OYUNCU</span></div>

      <div v-if="state?.phase==='lobby'" class="waiting">
        <div class="pulse">◉</div><h1>Karşı tarafın<br>sinyali bekleniyor.</h1><p>Bu kodu diğer oyuncuya gönder:</p><button class="room-big" @click="copyRoom">{{room}} <span>↗</span></button><small>Odaya iki kişi girdiğinde dosya açılacak.</small>
      </div>

      <div v-else-if="state?.phase==='won'" class="waiting won">
        <div class="pulse">✓</div><h1>Sinyal tamamlandı.</h1><p>İki ayrı ekrandaki parçalar birleşti ve dosya çözüldü.</p><strong>BU HİKÂYE İKİNİZİN.</strong>
      </div>

      <div v-else class="play">
        <div class="brief">
          <span class="stamp">GİZLİ</span>
          <p v-if="state.scene===1">Saat 21:17'de bir terminal kapandı. Masada yalnızca bir renk notu var. <b>Senin gördüğün ipucu diğer oyuncunun ekranında yok.</b></p>
          <p v-else-if="state.scene===2">İlk kilit açıldı. Koridorda üç sembol ve yarım bir cümle var. Parçaları birleştirmeden kapı açılmıyor.</p>
          <p v-else>Son sinyal geliyor. Bu kez yalnızca biriniz doğru seçimi görebilir. <b>Kararı birlikte verin.</b></p>
        </div>

        <div class="clues">
          <div v-for="(clue,i) in state.clues" :key="i" class="clue"><span>{{String(i+1).padStart(2,'0')}}</span><p>{{clue}}</p></div>
        </div>

        <div class="actions" v-if="state.scene===1">
          <span class="label">ARAŞTIR</span>
          <button @click="act('inspect','terminal')">⌁ TERMINALİ İNCELE</button>
          <button @click="act('inspect','desk')">▱ MASAYI İNCELE</button>
          <button @click="act('inspect','wall')">▦ DUVARI İNCELE</button>
          <button class="accent" @click="act('solve','148')">KODU GÖNDER · 148</button>
        </div>
        <div class="actions" v-else-if="state.scene===2">
          <span class="label">PARÇAYI TEST ET</span>
          <button @click="act('inspect','symbol')">◇ SEMBOLLERE BAK</button>
          <button @click="act('inspect','paper')">⌑ NOTU OKU</button>
          <button @click="act('solve','BLUE')">MAVİ KAPI</button>
          <button @click="act('solve','RED')">KIRMIZI KAPI</button>
        </div>
        <div class="actions" v-else>
          <span class="label">SON KARAR</span>
          <button @click="act('inspect','signal')">◉ SİNYALİ DİNLE</button>
          <button @click="act('inspect','window')">□ PENCEREYİ KONTROL ET</button>
          <button class="accent" @click="act('solve','TOGETHER')">BİRLİKTE GÖNDER</button>
        </div>

        <div class="feed"><div class="feed-head"><span class="label">ORTAK SİNYAL</span><small>canlı</small></div><div v-for="(e,i) in [...state.events].reverse().slice(0,7)" :key="i" class="event"><b>{{e.p}}</b><span>{{e.t}}</span></div><div v-if="!state.events.length" class="empty">Henüz ortak bir hareket yok.</div></div>
        <div class="chat"><input v-model="chat" maxlength="90" placeholder="Kısa bir mesaj gönder…" @keyup.enter="sendChat"><button @click="sendChat">→</button></div>
      </div>
      <div v-if="error" class="toast error">{{error}}</div><div v-if="notice" class="toast">{{notice}}</div>
    </section>
  </main>
</div>
</template>