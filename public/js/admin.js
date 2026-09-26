// Studio admin: orders, designs & photos, prices & fees, customers, settings.
(function () {
  const { $, $$, api, toast, rupee, esc } = window.NBJ;
  const root = $('#root');
  const A = { tab: 'orders', orders: [], products: [], customers: [], settings: {}, ofilter: 'open', edit: null };
  const STATUSES = ['new', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];
  const TAGS = ['bestseller', 'new', 'bridal', 'festive', 'party', 'everyday'];
  const SHAPES = ['Almond', 'Coffin', 'Square', 'Oval', 'Stiletto'];
  const LENGTHS = ['Short', 'Medium', 'Long'];
  const FINISHES = ['Glossy', 'Matte', 'Chrome', 'Glitter', 'Cat-eye', 'Velvet'];
  const PATTERNS = ['solid', 'french', 'ombre', 'chrome', 'glitter', 'floral', 'marble', 'cateye', 'multi'];

  async function start() {
    try { await api('/api/admin/me'); } catch { return renderLogin(); }
    $('#logout').hidden = false;
    await loadAll();
    render();
  }
  async function loadAll() {
    [A.orders, A.products, A.customers, A.settings] = await Promise.all([
      api('/api/admin/orders'), api('/api/admin/products'), api('/api/admin/customers'), api('/api/admin/settings')]);
  }

  // ---------- login ----------
  function renderLogin() {
    root.innerHTML = `<form class="panel form login" id="loginForm" novalidate>
      <p class="eyebrow">Studio admin</p><h1 style="font-size:36px">Log in</h1>
      <label>Username<input id="lUser" autocomplete="username" autocapitalize="none" required></label>
      <label>Password<input id="lPass" type="password" autocomplete="current-password" required></label>
      <p class="errors" id="lErr" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Log in</button></form>`;
    $('#lUser').focus();
  }

  // ---------- shell ----------
  function render() {
    const open = A.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const month = new Date().toISOString().slice(0, 7);
    const monthSales = A.orders.filter((o) => o.createdAt.startsWith(month) && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    root.innerHTML = `<p class="eyebrow">Studio admin</p><h1>Hello, Jazz</h1>
      <div class="stats">
        <div class="stat"><b>${A.orders.filter((o) => o.status === 'new').length}</b><span>new orders to confirm</span></div>
        <div class="stat" style="animation-delay:60ms"><b>${open.length}</b><span>open orders</span></div>
        <div class="stat" style="animation-delay:120ms"><b>${rupee(monthSales)}</b><span>orders this month</span></div>
        <div class="stat" style="animation-delay:180ms"><b>${A.customers.length}</b><span>customer accounts</span></div>
      </div>
      <div class="tabbar" role="tablist">
        ${[['orders', 'Orders'], ['designs', 'Designs & photos'], ['prices', 'Prices & fees'], ['customers', 'Customers'], ['settings', 'Settings']]
          .map(([k, l]) => `<button class="chip" type="button" data-tab="${k}" aria-pressed="${A.tab === k}">${l}</button>`).join('')}
      </div>
      <div id="tab"></div>`;
    renderTab();
  }
  function renderTab() {
    ({ orders: renderOrders, designs: A.edit ? renderEditor : renderDesigns, prices: renderPrices, customers: renderCustomers, settings: renderSettings })[A.tab]();
  }

  // ---------- orders ----------
  function renderOrders() {
    const filters = [['open', 'Open'], ['new', 'New'], ['confirmed', 'Confirmed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']];
    const list = A.orders.filter((o) => A.ofilter === 'all' || (A.ofilter === 'open' ? !['delivered', 'cancelled'].includes(o.status) : o.status === A.ofilter));
    const waNum = (p) => (String(p).length === 10 ? '91' + p : p);
    $('#tab').innerHTML = `<div class="chips" style="margin-bottom:14px">${filters.map(([k, l]) => `<button class="chip" type="button" data-ofilter="${k}" aria-pressed="${A.ofilter === k}">${l}</button>`).join('')}</div>
      <div class="olist">${list.length ? list.map((o, i) => `<article class="ocard" style="animation-delay:${Math.min(i, 8) * 40}ms">
        <div><h4 class="order-id" style="display:inline-block">${esc(o.id)}</h4> <span class="status ${esc(o.status)}">${esc(o.status)}</span>
          <p class="fine" style="margin-top:6px">${new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${o.userId ? ' · account' : ' · guest'}</p>
          <p style="margin-top:8px"><b>${esc(o.customer.name)}</b></p>
          <p class="fine"><a href="https://wa.me/${esc(waNum(o.customer.phone))}" target="_blank" rel="noopener">WhatsApp +91 ${esc(o.customer.phone)}</a></p>
          <p class="fine">${esc(o.customer.address)}, ${esc(o.customer.city)}${o.customer.state ? ', ' + esc(o.customer.state) : ''} – ${esc(o.customer.pincode)}</p>
          ${o.notes ? `<p class="fine"><i>“${esc(o.notes)}”</i></p>` : ''}</div>
        <div class="items">${o.items.map((it) => `<div><b>${esc(it.name)}</b> × ${it.qty} <span class="num">· ${rupee(it.lineTotal)}</span>
          <small>${esc(it.shape)}, ${esc(it.length)} · ${it.custom ? 'Custom fit' : 'Size ' + esc(it.size)}</small>
          ${it.inspirationLink ? `<small><a href="${esc(it.inspirationLink)}" target="_blank" rel="noopener" style="color:var(--rose)">Open inspiration link ↗</a></small>` : ''}
          ${it.fingerSizes ? `<small>${esc(it.fingerSizes)}</small>` : ''}${it.customNotes ? `<small>“${esc(it.customNotes)}”</small>` : ''}</div>`).join('')}
          <div class="sum" style="margin-top:4px"><div><span>Shipping</span><span>${rupee(o.shipping)}</span></div><div class="total"><span>Total</span><span>${rupee(o.total)}</span></div></div></div>
        <div class="ctl">
          <label>Order status<select data-order="${esc(o.id)}" data-field="status">${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Payment (${esc(o.paymentMethod)})<select data-order="${esc(o.id)}" data-field="paymentStatus">${['pending', 'paid', 'refunded'].map((s) => `<option ${s === o.paymentStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Courier &amp; tracking no.<input data-order="${esc(o.id)}" data-field="tracking" value="${esc(o.tracking)}" placeholder="e.g. Delhivery 1234567890"></label>
          <p class="fine">Customers with an account see status and tracking in their profile.</p>
        </div></article>`).join('') : '<p class="empty">No orders here yet.</p>'}</div>`;
  }

  // ---------- designs ----------
  function renderDesigns() {
    $('#tab').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <p class="muted">${A.products.length} designs. Tap a design to edit its details, price and photos.</p>
        <button class="btn btn-primary" type="button" data-new>+ Add a design</button></div>
      <div class="dlist">${A.products.map((p, i) => `<div class="dcard" style="animation-delay:${Math.min(i, 10) * 30}ms">
        <div class="pic">${NailArt.productArt(p)}${(p.images || []).length ? `<span class="photo-count">${p.images.length} photo${p.images.length > 1 ? 's' : ''}</span>` : '<span class="photo-count" style="background:var(--muted)">No photos yet</span>'}</div>
        <div class="body"><b>${esc(p.name)}</b><span class="fine">${esc(p.shape)} · ${esc(p.length)} · ${rupee(p.price)} ${p.inStock === false ? '<span class="hidden-tag">Hidden</span>' : ''}</span>
          <div class="row"><button class="btn btn-ghost btn-sm" type="button" data-edit="${esc(p.id)}" style="flex:1">Edit &amp; photos</button><button class="btn btn-ghost btn-sm" type="button" data-del="${esc(p.id)}">Delete</button></div></div></div>`).join('')}</div>`;
  }

  function renderEditor() {
    const p = A.edit;
    $('#tab').innerHTML = `<form class="panel" id="editor" novalidate>
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><h2 style="font-size:30px">${p.id ? 'Edit ' + esc(p.name) : 'New design'}</h2><button class="btn btn-ghost btn-sm" type="button" data-cancel>← Back to designs</button></div>
      <h3 style="font-size:20px;margin-bottom:8px">Photos</h3>
      <p class="fine" style="margin-bottom:10px">Add as many as you like. The first photo is the cover. Photos are resized automatically, so you can upload straight from your phone.</p>
      <div class="photos" id="photos"></div>
      <div class="progress" id="prog" hidden style="margin-top:10px"><span style="width:0"></span></div>
      <input type="file" id="fileIn" accept="image/*" multiple hidden>
      <h3 style="font-size:20px;margin-block:22px 10px">Details</h3>
      <div class="editor">
        <label>Design name<input id="eName" value="${esc(p.name)}" required></label>
        <label>Price (₹)<input id="ePrice" type="number" inputmode="numeric" min="50" step="10" value="${p.price}"></label>
        <label>Shape<select id="eShape">${SHAPES.map((s) => `<option ${s === p.shape ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>Length<select id="eLength">${LENGTHS.map((s) => `<option ${s === p.length ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>Finish<select id="eFinish">${FINISHES.map((s) => `<option ${s === p.finish ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="wide">Description<textarea id="eDesc" rows="3">${esc(p.description)}</textarea></label>
        <div class="wide"><p class="fine" style="margin-bottom:6px">Collections</p><div class="tagpick">${TAGS.map((t) => `<label><input type="checkbox" value="${t}" ${(p.tags || []).includes(t) ? 'checked' : ''}>${t}</label>`).join('')}</div></div>
        <label class="wide" style="display:flex;gap:10px;align-items:center;color:var(--ink)"><input id="eStock" type="checkbox" ${p.inStock !== false ? 'checked' : ''} style="width:auto;accent-color:var(--rose)"> Show this design in the shop</label>
      </div>
      <details style="margin-top:16px"><summary class="fine">Drawing used when there are no photos</summary>
        <div class="editor" style="margin-top:10px">
          <label>Pattern<select id="ePattern">${PATTERNS.map((s) => `<option ${s === p.pattern ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Main colour<input id="eC0" type="color" value="${esc((p.colors || [])[0] || '#F7B6CB')}"></label>
          <label>Accent colour<input id="eC1" type="color" value="${esc((p.colors || [])[1] || '#FFFFFF')}"></label>
        </div></details>
      <p class="errors" id="eErr" style="margin-top:12px"></p>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-primary" type="submit" id="eSave">${p.id ? 'Save changes' : 'Add design'}</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div>
    </form>`;
    renderPhotos();
  }
  function renderPhotos() {
    const imgs = A.edit.images;
    $('#photos').innerHTML = imgs.map((u, i) => `<div class="ph ${i === 0 ? 'cover' : ''}">${i === 0 ? '<div class="cover-lbl">Cover</div>' : ''}<img src="${esc(u)}" alt="Photo ${i + 1}">
      <div class="tools"><button type="button" data-mv="${i}" data-dir="-1" aria-label="Move left" ${i === 0 ? 'disabled' : ''}>◀</button>${i ? `<button type="button" data-cover="${i}" aria-label="Make cover">★</button>` : ''}<button type="button" data-rm="${i}" aria-label="Remove photo">✕</button><button type="button" data-mv="${i}" data-dir="1" aria-label="Move right" ${i === imgs.length - 1 ? 'disabled' : ''}>▶</button></div></div>`).join('')
      + `<button type="button" class="drop" id="drop">+ Add photos<br><span class="fine">tap or drop</span></button>`;
  }

  // shrink photos in the browser before upload (max 1400px, JPEG)
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1400, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => reject(new Error(`${file.name} isn't a photo we can read.`));
      img.src = url;
    });
  }
  async function upload(files) {
    files = [...files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const bar = $('#prog'); bar.hidden = false;
    let done = 0;
    for (const f of files) {
      try {
        const dataUrl = await shrink(f);
        const { url } = await api('/api/admin/images', { method: 'POST', body: { dataUrl } });
        A.edit.images.push(url); renderPhotos();
      } catch (err) { toast(err.message); }
      done++; bar.firstElementChild.style.width = `${(done / files.length) * 100}%`;
    }
    setTimeout(() => { bar.hidden = true; bar.firstElementChild.style.width = 0; }, 600);
    toast(`${done} photo${done > 1 ? 's' : ''} added. Remember to save.`);
  }

  async function saveDesign(e) {
    e.preventDefault();
    const p = A.edit;
    const body = {
      name: $('#eName').value.trim(), price: Number($('#ePrice').value), shape: $('#eShape').value, length: $('#eLength').value,
      finish: $('#eFinish').value, description: $('#eDesc').value.trim(), inStock: $('#eStock').checked,
      tags: $$('.tagpick input:checked').map((x) => x.value), pattern: $('#ePattern').value, colors: [$('#eC0').value, $('#eC1').value], images: p.images,
    };
    if (!body.name) { $('#eErr').textContent = 'Give the design a name.'; return; }
    if (!(body.price > 0)) { $('#eErr').textContent = 'Enter a price.'; return; }
    $('#eSave').disabled = true;
    try {
      const saved = p.id ? await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'PUT', body }) : await api('/api/admin/products', { method: 'POST', body });
      A.products = p.id ? A.products.map((x) => (x.id === saved.id ? saved : x)) : [...A.products, saved];
      for (const id of p.removed) api(`/api/admin/images/${id}`, { method: 'DELETE' }).catch(() => {});
      A.edit = null; toast('Design saved'); renderTab();
    } catch (err) { $('#eErr').textContent = err.message; $('#eSave').disabled = false; }
  }

  // ---------- prices ----------
  function renderPrices() {
    const s = A.settings;
    $('#tab').innerHTML = `<div style="display:grid;gap:16px">
      <form class="panel form" id="feeForm"><h2 style="font-size:28px">Fees</h2>
        <div class="fees">
          <label>Custom fit &amp; design fee (₹)<input id="fCustom" type="number" min="0" step="10" value="${s.customizationFee}"></label>
          <label>Shipping, pan-India (₹)<input id="fShip" type="number" min="0" step="1" value="${s.shippingFee}"></label>
          <label>"Recreate a design" base price (₹)<input id="fRecreate" type="number" min="0" step="10" value="${s.recreateBasePrice}"></label>
        </div>
        <p class="fine">Customers pay the recreate base price + the custom fee = <b>${rupee(s.recreateBasePrice + s.customizationFee)}</b> for a recreated design.</p>
        <div><button class="btn btn-primary" type="submit">Save fees</button></div></form>

      <form class="panel form" id="bulkForm"><h2 style="font-size:28px">Change many prices at once</h2>
        <div class="fees">
          <label>Designs<select id="bScope"><option value="">All designs</option>${TAGS.map((t) => `<option value="${t}">Only "${t}"</option>`).join('')}</select></label>
          <label>How<select id="bMode"><option value="add">Add / subtract ₹</option><option value="percent">Change by %</option><option value="set">Set every price to ₹</option></select></label>
          <label>Amount<input id="bVal" type="number" step="1" placeholder="e.g. 50 or -50"></label>
        </div>
        <p class="fine">Prices are rounded to the nearest ₹10.</p>
        <p class="notice" id="bConfirm" hidden></p>
        <div><button class="btn btn-ghost" type="submit" id="bBtn">Preview change</button></div></form>

      <form class="panel" id="priceForm"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h2 style="font-size:28px">Price list</h2><button class="btn btn-primary" type="submit" id="pSave" disabled>Save prices</button></div>
        <div class="table-scroll"><table class="ptable"><thead><tr><th>Design</th><th>Price (₹)</th><th>With custom fit</th></tr></thead><tbody>
        ${A.products.map((p) => `<tr><td>${esc(p.name)}${p.inStock === false ? ' <span class="hidden-tag">Hidden</span>' : ''}</td><td><input type="number" min="50" step="10" data-price="${esc(p.id)}" value="${p.price}" aria-label="Price for ${esc(p.name)}"></td><td class="num">${rupee(p.price + s.customizationFee)}</td></tr>`).join('')}
        </tbody></table></div></form></div>`;
  }

  // ---------- customers ----------
  function renderCustomers() {
    $('#tab').innerHTML = `<div class="panel"><div class="table-scroll" style="border:0"><table style="min-width:640px"><thead><tr><th>Name</th><th>Mobile</th><th>City</th><th>Orders</th><th>Spent</th><th>Joined</th></tr></thead><tbody>
      ${A.customers.length ? A.customers.map((c) => `<tr><td>${esc(c.name)}${c.email ? `<small>${esc(c.email)}</small>` : ''}</td><td><a href="https://wa.me/91${esc(c.phone)}" target="_blank" rel="noopener" style="color:var(--rose)">+91 ${esc(c.phone)}</a></td><td>${esc(c.city) || '—'}</td><td>${c.orders}</td><td class="num">${rupee(c.spent)}</td><td>${new Date(c.createdAt).toLocaleDateString('en-IN')}</td></tr>`).join('') : '<tr><td colspan="6">No customer accounts yet.</td></tr>'}
      </tbody></table></div></div>`;
  }

  // ---------- settings ----------
  function renderSettings() {
    const s = A.settings;
    $('#tab').innerHTML = `<form class="panel form" id="setForm" style="max-width:640px"><h2 style="font-size:28px">Shop settings</h2>
      <label>WhatsApp number for orders (with 91)<input id="sWa" inputmode="numeric" value="${esc(s.whatsappNumber)}"></label>
      <label>Instagram username<input id="sInsta" value="${esc(s.instagram)}"></label>
      <label>Delivery time (days)<input id="sDays" value="${esc(s.deliveryDays)}" placeholder="5–6"></label>
      <label>Announcement bar text<input id="sAnn" value="${esc(s.announcement)}" maxlength="160"></label>
      <label>Pinterest picks: paste one pin link per line (up to 40). They appear on the homepage with a "Recreate this for me" button.
        <textarea id="sPins" rows="8" placeholder="https://in.pinterest.com/pin/1234567890/">${esc((s.pinterestPins || []).join('\n'))}</textarea></label>
      <p class="fine">Open a pin on Pinterest, copy the link from the address bar (it contains /pin/) and paste it here.</p>
      <div><button class="btn btn-primary" type="submit">Save settings</button></div></form>`;
  }

  async function saveSettings(patch, msg) {
    try { A.settings = await api('/api/admin/settings', { method: 'PUT', body: { ...A.settings, ...patch } }); toast(msg); renderTab(); }
    catch (err) { toast(err.message); }
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.tab) { A.tab = d.tab; A.edit = null; $$('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderTab(); }
    else if (d.ofilter) { A.ofilter = d.ofilter; renderOrders(); }
    else if ('new' in d) { A.edit = { name: '', price: 700, shape: 'Almond', length: 'Medium', finish: 'Glossy', description: '', tags: ['new'], inStock: true, pattern: 'solid', colors: ['#F7B6CB', '#FFFFFF'], images: [], removed: [] }; renderTab(); scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (d.edit) { const p = A.products.find((x) => x.id === d.edit); A.edit = { ...p, images: [...(p.images || [])], removed: [] }; renderTab(); scrollTo({ top: 0, behavior: 'smooth' }); }
    else if ('cancel' in d) { A.edit = null; renderTab(); }
    else if (d.del) {
      if (d.sure !== 'yes') { d.sure = 'yes'; b.textContent = 'Tap again'; setTimeout(() => { if (b.isConnected) { d.sure = ''; b.textContent = 'Delete'; } }, 3000); return; }
      try { await api(`/api/admin/products/${encodeURIComponent(d.del)}`, { method: 'DELETE' }); A.products = A.products.filter((p) => p.id !== d.del); toast('Design deleted'); renderDesigns(); }
      catch (err) { toast(err.message); }
    }
    else if (b.id === 'drop') $('#fileIn').click();
    else if (d.rm !== undefined) { const [u] = A.edit.images.splice(Number(d.rm), 1); const m = /^\/img\/([a-f0-9]+)$/.exec(u); if (m) A.edit.removed.push(m[1]); renderPhotos(); }
    else if (d.cover !== undefined) { const [u] = A.edit.images.splice(Number(d.cover), 1); A.edit.images.unshift(u); renderPhotos(); }
    else if (d.mv !== undefined) { const i = Number(d.mv), j = i + Number(d.dir), a = A.edit.images; if (j >= 0 && j < a.length) { [a[i], a[j]] = [a[j], a[i]]; renderPhotos(); } }
    else if (b.id === 'logout') { await api('/api/admin/logout', { method: 'POST' }); location.reload(); }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'fileIn') { await upload(t.files); t.value = ''; return; }
    if (t.dataset.order) {
      try { const o = await api(`/api/admin/orders/${encodeURIComponent(t.dataset.order)}`, { method: 'PATCH', body: { [t.dataset.field]: t.value } });
        A.orders = A.orders.map((x) => (x.id === o.id ? o : x)); toast('Order updated'); if (t.dataset.field === 'status') renderOrders(); }
      catch (err) { toast(err.message); }
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.price) { const p = A.products.find((x) => x.id === t.dataset.price); t.classList.toggle('changed', Number(t.value) !== p.price); $('#pSave').disabled = !$$('[data-price].changed').length; }
    if (['bScope', 'bMode', 'bVal'].includes(t.id)) { $('#bConfirm').hidden = true; $('#bBtn').textContent = 'Preview change'; }
  });
  document.addEventListener('dragover', (e) => { if (e.target.closest('#drop')) { e.preventDefault(); $('#drop').classList.add('over'); } });
  document.addEventListener('dragleave', (e) => { if (e.target.closest('#drop')) $('#drop').classList.remove('over'); });
  document.addEventListener('drop', (e) => { if (e.target.closest('#drop')) { e.preventDefault(); $('#drop').classList.remove('over'); upload(e.dataTransfer.files); } });

  document.addEventListener('submit', async (e) => {
    const f = e.target; e.preventDefault();
    if (f.id === 'loginForm') {
      try { await api('/api/admin/login', { method: 'POST', body: { username: $('#lUser').value, password: $('#lPass').value } }); start(); }
      catch (err) { $('#lErr').textContent = err.message; }
    }
    if (f.id === 'editor') saveDesign(e);
    if (f.id === 'feeForm') saveSettings({ customizationFee: Number($('#fCustom').value), shippingFee: Number($('#fShip').value), recreateBasePrice: Number($('#fRecreate').value) }, 'Fees saved');
    if (f.id === 'setForm') saveSettings({ whatsappNumber: $('#sWa').value, instagram: $('#sInsta').value, deliveryDays: $('#sDays').value, announcement: $('#sAnn').value, pinterestPins: $('#sPins').value.split(/\s+/).filter(Boolean) }, 'Settings saved');
    if (f.id === 'priceForm') {
      const changed = $$('[data-price].changed');
      try {
        for (const inp of changed) {
          const saved = await api(`/api/admin/products/${encodeURIComponent(inp.dataset.price)}`, { method: 'PUT', body: { price: Number(inp.value) } });
          A.products = A.products.map((x) => (x.id === saved.id ? saved : x));
        }
        toast(`${changed.length} price${changed.length > 1 ? 's' : ''} saved`); renderPrices();
      } catch (err) { toast(err.message); }
    }
    if (f.id === 'bulkForm') {
      const scope = $('#bScope').value, mode = $('#bMode').value, value = Number($('#bVal').value);
      if (!$('#bVal').value || !Number.isFinite(value)) { toast('Enter an amount'); return; }
      const ids = A.products.filter((p) => !scope || (p.tags || []).includes(scope)).map((p) => p.id);
      if (!ids.length) { toast('No designs are in that collection.'); return; }
      const calc = (p) => Math.max(50, Math.round((mode === 'set' ? value : mode === 'add' ? p.price + value : p.price * (1 + value / 100)) / 10) * 10);
      const box = $('#bConfirm');
      if (box.hidden) {
        const sample = A.products.filter((p) => ids.includes(p.id)).slice(0, 3).map((p) => `${esc(p.name)} ${rupee(p.price)} → <b>${rupee(calc(p))}</b>`).join(', ');
        box.innerHTML = `This changes <b>${ids.length}</b> design${ids.length === 1 ? '' : 's'}. For example: ${sample}${ids.length > 3 ? '…' : ''}`;
        box.hidden = false; $('#bBtn').textContent = `Apply to ${ids.length} designs`; return;
      }
      try { const r = await api('/api/admin/prices', { method: 'POST', body: { ids, mode, value } }); A.products = await api('/api/admin/products'); toast(`${r.changed} prices updated`); renderPrices(); }
      catch (err) { toast(err.message); }
    }
  });

  start();
})();
