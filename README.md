# Connection Test

Düşük bant genişliğinde çalışan bağlantıların küçük veri paketlerini ne kadar tutarlı taşıyabildiğini ölçmek için Vue 3 + Vite + TypeScript arayüzü.

## Geliştirme

```bash
pnpm install
pnpm dev
```

## Mimari not

İlk arayüz hazırdır. İki cihazın gerçekten test edilebilmesi için bir HTTPS API sunucusu gerekir. Arayüz, `VITE_TEST_API_URL` ortam değişkeniyle sunucu adresini bekler.

Beklenen uç noktalar:
- `POST /api/echo`: JSON isteğini alır ve `{ "ok": true, "receivedBytes": 512 }` benzeri küçük JSON yanıtı döndürür.
- `GET /api/download`: küçük bir JSON yanıtı döndürür.

API bağlantısı kurulmadan butonlar kapalıdır; arayüz gerçek test yapılmış gibi davranmaz.

## Test hakkında

- Başarılı istek oranı, gecikme ve paket boyutu ölçülür.
- Son 100 ölçüm tarayıcı belleğinde tutulur ve CSV olarak dışa aktarılabilir.
- Sekme arka plana geçtiğinde otomatik test istekleri gönderilmez.
- Uygulama, çevrimdışı durumu tarayıcının `navigator.onLine` bilgisiyle gösterir.

**Önemli:** Bir sosyal medya uygulamasının mesaj gönderebilmesi, bu uygulamanın sunucusuna bağlantının da çalışacağını garanti etmez. Bu test, yalnızca test sayfasının erişebildiği sunucu yolunu değerlendirir. Testi gerçek hedef telefonda yapmak gerekir. Bağlantının çok zayıf olduğu ortamda ilk sayfa yüklemesi bile mümkün olmayabilir; bu nedenle ileride hafif bir PWA ve küçük istekler tasarlanacaktır.

## Ücretsiz barındırma

İstemci statik olarak GitHub Pages, Cloudflare Pages veya Vercel üzerinde yayınlanabilir. İki cihaz arasında gerçek istek/yanıt ölçümü için CORS destekleyen bir API gerekir. Ücretli servis gerektirmeyen seçenekleri değerlendirirken sağlayıcının ücretsiz katman sınırları ve uyku/soğuk başlatma davranışı ayrıca kontrol edilmelidir.
