const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "data", "orders.json");

const CHANNELS = {
  bnc_va: { name: "Bank Neo Virtual Account", type: "va" },
  bni_va: { name: "BNI Virtual Account", type: "va" },
  bri_va: { name: "BRI Virtual Account", type: "va" },
  btn_va: { name: "BTN Virtual Account", type: "va" },
  cimb_va: { name: "CIMB Virtual Account", type: "va" },
  maybank_va: { name: "Maybank Virtual Account", type: "va" },
  muamalat_va: { name: "Muamalat Virtual Account", type: "va" },
  permata_va: { name: "Permata Virtual Account", type: "va" },
  dana: { name: "DANA", type: "ewallet" },
  linkaja: { name: "LinkAja", type: "ewallet" },
  qris: { name: "QRIS", type: "qris" }
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("railway.internal")
        ? false
        : { rejectUnauthorized: false }
    })
  : null;

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      reference_id TEXT UNIQUE NOT NULL,
      trx_id TEXT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount BIGINT NOT NULL,
      customer JSONB NOT NULL,
      channel_code TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment JSONB,
      webhook JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_trx_id ON orders(trx_id);
    CREATE INDEX IF NOT EXISTS idx_orders_reference_id ON orders(reference_id);
  `);
}

function readOrdersLocal() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrdersLocal(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

async function saveOrder(order) {
  if (!pool) {
    const orders = readOrdersLocal();
    orders.push(order);
    writeOrdersLocal(orders);
    return;
  }

  await pool.query(
    `INSERT INTO orders
      (reference_id,trx_id,product_id,product_name,amount,customer,channel_code,channel_name,status,payment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      order.referenceId, order.trx_id || null, order.productId, order.productName,
      order.amount, order.customer, order.channelCode, order.channelName,
      order.status || "pending", order.payment || null
    ]
  );
}

async function findOrder(referenceId) {
  if (!pool) return readOrdersLocal().find(o => o.referenceId === referenceId) || null;
  const { rows } = await pool.query(
    `SELECT reference_id, trx_id, product_id, product_name, amount, customer,
            channel_code, channel_name, status, payment, webhook, created_at, updated_at
       FROM orders WHERE reference_id=$1 LIMIT 1`,
    [referenceId]
  );
  return rows[0] ? dbToOrder(rows[0]) : null;
}

async function updateOrderByIds({ trxId, referenceId, status, payment, webhook }) {
  if (!pool) {
    const orders = readOrdersLocal();
    const idx = orders.findIndex(o =>
      (trxId && o.trx_id === trxId) || (referenceId && o.referenceId === referenceId)
    );
    if (idx < 0) return null;
    orders[idx].status = status || orders[idx].status;
    if (payment) orders[idx].payment = { ...(orders[idx].payment || {}), ...payment };
    if (webhook) orders[idx].webhook = webhook;
    orders[idx].updatedAt = new Date().toISOString();
    writeOrdersLocal(orders);
    return orders[idx];
  }

  const where = trxId ? "trx_id=$1" : "reference_id=$1";
  const value = trxId || referenceId;
  const { rows } = await pool.query(
    `UPDATE orders
        SET status=COALESCE($2,status),
            payment=CASE WHEN $3::jsonb IS NULL THEN payment ELSE COALESCE(payment,'{}'::jsonb) || $3::jsonb END,
            webhook=CASE WHEN $4::jsonb IS NULL THEN webhook ELSE $4::jsonb END,
            updated_at=NOW()
      WHERE ${where}
      RETURNING *`,
    [value, status || null, payment ? JSON.stringify(payment) : null, webhook ? JSON.stringify(webhook) : null]
  );
  return rows[0] ? dbToOrder(rows[0]) : null;
}

function dbToOrder(r) {
  return {
    referenceId: r.reference_id,
    trx_id: r.trx_id,
    productId: r.product_id,
    productName: r.product_name,
    amount: Number(r.amount),
    customer: r.customer,
    channelCode: r.channel_code,
    channelName: r.channel_name,
    status: r.status,
    payment: r.payment,
    webhook: r.webhook,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function makeReference() {
  return `LA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function pick(obj, keys) {
  for (const key of keys) {
    const parts = key.split(".");
    let value = obj;
    for (const p of parts) value = value?.[p];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function normalizePaymentResponse(raw) {
  const d = raw?.data || raw?.result || raw;
  return {
    trx_id: pick(d, ["trx_id", "transaction_id", "id"]),
    pay_url: pick(d, ["pay_url", "payment_url", "checkout_url", "redirect_url"]),
    qr_string: pick(d, ["qr_string", "qr", "qr_code"]),
    va_number: pick(d, ["va_number", "va", "virtual_account", "payment_code"]),
    status: String(pick(d, ["status", "payment_status"]) || "pending").toLowerCase(),
    raw
  };
}

async function paymenkuFetch(endpoint, options = {}) {
  const base = process.env.PAYMENKU_BASE_URL || "https://api.paymenku.com";
  if (!process.env.PAYMENKU_API_KEY) {
    throw new Error("PAYMENKU_API_KEY belum diisi.");
  }

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PAYMENKU_API_KEY}`,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }

  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Paymenku HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

/*
  rawBody is retained for HMAC verification.
  JSON parsing still happens normally.
*/
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = Buffer.from(buf); }
}));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "lisa-anatasha-store", time: new Date().toISOString() });
});

app.get("/api/config", (req, res) => {
  res.json({ storeName: process.env.STORE_NAME || "Lisa Anatasha", channels: CHANNELS });
});

app.post("/api/payment/create", async (req, res) => {
  try {
    const { productId, productName, amount, name, email, whatsapp, channelCode } = req.body;
    const numericAmount = Number(amount);

    if (!productId || !productName || !Number.isInteger(numericAmount) || numericAmount < 1000)
      return res.status(400).json({ error: "Data produk atau nominal pembayaran tidak valid." });
    if (!name || !email || !whatsapp)
      return res.status(400).json({ error: "Nama, email, dan WhatsApp wajib diisi." });
    if (!CHANNELS[channelCode])
      return res.status(400).json({ error: "Metode pembayaran tidak tersedia." });

    const referenceId = makeReference();
const payload = {
  channel_code: channelCode,
  amount: numericAmount,
  reference_id: referenceId,
  customer_name: name,
  customer_email: email,
  customer_phone: whatsapp,
  return_url: `${process.env.APP_URL || "https://lisa-anatasha.vercel.app"}/payment/success`
};
    const raw = await paymenkuFetch("/v1/transaction/create", {
      method: "POST",
      headers: { "Idempotency-Key": referenceId },
      body: JSON.stringify(payload)
    });

    const payment = normalizePaymentResponse(raw);
    const order = {
      referenceId,
      trx_id: payment.trx_id,
      productId,
      productName,
      amount: numericAmount,
      customer: { name, email, whatsapp },
      channelCode,
      channelName: CHANNELS[channelCode].name,
      createdAt: new Date().toISOString(),
      status: payment.status || "pending",
      payment
    };

    await saveOrder(order);

    res.json({
      ok: true,
      referenceId,
      order,
      payment: {
        trx_id: payment.trx_id,
        pay_url: payment.pay_url,
        qr_string: payment.qr_string,
        va_number: payment.va_number,
        status: payment.status
      }
    });
  } catch (error) {
    console.error("CREATE PAYMENT:", {
      message: error.message,
      status: error.status,
      body: error.body
    });

    res.status(error.status || 500).json({
      error: error.message || "Gagal membuat transaksi.",
      paymenku: error.body || null
    });
}
});

app.get("/api/payment/status/:trxId", async (req, res) => {
  try {
    const raw = await paymenkuFetch(`/v1/transaction/${encodeURIComponent(req.params.trxId)}`);
    const payment = normalizePaymentResponse(raw);
    const order = await updateOrderByIds({
      trxId: req.params.trxId,
      status: payment.status,
      payment
    });
    res.json({ ok: true, ...payment, referenceId: order?.referenceId || null });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Gagal mengecek status." });
  }
});

app.get("/api/order/:referenceId", async (req, res) => {
  const order = await findOrder(req.params.referenceId);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
  res.json({ ok: true, order });
});

function verifyWebhook(req) {
  const secret = process.env.PAYMENKU_WEBHOOK_SECRET;
  if (!secret) return true;

  const headerName = process.env.PAYMENKU_WEBHOOK_SIGNATURE_HEADER || "x-paymenku-signature";
  const received = req.get(headerName);
  if (!received || !req.rawBody) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", secret).update(req.rawBody).digest("base64");

  const normalize = v => String(v).replace(/^sha256=/i, "").trim();
  const a = Buffer.from(normalize(received));
  const candidates = [expectedHex, expectedBase64].map(normalize);

  return candidates.some(candidate => {
    const b = Buffer.from(candidate);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

app.post("/api/webhook/paymenku", async (req, res) => {
  try {
    if (!verifyWebhook(req)) return res.status(401).json({ error: "Invalid webhook signature" });

    const payload = req.body || {};
    const trxId = pick(payload, ["trx_id", "transaction_id", "data.trx_id"]);
    const referenceId = pick(payload, ["reference_id", "data.reference_id"]);
    const status = String(pick(payload, ["status", "payment_status", "data.status"]) || "").toLowerCase();

    await updateOrderByIds({
      trxId,
      referenceId,
      status: status || undefined,
      webhook: payload
    });

    res.json({ received: true });
  } catch (error) {
    console.error("WEBHOOK:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function boot() {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lisa Anatasha Store listening on ${PORT}`);
    console.log(`Database: ${pool ? "PostgreSQL" : "local JSON fallback"}`);
  });
}

let dbReady = Promise.resolve();

if (process.env.VERCEL) {
  dbReady = initDb().catch(err => {
    console.error("DATABASE INIT ERROR:", err);
    throw err;
  });

  module.exports = async (req, res) => {
    try {
      await dbReady;
      return app(req, res);
    } catch (error) {
      console.error("DATABASE INIT FAILED:", error);
      return res.status(500).json({
        error: "Database initialization failed"
      });
    }
  };
} else {
  boot().catch(err => {
    console.error("BOOT ERROR:", err);
    process.exit(1);
  });
}