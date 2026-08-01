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