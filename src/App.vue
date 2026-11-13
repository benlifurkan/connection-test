<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type Sample = {
  id: number
  sentAt: number
  latencyMs: number | null
  bytes: number
  status: 'success' | 'failed'
  note?: string
}

const API_BASE = (import.meta.env.VITE_TEST_API_URL?.replace(/\/$/, '') ?? window.location.origin).trim()
const packetSizes = [128, 512, 1024, 5120]
const packetSize = ref(512)
const intervalMs = ref(3000)
const running = ref(false)
const samples = ref<Sample[]>([])
const totalSent = ref(0)
const totalReceived = ref(0)
const errors = ref(0)
const lastResult = ref('Henüz test yapılmadı')
const statusText = ref('Hazır')
const statusTone = ref<'neutral' | 'good' | 'bad'>('neutral')
const startedAt = ref<number | null>(null)
const elapsedSeconds = ref(0)
const runMode = ref<'echo' | 'download'>('echo')
const manualBusy = ref(false)

let timer: number | undefined
let elapsedTimer: number | undefined
let sequence = 0

const successRate = computed(() => {
  if (!totalSent.value) return 0
  return Math.round((totalReceived.value / totalSent.value) * 100)
})
const averageLatency = computed(() => {
  const values = samples.value.filter((s) => s.status === 'success' && s.latencyMs !== null).map((s) => s.latencyMs as number)
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
})
const minLatency = computed(() => {
  const values = samples.value.filter((s) => s.status === 'success' && s.latencyMs !== null).map((s) => s.latencyMs as number)
  return values.length ? Math.min(...values) : null
})
const maxLatency = computed(() => {
  const values = samples.value.filter((s) => s.status === 'success' && s.latencyMs !== null).map((s) => s.latencyMs as number)
  return values.length ? Math.max(...values) : null
})
const totalBytes = computed(() => samples.value.reduce((sum, sample) => sum + sample.bytes, 0))
const formattedBytes = computed(() => {
  const bytes = totalBytes.value
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
})
const connectionType = computed(() => {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection
  return connection?.effectiveType ? `${connection.effectiveType.toUpperCase()}${connection.downlink ? ` · ${connection.downlink} Mbps tahmini` : ''}` : 'Tarayıcı bilgisi sunmuyor'
})
const online = ref(navigator.onLine)

function setStatus(text: string, tone: 'neutral' | 'good' | 'bad' = 'neutral') {
  statusText.value = text
  statusTone.value = tone
}

function makePayload(size: number, id: number) {
  const base = { id, clientTime: new Date().toISOString(), kind: 'connection-test' }
  const prefix = JSON.stringify(base)
  const fillerLength = Math.max(0, size - new TextEncoder().encode(prefix).length - 2)
  return JSON.stringify({ ...base, padding: 'x'.repeat(fillerLength) })
}

async function sendProbe() {
  if (!API_BASE) {
    setStatus('Sunucu adresi yapılandırılmadı', 'bad')
    lastResult.value = 'Bu dağıtımda VITE_TEST_API_URL ayarı yok. Yerel bağlantı/sunum testi için yerel mod kullanılabilir.'
    return
  }

  const id = ++sequence
  const payload = makePayload(packetSize.value, id)
  const bodyBytes = new TextEncoder().encode(payload).byteLength
  const started = performance.now()
  totalSent.value += 1

  try {
    const endpoint = runMode.value === 'echo' ? '/api/echo' : '/api/download'
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: runMode.value === 'echo' ? 'POST' : 'GET',
      headers: runMode.value === 'echo' ? { 'Content-Type': 'application/json' } : undefined,
      body: runMode.value === 'echo' ? payload : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json() as { ok?: boolean; receivedBytes?: number }
    if (!result.ok) throw new Error('Sunucu yanıtı beklenen biçimde değil')
    const latencyMs = Math.round(performance.now() - started)
    totalReceived.value += 1
    samples.value.unshift({ id, sentAt: Date.now(), latencyMs, bytes: runMode.value === 'echo' ? bodyBytes : Number(result.receivedBytes ?? 0), status: 'success' })
    lastResult.value = `Paket #${id} başarıyla ulaştı · ${latencyMs} ms`
    setStatus('Bağlantı yanıt veriyor', 'good')
  } catch (error) {
    errors.value += 1
    const latencyMs = Math.round(performance.now() - started)
    samples.value.unshift({ id, sentAt: Date.now(), latencyMs, bytes: bodyBytes, status: 'failed', note: error instanceof Error ? error.message : 'Bilinmeyen hata' })
    lastResult.value = `Paket #${id} başarısız · ${error instanceof Error ? error.message : 'Bağlantı hatası'}`
    setStatus('İstek başarısız', 'bad')
  }
  samples.value = samples.value.slice(0, 100)
}

async function runSingle() {
  if (manualBusy.value) return
  manualBusy.value = true
  try {
    await sendProbe()
  } finally {
    manualBusy.value = false
  }
}

function startTest() {
  if (running.value) return
  if (!online.value) {
    setStatus('Cihaz çevrimdışı görünüyor', 'bad')
    return
  }
  running.value = true
  startedAt.value = Date.now()
  setStatus('Test çalışıyor', 'good')
  void sendProbe()
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void sendProbe()
  }, intervalMs.value)
  elapsedTimer = window.setInterval(() => {
    if (startedAt.value) elapsedSeconds.value = Math.floor((Date.now() - startedAt.value) / 1000)
  }, 1000)
}

function stopTest() {
  running.value = false
  if (timer) window.clearInterval(timer)
  if (elapsedTimer) window.clearInterval(elapsedTimer)
  timer = undefined
  elapsedTimer = undefined
  setStatus('Test durduruldu')
}

function resetTest() {
  stopTest()
  samples.value = []
  totalSent.value = 0
  totalReceived.value = 0
  errors.value = 0
  sequence = 0
  startedAt.value = null
  elapsedSeconds.value = 0
  lastResult.value = 'Henüz test yapılmadı'
  setStatus('Hazır')
}

function exportCsv() {
  const header = ['Paket', 'Zaman', 'Durum', 'Gecikme (ms)', 'Bayt', 'Not']
  const rows = [...samples.value].reverse().map((sample) => [
    sample.id,
    new Date(sample.sentAt).toISOString(),
    sample.status,
    sample.latencyMs ?? '',
    sample.bytes,
    sample.note ?? '',
  ])
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `connection-test-${new Date().toISOString().replaceAll(':', '-')}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const rest = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${rest}`
}

function updateOnline() {
  online.value = navigator.onLine
  if (!online.value) setStatus('Cihaz çevrimdışı', 'bad')
  else if (!running.value) setStatus('Bağlantı geri geldi')
}
window.addEventListener('online', updateOnline)
window.addEventListener('offline', updateOnline)
onBeforeUnmount(() => {
  stopTest()
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Connection Test ana sayfa">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>CONNECTION<span class="brand-light">.LAB</span></span>
      </a>
      <div class="topbar-right">
        <span class="live-dot" :class="{ offline: !online }"></span>
        <span>{{ online ? 'CİHAZ ÇEVRİMİÇİ' : 'ÇEVRİMDIŞI' }}</span>
        <span class="version">BETA 0.1</span>
      </div>
    </header>

    <section class="intro">
      <div class="eyebrow"><span class="eyebrow-line"></span> LOW BANDWIDTH EXPERIMENT</div>
      <h1>Az veriyle ne<br /><em>kadar yol alırız?</em></h1>
      <p class="intro-copy">Bu laboratuvar, zayıf ve kararsız internet bağlantılarında küçük veri paketlerinin teslimatını ve yanıt süresini ölçer. Büyük indirmelere değil, oyunumuzun ihtiyaç duyacağı kadar küçük sinyallere odaklanıyoruz.</p>
    </section>

    <section class="status-strip">
      <div class="status-left">
        <span class="status-indicator" :class="statusTone"></span>
        <div><strong>{{ statusText }}</strong><small>{{ lastResult }}</small></div>
      </div>
      <div class="status-meta"><span class="meta-label">TARAYICI AĞ BİLGİSİ</span><strong>{{ connectionType }}</strong></div>
    </section>

    <section class="dashboard">
      <div class="main-column">
        <article class="panel test-panel">
          <div class="panel-heading">
            <div><span class="section-index">01 / TEST AYARLARI</span><h2>Bağlantıyı yokla</h2></div>
            <span class="pill" :class="{ active: running }">{{ running ? 'TEST AKTİF' : 'BEKLEMEDE' }}</span>
          </div>

          <div class="control-grid">
            <label class="field">
              <span>PAKET BOYUTU</span>
              <select v-model.number="packetSize">
                <option v-for="size in packetSizes" :key="size" :value="size">{{ size >= 1024 ? (size / 1024) + ' KB' : size + ' B' }}</option>
              </select>
              <small>Her istekte gönderilecek yaklaşık veri miktarı.</small>
            </label>
            <label class="field">
              <span>GÖNDERİM ARALIĞI</span>
              <select v-model.number="intervalMs" :disabled="running">
                <option :value="1000">1 saniye</option>
                <option :value="3000">3 saniye</option>
                <option :value="5000">5 saniye</option>
                <option :value="10000">10 saniye</option>
              </select>
              <small>Otomatik testte iki istek arasındaki süre.</small>
            </label>
          </div>

          <div class="mode-row">
            <span class="mode-title">TEST TÜRÜ</span>
            <button class="mode-button" :class="{ selected: runMode === 'echo' }" :disabled="running" @click="runMode = 'echo'">Gidiş-dönüş <small>İstek + yanıt</small></button>
            <button class="mode-button" :class="{ selected: runMode === 'download' }" :disabled="running" @click="runMode = 'download'">Küçük indirme <small>Yanıt boyutu</small></button>
          </div>
          
          <div class="action-row">
            <button class="primary-button" :disabled="running || !API_BASE || !online" @click="startTest"><span class="play-icon">▶</span> Testi başlat</button>
            <button class="secondary-button" :disabled="running || !API_BASE || !online || manualBusy" @click="runSingle">Tek paket gönder</button>
            <button v-if="running" class="stop-button" @click="stopTest">Durdur</button>
            <button class="quiet-button" :disabled="running" @click="resetTest">Sıfırla</button>
          </div>
          <div class="test-foot"><span><i class="tiny-dot"></i> Test süresi: {{ formatDuration(elapsedSeconds) }}</span><span>Sayfa açıkken ölçüm yapılır</span></div>
        </article>

        <article class="panel history-panel">
          <div class="panel-heading">
            <div><span class="section-index">02 / ÖLÇÜM GEÇMİŞİ</span><h2>Son paketler</h2></div>
            <button class="text-button" :disabled="samples.length === 0" @click="exportCsv">CSV DIŞA AKTAR ↗</button>
          </div>
          <div v-if="samples.length" class="table-wrap">
            <table>
              <thead><tr><th>PAKET</th><th>SONUÇ</th><th>GECİKME</th><th>BOYUT</th></tr></thead>
              <tbody>
                <tr v-for="sample in samples.slice(0, 12)" :key="sample.id">
                  <td class="mono">#{{ sample.id }}</td>
                  <td><span class="result-tag" :class="sample.status">{{ sample.status === 'success' ? 'Ulaştı' : 'Hata' }}</span></td>
                  <td class="mono">{{ sample.latencyMs === null ? '—' : sample.latencyMs + ' ms' }}</td>
                  <td class="mono">{{ sample.bytes }} B</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state"><span class="empty-icon">⌁</span><strong>Henüz ölçüm yok</strong><small>Test başladığında paket sonuçları burada görünecek.</small></div>
        </article>
      </div>

      <aside class="side-column">
        <article class="panel metric-panel">
          <span class="section-index">CANLI İSTATİSTİK</span>
          <div class="metric-primary"><strong>{{ averageLatency === null ? '—' : averageLatency }}</strong><span>ms<br />ORT. GECİKME</span></div>
          <div class="metric-divider"></div>
          <div class="metric-row"><span>Başarılı paket</span><strong>{{ totalReceived }} / {{ totalSent }}</strong></div>
          <div class="metric-row"><span>Başarı oranı</span><strong>{{ successRate }}%</strong></div>
          <div class="metric-row"><span>Hata sayısı</span><strong :class="{ danger: errors > 0 }">{{ errors }}</strong></div>
          <div class="metric-row"><span>Min. / Maks.</span><strong>{{ minLatency ?? '—' }} / {{ maxLatency ?? '—' }} ms</strong></div>
          <div class="metric-row"><span>Aktarılan veri</span><strong>{{ formattedBytes }}</strong></div>
          <div class="progress-track"><span :style="{ width: successRate + '%' }"></span></div>
        </article>

        <article class="info-card">
          <span class="info-icon">i</span>
          <div><strong>Bu test neyi ölçüyor?</strong><p>Bir isteğin sunucuya gidip yanıtla geri gelme süresini, başarılı istek oranını ve veri hacmini. Yani yalnızca hız değil, bağlantının ne kadar tutarlı olduğunu da gözlemliyoruz.</p></div>
        </article>

        <article class="info-card warning-card">
          <span class="info-icon">!</span>
          <div><strong>Önemli sınır</strong><p>Instagram mesajlarının çalışması, bu testin de çalışacağını garanti etmez. Uygulamaların sunucuları, ağ öncelikleri ve bağlantı yöntemleri farklı olabilir.</p></div>
        </article>
      </aside>
    </section>

    <footer>
      <span>CONNECTION.LAB <span class="footer-muted">· KÜÇÜK PAKET, BÜYÜK FİKİR.</span></span>
      <span>Veriler yalnızca bu oturumda tutulur.</span>
    </footer>
  </main>
</template>
