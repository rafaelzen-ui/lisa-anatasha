const PRODUCTS = [
  {id:"try-me", name:"Try Me", price:39000, tag:"New Drop", sold:659, description:"Paket perkenalan dengan koleksi foto eksklusif berkualitas tinggi. Cocok untuk yang baru pertama kali.", items:["Set foto eksklusif","Akses download instan"]},
  {id:"try-me-again", name:"Try Me Again", price:49000, tag:"New Drop", sold:482, description:"Koleksi lanjutan dengan lebih banyak konten premium dan akses download.", items:["Set foto & video eksklusif","Akses download instan"]},
  {id:"after-hours", name:"After Hours", price:69000, tag:"Best Seller", sold:821, description:"Koleksi pilihan dengan nuansa elegan dan eksklusif.", items:["Premium photo set","Video eksklusif","Akses download"]},
  {id:"private-set", name:"Private Set", price:89000, tag:"Premium", sold:317, description:"Paket premium untuk kolektor yang menginginkan koleksi lebih lengkap.", items:["Premium photo set","Video collection","Akses download"]},
  {id:"signature", name:"Signature Collection", price:129000, tag:"Premium", sold:196, description:"Koleksi signature dengan jumlah file lebih banyak.", items:["Full photo set","Exclusive video","Bonus collection"]},
  {id:"complete", name:"Complete Collection", price:199000, tag:"Limited", sold:94, description:"Paket lengkap untuk akses ke koleksi pilihan Lisa Anatasha.", items:["Multiple photo sets","Video collection","Bonus set","Priority support"]}
];

const channels = [
  ["bnc_va","Bank Neo Virtual Account"],["bni_va","BNI Virtual Account"],
  ["bri_va","BRI Virtual Account"],["btn_va","BTN Virtual Account"],
  ["cimb_va","CIMB Virtual Account"],["maybank_va","Maybank Virtual Account"],
  ["muamalat_va","Muamalat Virtual Account"],["permata_va","Permata Virtual Account"],
  ["dana","DANA"],["linkaja","LinkAja"],["qris","QRIS"]
];

let currentProduct = null;
let currentPayment = null;

const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);

function show(view) {
  ["homeView","detailView","checkoutView","successView"].forEach(id => $(id).classList.add("hidden"));
  $(view).classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

function scrollToProducts(){ $("products").scrollIntoView({behavior:"smooth"}); }

function renderHome(){
  $("productGrid").innerHTML = PRODUCTS.map(p => `
    <article class="card">
      <div class="cover"><span class="badge">✨ ${p.tag}</span></div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <div class="price">${fmt(p.price)}</div>
        <button class="buy" onclick="openDetail('${p.id}')">Beli Sekarang</button>
      </div>
    </article>
  `).join("");
}

function openDetail(id){
  currentProduct = PRODUCTS.find(p=>p.id===id);
  $("detailView").innerHTML = `
    <div class="detail">
      <button class="back" onclick="show('homeView')">‹ &nbsp;Kembali</button>
      <div class="gallery">
        <div class="cover"><span class="badge">✨ ${currentProduct.tag}</span></div>
        <div class="side"></div>
      </div>
      <div class="dots"><b>•</b> •</div>
      <span class="badge" style="position:static;display:inline-block;margin-bottom:8px">${currentProduct.tag}</span>
      <h1>${currentProduct.name}</h1>
      <div class="price">${fmt(currentProduct.price)}</div>
      <div class="sold">🔥 ${currentProduct.sold} orang sudah membeli</div>
      <div class="desc">${currentProduct.description}</div>
      <div class="package"><strong>📸 Isi Paket:</strong><ul>${currentProduct.items.map(x=>`<li>${x}</li>`).join("")}</ul></div>
      <button class="buy big-buy" onclick="openCheckout()">Beli Sekarang</button>
      <div class="trust">🔒 Aman &nbsp; | &nbsp; ⚡ Instant &nbsp; | &nbsp; 💬 Support &nbsp; | &nbsp; ✅ Garansi</div>
    </div>`;
  show("detailView");
}

function openCheckout(){
  $("checkoutView").innerHTML = `
    <div class="checkout">
      <button class="back" onclick="openDetail('${currentProduct.id}')">‹ &nbsp;Kembali</button>
      <div class="checkout-card">
        <div class="order-head">
          <div class="thumb"></div>
          <div><h3>${currentProduct.name}</h3><strong>${fmt(currentProduct.price)}</strong></div>
        </div>
        <h2 class="form-title">Detail Pemesanan</h2>
        <div class="helper">Lengkapi data untuk melanjutkan pembayaran</div>
        <label>Nama Lengkap</label>
        <input id="name" placeholder="Masukkan nama Anda" autocomplete="name">
        <label>Email</label>
        <input id="email" type="email" placeholder="email@contoh.com" autocomplete="email">
        <div class="field-note">📩 Link download akan dikirim ke email ini. Cek juga folder Spam.</div>
        <div class="field-note">⚠️ Kesalahan penulisan email bukan tanggung jawab kami.</div>
        <label>Nomor WhatsApp</label>
        <input id="whatsapp" placeholder="081234567890" autocomplete="tel">
        <label>Metode Pembayaran</label>
        <select id="channel">
          <option value="">-- Pilih Metode --</option>
          <optgroup label="Virtual Account">
            ${channels.filter(x=>x[0].endsWith("_va")).map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("")}
          </optgroup>
          <optgroup label="E-Wallet">
            ${channels.filter(x=>["dana","linkaja"].includes(x[0])).map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("")}
          </optgroup>
          <optgroup label="QRIS">
            <option value="qris">QRIS</option>
          </optgroup>
        </select>
        <button id="payBtn" class="buy pay" onclick="createPayment()">🔒 Bayar ${fmt(currentProduct.price)}</button>
        <div class="field-note" style="text-align:center;margin-top:12px">Sudah pernah beli? <a href="#" onclick="event.preventDefault();checkExistingOrder()">Cek Pesanan &amp; Download</a></div>
      </div>
      <div class="trust" style="margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <span>🔒 Pembayaran Aman</span><span>⚡ Instant Download</span><span>💬 Support 24 Jam</span><span>✅ Garansi Akses</span>
      </div>
    </div>`;
  show("checkoutView");
}

async function createPayment(){
  const name = $("name").value.trim();
  const email = $("email").value.trim();
  const whatsapp = $("whatsapp").value.trim();
  const channelCode = $("channel").value;
  if(!name || !email || !whatsapp || !channelCode){
    alert("Lengkapi nama, email, WhatsApp, dan metode pembayaran.");
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    alert("Format email tidak valid."); return;
  }

  const btn = $("payBtn");
  btn.disabled = true;
  btn.textContent = "Memproses pembayaran...";

  try{
    const r = await fetch("/api/payment/create",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        productId:currentProduct.id, productName:currentProduct.name,
        amount:currentProduct.price, name,email,whatsapp,channelCode
      })
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || "Gagal membuat transaksi");
    currentPayment = data;
    renderPayment(data);
  }catch(e){
    alert(e.message);
    btn.disabled=false;
    btn.textContent=`🔒 Bayar ${fmt(currentProduct.price)}`;
  }
}

function renderPayment(data){
  const p = data.payment || {};
  const channelName = channels.find(x=>x[0]===data.order.channelCode)?.[1] || data.order.channelCode;
  const isVA = data.order.channelCode.endsWith("_va");
  const isQRIS = data.order.channelCode==="qris";

  $("successView").innerHTML = `
    <div class="success detail">
      <button class="back" onclick="show('homeView')">‹ &nbsp;Beranda</button>
      <div class="payment-box">
        <div class="icon">${isQRIS ? "▦" : isVA ? "🏦" : "💳"}</div>
        <span class="status" id="statusPill">${data.order.status || "pending"}</span>
        <h2>Menunggu Pembayaran</h2>
        <p>Pesanan <b>${data.referenceId}</b><br>${channelName} · ${fmt(data.order.amount)}</p>
        ${p.va_number ? `<div class="va">${p.va_number}</div><button class="copy" onclick="navigator.clipboard.writeText('${p.va_number}')">Salin Nomor VA</button>` : ""}
        ${p.qr_string ? `<div class="notice">QRIS berhasil dibuat oleh Paymenku. Jika response Paymenku menyediakan URL QR, tombol/QR dapat ditampilkan di sini.</div>` : ""}
        ${p.pay_url ? `<a class="pay-url" href="${p.pay_url}" target="_blank" rel="noopener">Buka Halaman Pembayaran</a>` : ""}
        <div class="notice">Jangan tutup halaman ini sebelum pembayaran selesai. Status akan diperbarui otomatis.</div>
      </div>
    </div>`;
  show("successView");
  if(data.payment?.trx_id) pollStatus(data.payment.trx_id);
}

async function pollStatus(trxId){
  let count=0;
  const timer=setInterval(async()=>{
    count++;
    try{
      const r=await fetch(`/api/payment/status/${encodeURIComponent(trxId)}`);
      const d=await r.json();
      if(!r.ok) return;
      const status=String(d.status||"pending").toLowerCase();
      const pill=$("statusPill");
      if(pill) pill.textContent=status;
      if(["paid","success","settled","completed"].includes(status)){
        clearInterval(timer);
        setTimeout(()=>renderPaid(d),250);
      }
    }catch{}
    if(count>=60) clearInterval(timer);
  },5000);
}

function renderPaid(data){
  $("successView").innerHTML=`
    <div class="success detail">
      <div class="payment-box">
        <div class="icon">✅</div>
        <span class="status">PAID</span>
        <h2>Pembayaran Berhasil!</h2>
        <p>Pesanan kamu sudah terkonfirmasi.</p>
        <button class="buy big-buy" onclick="show('homeView')">Kembali ke Koleksi</button>
        <div class="notice">Integrasikan delivery file digital di server Anda pada tahap berikutnya agar link download otomatis dikirim setelah status PAID.</div>
      </div>
    </div>`;
}

async function checkExistingOrder(){
  const ref=prompt("Masukkan nomor pesanan / reference ID:");
  if(!ref) return;
  try{
    const r=await fetch(`/api/order/${encodeURIComponent(ref.trim())}`);
    const d=await r.json();
    if(!r.ok) throw new Error(d.error);
    currentPayment={referenceId:d.order.referenceId,order:d.order,payment:d.order.payment};
    renderPayment(currentPayment);
  }catch(e){ alert(e.message || "Pesanan tidak ditemukan."); }
}

renderHome();
