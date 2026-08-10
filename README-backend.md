Backend çalıştırma:

1. Terminalde proje köküne gelin:

```bash
cd c:/Users/Gökhan/Desktop/Kocluk-App
```

2. Bağımlılıkları yükleyin:

```bash
npm install
```

3. Sunucuyu başlatın:

```bash
npm start
```

Sunucu `http://localhost:3000` üzerinde çalışacaktır. Frontend, bu API'ye `fetch` ile çağrı yapar.

NOT: Bu örnek eğitim amaçlıdır. Gerçek üretimde `JWT_SECRET` environment değişkenini güçlü bir değer yapın ve token'ları HttpOnly cookie ile saklamayı düşünün.

Admin oluşturma:
- Eğer başlangıçta bir admin hesabı oluşturmak isterseniz, `ADMIN_EMAIL` ve `ADMIN_PASS` environment değişkenlerini ayarlayıp sunucuyu başlatın. Örnek:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASS=Secret123 npm start
```

Bu durumda `admin@example.com` ile kayıtlı bir admin oluşturulur (ilk çalıştırmada, `users.json` boşsa).

## Ogrenci/Veli Kod Girisi (Custom Token)

Bu surumde ogrenci ve veli giris kodlari Firebase Email/Password hesabi acmadan uretilir.
Kodlar backend tarafinda dogrulanir ve Firebase Custom Token verilir.

Gerekli ortam degiskenleri:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase service account JSON icerigi (tek satir JSON string).

Ornek (PowerShell):

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\serviceAccount.json -Raw
npm start
```

Ek notlar:

- `FIREBASE_SERVICE_ACCOUNT_JSON` yoksa `/api/student-access/provision` ve `/api/student-access/exchange` endpointleri `503` donecektir.
- Ogretmen paneli kod olustururken Firebase ogretmen oturumunun ID token bilgisini backend'e gonderir.

### Endpointler

1. `POST /api/student-access/provision`
- Yetki: Firebase ogretmen oturumu (`Authorization: Bearer <firebase-id-token>`)
- Islev: Ogrenci ve veli icin kod + uid uretir, Firestore'a kaydeder

2. `POST /api/student-access/exchange`
- Yetki: Gerekmez
- Islev: Girilen kodu dogrular, Firebase `customToken` doner

Istek ornegi:

```json
{ "code": "OG-ABC123" }
```

Yanıt ornegi:

```json
{
	"token": "<firebase-custom-token>",
	"uid": "stu_xxxxx",
	"role": "student"
}
```