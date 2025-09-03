# AI Sohbet Botu

Bu proje, Google Gemini AI kullanarak çalışan gelişmiş bir sohbet botudur. Kullanıcıların doğal dilde sohbet ettiği, dosya yükleyebildiği ve kişiselleştirilmiş bir deneyim yaşadığı bir uygulamadır.

## Özellikler

### 💬 Gelişmiş Sohbet
- Google Gemini AI entegrasyonu
- Doğal dil işleme ve anlama
- Emojiler ve kişilik özellikleriyle zenginleştirilmiş yanıtlar

### 🎭 Dinamik Kişilik Sistemi
- 6 farklı bot kişiliği: Arkadaş, Öğretmen, Asistan, Profesyonel, Resmi, Mesafeli
- Hızlı kişilik değiştirme komutları: `/formal`, `/professional`, `/distant`, `/friendly`
- Kullanıcı etkileşimlerine göre otomatik kişilik evrimi

### 😊 Duygu Algılama Sistemi
- Gerçek zamanlı duygu analizi (mutlu, üzgün, kızgın, heyecanlı, sakin, karışık)
- Duyguya göre arayüz teması değişimi
- Duygu yoğunluğu ölçümü ve trend takibi

### 🔐 Kullanıcı Kimlik Doğrulama
- Kullanıcı kayıt ve giriş sistemi
- Oturum yönetimi
- Kişisel tercihlerin ve ilgi alanlarının saklanması

### 📚 Konuşma Geçmişi
- Konuşmaların saklanması ve yönetilmesi
- Konuşma listesi ve önizleme
- Konuşma silme ve yeni konuşma başlatma

### 📎 Dosya Yükleme
- Resim (JPG, PNG, GIF) ve PDF dosya desteği
- Dosya analizi ve içerik anlama
- Maksimum 10MB dosya boyutu sınırı

### 🌗 Tema Desteği
- Açık ve koyu tema seçenekleri
- Otomatik tema algılama
- Manuel tema değiştirme

## Kurulum

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm (Node.js ile birlikte gelir)

### Kurulum Adımları

1. Repoyu klonlayın:
```bash
git clone <repo-url>
cd chatbot
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Ortam değişkenlerini ayarlayın:
```bash
# .env dosyasını oluşturun ve aşağıdaki değişkenleri ekleyin:
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Uygulamayı başlatın:
```bash
node index.js
```

5. Tarayıcınızda `http://localhost:3000` adresine gidin

## Kullanım

### Temel Komutlar
- `/help` - Yardım menüsünü gösterir
- `/clear` - Sohbet geçmişini temizler
- `/reset` - Yeni bir oturum başlatır
- `/about` - Bot hakkında bilgi verir
- `/profile` - Profil ayarlarını gösterir

### Kullanıcı Yönetimi
- `/setname [isim]` - İsminizi ayarlar
- `/whoami` - Profil bilgilerinizi gösterir
- `/lang [tr/en]` - Dil değiştirir

### Kişilik Ayarları
- `/personality [tip]` - Bot kişiliği değiştirir
- `/formal` - Resmi moda geçer
- `/professional` - Profesyonel moda geçer
- `/distant` - Mesafeli moda geçer
- `/friendly` - Arkadaş moduna geri döner

### Kullanıcı Profili Yönetimi
- `/addinterest [konu]` - İlgi alanı ekler
- `/myinterests` - İlgi alanlarınızı gösterir
- `/mystats` - Profil istatistiklerinizi gösterir
- `/myresearch` - Araştırma geçmişinizi gösterir

### Yaratıcı Komutlar
- `/story [tema]` - Hikaye yazımı başlatır
- `/brainstorm [konu]` - Beyin fırtınası oturumu başlatır
- `/poem [stil]` - Şiir yazımı başlatır
- `/riddle` - Bilmece oluşturur

## Teknoloji Yığını

- **Backend**: Node.js, Express.js
- **AI Servisleri**: Google Gemini AI
- **Frontend**: HTML, CSS, JavaScript
- **Veri Saklama**: JSON dosyaları
- **Dosya Yükleme**: Multer

## API Anahtarı

### Google Gemini API
1. [Google AI Studio](https://makersuite.google.com/) adresine gidin
2. Bir API anahtarı oluşturun
3. `.env` dosyasına `GEMINI_API_KEY=your_key_here` olarak ekleyin

## Katkıda Bulunma

1. Forklayın
2. Yeni bir özellik dalı oluşturun (`git checkout -b feature/YeniOzellik`)
3. Değişikliklerinizi yapın
4. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
5. Dalınızı push edin (`git push origin feature/YeniOzellik`)
6. Bir Pull Request oluşturun

## İletişim

Proje ile ilgili sorularınız için lütfen issue oluşturun veya e-posta gönderin.

---

*Bu proje, kullanıcıların AI ile doğal ve kişiselleştirilmiş bir sohbet deneyimi yaşamalarını sağlamayı amaçlamaktadır.*