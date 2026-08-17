# Lisa Anatasha — Production Deploy

Website mobile-first bergaya referensi screenshot + Paymenku + Railway PostgreSQL.

## 1. Jalankan lokal

```bash
npm install
cp .env.example .env
npm start
```

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Buka:

```text
http://localhost:3000
```

Isi `.env` dengan API key Paymenku.

## 2. GitHub lewat terminal

Buat repository kosong di GitHub, misalnya:

```text
lisa-anatasha-store
```

Lalu dari folder project:

```bash
git init
git branch -M main
git add .
git commit -m "Initial Lisa Anatasha store"
git remote add origin https://github.com/USERNAME/lisa-anatasha-store.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub kamu.

Jika GitHub CLI (`gh`) sudah login, bisa juga:

```bash
gh repo create lisa-anatasha-store --private --source=. --remote=origin --push
```

## 3. Deploy Railway lewat terminal

Install Railway CLI terlebih dahulu:

```bash
npm i -g @railway/cli
```

Login:

```bash
railway login
```

Dari folder project:

```bash
railway init
railway up
```

Setelah deploy, cek:

```bash
railway domain
```

Jika belum punya public domain:

```bash
railway domain
```

Railway akan memberikan URL `*.up.railway.app`.

## 4. Environment Variables Railway

Set variable dari dashboard Railway atau CLI.

Minimal:

```bash
railway variables set PAYMENKU_API_KEY="sk_live_xxxxxxxxx"
railway variables set PAYMENKU_BASE_URL="https://api.paymenku.com"
railway variables set STORE_NAME="Lisa Anatasha"
railway variables set NODE_ENV="production"
```

Set URL setelah Railway memberi domain:

```bash
railway variables set STORE_URL="https://DOMAIN-RAILWAY-KAMU"
```

Webhook secret, bila tersedia dari Paymenku:

```bash
railway variables set PAYMENKU_WEBHOOK_SECRET="SECRET_DARI_PAYMENKU"
railway variables set PAYMENKU_WEBHOOK_SIGNATURE_HEADER="x-paymenku-signature"
```

## 5. PostgreSQL Railway

Untuk production, jangan mengandalkan `data/orders.json` karena filesystem deployment dapat bersifat ephemeral.

Tambahkan PostgreSQL pada project Railway melalui dashboard:

**Project → + New → Database → PostgreSQL**

Railway akan menyediakan `DATABASE_URL`.

Setelah PostgreSQL terpasang, service aplikasi menggunakan database otomatis dan membuat tabel `orders` saat startup.

Cek:

```bash
railway variables
```

Pastikan `DATABASE_URL` ada.

## 6. Webhook Paymenku

Di dashboard Paymenku, arahkan webhook ke:

```text
https://DOMAIN-RAILWAY-KAMU/api/webhook/paymenku
```

Website sudah menyediakan endpoint tersebut.

Paymenku menyatakan webhook menggunakan HMAC SHA-256. Nama header/signature dan format payload sebaiknya mengikuti detail webhook yang tampil pada akun Paymenku kamu. Jika header berbeda, ubah:

```bash
railway variables set PAYMENKU_WEBHOOK_SIGNATURE_HEADER="NAMA-HEADER"
```

## 7. Payment channel

Frontend menyediakan channel yang diminta:

```text
bnc_va
bni_va
bri_va
btn_va
cimb_va
maybank_va
muamalat_va
permata_va
dana
linkaja
qris
```

Server meneruskan `channel_code` tersebut ke Paymenku.

Catatan: dokumentasi publik Paymenku saat ini mencontohkan QRIS dengan `qris3`, sementara kamu memberikan channel `qris`. Template ini sengaja mempertahankan `qris` sesuai channel yang kamu berikan. Jika dashboard Paymenku kamu menampilkan kode `qris3`, ubah mapping frontend/server menjadi `qris3`.

## 8. Test production

Health check:

```bash
curl https://DOMAIN-RAILWAY-KAMU/health
```

Expected:

```json
{"ok":true,"service":"lisa-anatasha-store"}
```

Test API config:

```bash
curl https://DOMAIN-RAILWAY-KAMU/api/config
```

Setelah itu lakukan transaksi kecil menggunakan sandbox dahulu sebelum memasukkan production API key.

## 9. Security

- API key Paymenku hanya ada di server.
- `.env` masuk `.gitignore`.
- Jangan commit API key ke GitHub.
- Gunakan PostgreSQL untuk production.
- Webhook HMAC dapat diaktifkan dengan `PAYMENKU_WEBHOOK_SECRET`.
- Idempotency key menggunakan reference ID order.

## 10. File digital

Template ini sudah menangani order dan status pembayaran, tetapi delivery file digital sengaja tidak dibuat dengan mengirim file dari `public/`.

Untuk production, setelah status `paid/success/settled/completed`:
1. Simpan file di private object storage.
2. Generate signed download URL.
3. Kirim URL ke email customer.
4. Tampilkan halaman download berdasarkan reference ID.

Jangan membuat folder konten premium dapat diakses langsung dari `/public`.

## Referensi Paymenku

Dokumentasi publik Paymenku menyebut:
- `POST /v1/transaction/create`
- `GET /v1/transaction/{trx_id}`
- Bearer token authentication
- idempotency support
- webhook HMAC SHA-256
- sandbox dan production API key

Gunakan dokumentasi resmi Paymenku untuk mencocokkan response dan webhook payload akun kamu sebelum go-live.
