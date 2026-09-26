// Storefront: catalogue, product pop-up, recreate-a-design, cart drawer, checkout.
(function () {
  const { $, $$, api, config, me, cart, toast, rupee, esc, reveal, icons } = window.NBJ;
  const S = { cfg: null, products: [], filter: 'all', shape: '', sort: 'featured', view: 'cart', lastOrder: null };
  const SIZE_MM = { 0: 18, 1: 17, 2: 16, 3: 15, 4: 14, 5: 13, 6: 12, 7: 11, 8: 10, 9: 9 };
  const SETS = { XS: [4, 7, 6, 7, 9], S: [3, 6, 5, 6, 8], M: [2, 5, 4, 5, 7], L: [1, 4, 3, 4, 6] };
  const FILTERS = [['all', 'All'], ['bestseller', 'Bestsellers'], ['bridal', 'Bridal'], ['festive', 'Festive'], ['party', 'Party'], ['everyday', 'Everyday'], ['new', 'New in']];

  const product = (id) => S.products.find((p) => p.id === id);
  const recreatePrice = () => S.cfg.recreateBasePrice + S.cfg.customizationFee;
  function unitPrice(it) {
    if (it.productId === 'recreate') return recreatePrice();
    return (product(it.productId)?.price || 0) + (it.custom ? S.cfg.customizationFee : 0);
  }
  const validItems = () => cart.items().filter((it) => it.productId === 'recreate' || product(it.productId));
  const subtotal = () => validItems().reduce((s, it) => s + unitPrice(it) * it.qty, 0);
  const artFor = (it) => (it.productId === 'recreate'
    ? `<div style="color:var(--rose);width:34px">${icons.brush}</div>`
    : NailArt.productArt(product(it.productId)));

  async function load() {
    try {
      [S.cfg, S.products] = await Promise.all([config(), api('/api/products')]);
    } catch {
      $('#grid').innerHTML = '<p class="empty">We couldn\'t load the designs. Refresh the page to try again.</p>';
      return;
    }
    const prices = S.products.map((p) => p.price);
    if (prices.length) $('#priceRange').textContent = Math.min(...prices) === Math.max(...prices) ? rupee(prices[0]) : `₹${Math.min(...prices)}–${Math.max(...prices)}`;
    renderShowcase(); renderFilters(); renderGrid(); renderSizeTable(); renderRecreate(); renderPins();
    if (location.hash === '#cart') openCart();
  }

  // ---------- hero showcase ----------
  function renderShowcase() {
    const withPhotos = S.products.filter((p) => (p.images || []).length);
    const pick = [...withPhotos, ...S.products.filter((p) => !(p.images || []).length)].slice(0, 3);
    const box = $('#showcase');
    box.querySelectorAll('.polaroid').forEach((n) => n.remove());
    pick.forEach((p, i) => box.insertAdjacentHTML('beforeend',
      `<button type="button" class="polaroid p${i + 1}" data-open="${esc(p.id)}" style="border:0;cursor:pointer;text-align:left"><div class="art">${NailArt.productArt(p)}</div><p>${esc(p.name)} <span>${rupee(p.price)}</span></p></button>`));
  }

  // ---------- catalogue ----------
  function renderFilters() {
    const used = new Set(S.products.flatMap((p) => p.tags || []));
    $('#chips').innerHTML = FILTERS.filter(([k]) => k === 'all' || used.has(k)).map(([k, l]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join('');
    const shapes = [...new Set(S.products.map((p) => p.shape))].sort();
    $('#shapeFilter').innerHTML = '<option value="">All shapes</option>' + shapes.map((s) => `<option ${s === S.shape ? 'selected' : ''}>${esc(s)}</option>`).join('');
  }
  function renderGrid() {
    let list = S.products.filter((p) => (S.filter === 'all' || (p.tags || []).includes(S.filter)) && (!S.shape || p.shape === S.shape));
    if (S.sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (S.sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    $('#grid').innerHTML = list.length ? list.map((p, i) => {
      const tags = p.tags || [];
      const badge = tags.includes('new') ? 'New' : tags.includes('bestseller') ? 'Bestseller' : tags.includes('bridal') ? 'Bridal' : '';
      const imgs = p.images || [];
      const art = imgs.length
        ? `<img class="main" src="${esc(imgs[0])}" alt="${esc(p.name)}" loading="lazy" decoding="async">${imgs[1] ? `<img class="alt" src="${esc(imgs[1])}" alt="" loading="lazy" decoding="async">` : ''}`
        : `<div class="main svgwrap">${NailArt.renderSet(p)}</div>`;
      return `<button class="card reveal" style="--i:${i % 4}" type="button" data-open="${esc(p.id)}" aria-label="${esc(p.name)}, ${rupee(p.price)}">
        <div class="card-art">${badge ? `<span class="badge">${badge}</span>` : ''}${art}${imgs.length > 1 ? `<span class="photo-count">${imgs.length} photos</span>` : ''}</div>
        <div class="card-body"><h3>${esc(p.name)}</h3><p class="card-meta">${esc(p.shape)} · ${esc(p.length)} · ${esc(p.finish)}</p>
        <div class="card-foot"><span class="price">${rupee(p.price)}</span><span class="add">View &amp; add →</span></div></div></button>`;
    }).join('') : '<p class="empty">No designs match these filters. Try another shape or collection.</p>';
    reveal($('#grid'));
  }
  function renderSizeTable() {
    $('#sizeTable').innerHTML = Object.entries(SETS).map(([k, nums]) => `<tr><td>${k}</td>${nums.map((n) => `<td>${SIZE_MM[n]} mm<small>size ${n}</small></td>`).join('')}</tr>`).join('');
  }

  // ---------- pinterest picks (official Pinterest embeds) ----------
  function renderPins() {
    const pins = S.cfg.pinterestPins || [];
    if (!pins.length) return;
    $('#picks').hidden = false;
    $('#pins').innerHTML = pins.map((u, i) => `<div class="pin reveal" style="--i:${i % 4}">
      <a data-pin-do="embedPin" data-pin-width="medium" data-pin-terse="true" href="${esc(u)}"></a>
      <button class="btn btn-primary btn-sm" type="button" data-recreate="${esc(u)}">Recreate this for me · ${rupee(recreatePrice())}</button></div>`).join('');
    const s = document.createElement('script');
    s.async = true; s.defer = true; s.src = 'https://assets.pinterest.com/js/pinit.js';
    document.body.appendChild(s);
    reveal($('#pins'));
  }

  // ---------- recreate ----------
  function renderRecreate() {
    $('#rShape').innerHTML = S.cfg.shapes.map((s) => `<option ${s === 'Almond' ? 'selected' : ''}>${s}</option>`).join('');
    $('#rLength').innerHTML = S.cfg.lengths.map((s) => `<option ${s === 'Medium' ? 'selected' : ''}>${s}</option>`).join('');
    $('#rPrice').textContent = rupee(recreatePrice());
  }
  $('#recreateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const link = $('#rLink').value.trim(), notes = $('#rNotes').value.trim();
    if (!link && !notes) { $('#rErr').textContent = 'Paste a link to the design, or describe it in the notes.'; return; }
    if (link && !/^https?:\/\//i.test(link)) { $('#rErr').textContent = 'The link should start with https://'; return; }
    $('#rErr').textContent = '';
    cart.add({ productId: 'recreate', qty: 1, custom: true, size: 'Custom', shape: $('#rShape').value, length: $('#rLength').value, inspirationLink: link, customNotes: notes, fingerSizes: $('#rSizes').value.trim() });
    e.target.reset(); renderRecreate();
    toast('Your design request is in the cart');
  });

  // ---------- product modal ----------
  const M = { p: null, size: 'M', custom: false, qty: 1, img: 0 };
  function openModal(id) {
    const p = product(id); if (!p) return;
    Object.assign(M, { p, size: 'M', custom: false, qty: 1, img: 0 });
    $('#mEyebrow').textContent = (p.tags || []).join(' · ');
    $('#mName').textContent = p.name;
    $('#mDesc').textContent = p.description;
    $('#mSpecs').innerHTML = [p.shape, p.length, p.finish, '10 nails + kit'].map((s) => `<span>${esc(s)}</span>`).join('');
    $('#mCustom').checked = false;
    ['#fThumb', '#fIndex', '#fMiddle', '#fRing', '#fPinky', '#mNotes'].forEach((s) => ($(s).value = ''));
    renderGallery(); updateModal();
    $('#modal').classList.add('open'); $('#modal').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#closeModal').focus(), 60);
  }
  function renderGallery() {
    const imgs = M.p.images || [];
    $('#mMain').innerHTML = imgs.length ? `<img src="${esc(imgs[M.img])}" alt="${esc(M.p.name)} photo ${M.img + 1}">` : NailArt.renderSet(M.p);
    $('#mThumbs').innerHTML = imgs.length > 1 ? imgs.map((u, i) => `<button type="button" data-img="${i}" aria-pressed="${i === M.img}" aria-label="Photo ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('') : '';
  }
  function updateModal() {
    $('#mSizes').innerHTML = S.cfg.standardSizes.map((s) => `<button class="size-btn" type="button" data-size="${s}" aria-pressed="${!M.custom && M.size === s}" ${M.custom ? 'disabled' : ''}>${s}</button>`).join('');
    $('#mCustomFields').hidden = !M.custom;
    $('#mQty').textContent = M.qty;
    $('#mPrice').textContent = rupee((M.p.price + (M.custom ? S.cfg.customizationFee : 0)) * M.qty);
  }
  function closeModal() {
    $('#modal').classList.remove('open'); $('#modal').setAttribute('aria-hidden', 'true');
    if (!$('#drawer').classList.contains('open')) { $('#scrim').classList.remove('open'); document.body.style.overflow = ''; }
  }
  function addFromModal() {
    const f = ['#fThumb', '#fIndex', '#fMiddle', '#fRing', '#fPinky'].map((s) => $(s).value.trim());
    const fingerSizes = M.custom && f.some(Boolean) ? ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map((n, i) => `${n} ${f[i] || '?'}mm`).join(', ') : '';
    cart.add({ productId: M.p.id, name: M.p.name, qty: M.qty, size: M.custom ? 'Custom' : M.size, custom: M.custom, fingerSizes, customNotes: M.custom ? $('#mNotes').value.trim() : '' });
    closeModal(); toast(`${M.p.name} added to your cart`);
  }

  // ---------- cart drawer ----------
  function openCart() {
    if (S.view === 'done') S.view = 'cart';
    renderDrawer();
    $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
    if (!$('#modal').classList.contains('open')) { $('#scrim').classList.remove('open'); document.body.style.overflow = ''; }
    if (S.view === 'done') S.view = 'cart';
    if (location.hash === '#cart') history.replaceState(null, '', location.pathname);
  }

  function itemLines(editable) {
    return validItems().map((it) => {
      const p = product(it.productId);
      const title = it.productId === 'recreate' ? `Recreate a design <small class="muted">(${esc(it.shape)}, ${esc(it.length)})</small>` : esc(p.name);
      const details = [
        it.productId === 'recreate' ? '' : it.custom ? `Custom fit &amp; design (+${rupee(S.cfg.customizationFee)})` : `Size ${esc(it.size)}`,
        it.inspirationLink ? `<a href="${esc(it.inspirationLink)}" target="_blank" rel="noopener">Inspiration link</a>` : '',
        it.fingerSizes ? esc(it.fingerSizes) : '', it.customNotes ? `“${esc(it.customNotes)}”` : '',
      ].filter(Boolean).join('<br>');
      return `<div class="line-item"><div class="thumb">${artFor(it)}</div><div><h4>${title}</h4><p>${details}</p>
        ${editable ? `<div class="row-actions"><div class="qty"><button type="button" data-dec="${it.key}" aria-label="Fewer">−</button><span>${it.qty}</span><button type="button" data-inc="${it.key}" aria-label="More">+</button></div><button class="remove" type="button" data-remove="${it.key}">Remove</button></div>` : `<p>Qty ${it.qty}</p>`}
        </div><span class="price num" style="font-size:15px">${rupee(unitPrice(it) * it.qty)}</span></div>`;
    }).join('');
  }
  const summary = () => `<div class="sum"><div><span>Subtotal</span><span>${rupee(subtotal())}</span></div><div><span>Shipping (pan-India)</span><span>${rupee(S.cfg.shippingFee)}</span></div><div class="total"><span>Total</span><span>${rupee(subtotal() + S.cfg.shippingFee)}</span></div></div>`;

  async function renderDrawer() {
    const body = $('#drawerBody'), foot = $('#drawerFoot');
    if (!S.cfg) return;
    if (S.view === 'done') return renderDone();
    if (!validItems().length) {
      $('#drawerTitle').textContent = 'Your cart';
      body.innerHTML = '<div class="empty">Your cart is empty.<br>Pick a design you love to get started.</div>';
      foot.innerHTML = '<a class="btn btn-primary btn-block" href="#shop" data-close-cart>Browse designs</a>';
      return;
    }
    if (S.view === 'cart') {
      $('#drawerTitle').textContent = 'Your cart';
      body.innerHTML = itemLines(true);
      foot.innerHTML = `${summary()}<p class="fine">Delivered to your door in ${esc(S.cfg.deliveryDays)} days.</p><button class="btn btn-primary btn-block" type="button" id="toCheckout">Checkout</button>`;
      return;
    }
    // checkout
    $('#drawerTitle').textContent = 'Checkout';
    const user = await me();
    const d = user || {};
    const online = S.cfg.paymentMode === 'razorpay';
    body.innerHTML = `${user ? `<p class="notice">Ordering as <b>${esc(user.name)}</b>. This order will appear in <a href="/account">My account</a>.</p>` : `<p class="notice"><a href="/account?next=checkout">Log in or create an account</a> to track this order. You can also check out as a guest.</p>`}
      <form class="form" id="checkoutForm" novalidate>
        <label>Full name<input id="cName" autocomplete="name" value="${esc(d.name)}"></label>
        <label>Mobile number (WhatsApp)<input id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98XXXXXXXX" value="${esc(d.phone)}"></label>
        <label>House no., street, area<textarea id="cAddress" rows="2" autocomplete="street-address">${esc(d.address)}</textarea></label>
        <div class="row3">
          <label>City<input id="cCity" autocomplete="address-level2" value="${esc(d.city)}"></label>
          <label>State<input id="cState" autocomplete="address-level1" value="${esc(d.state)}"></label>
          <label>PIN code<input id="cPin" inputmode="numeric" maxlength="6" autocomplete="postal-code" value="${esc(d.pincode)}"></label>
        </div>
        <label>Note for Jazz (optional)<textarea id="cNotes" rows="2" placeholder="Occasion, needed-by date, outfit colour…"></textarea></label>
        <div class="form" role="radiogroup" aria-label="Payment" style="gap:8px">
          <label class="pay-opt"><input type="radio" name="pay" value="whatsapp" ${online ? '' : 'checked'}><span><b>Order on WhatsApp, pay by UPI</b><small>Jazz confirms your order and shares UPI details.</small></span></label>
          <label class="pay-opt ${online ? '' : 'disabled'}"><input type="radio" name="pay" value="online" ${online ? 'checked' : 'disabled'}><span><b>Pay online now</b><small>${online ? 'UPI, cards and netbanking via Razorpay.' : 'Coming soon.'}</small></span></label>
        </div>
        <p class="errors" id="cErrors" role="alert"></p>
      </form>
      <details><summary class="fine">Order summary (${cart.count()} ${cart.count() === 1 ? 'item' : 'items'})</summary><div style="display:grid;gap:12px;margin-top:12px">${itemLines(false)}</div></details>`;
    foot.innerHTML = `${summary()}<button class="btn btn-wa btn-block" type="submit" form="checkoutForm" id="placeOrder">Place order on WhatsApp</button><button class="btn btn-ghost btn-block" type="button" id="backToCart">Back to cart</button>`;
    const sync = () => {
      const v = ($('input[name="pay"]:checked') || {}).value;
      $('#placeOrder').textContent = v === 'online' ? `Pay ${rupee(subtotal() + S.cfg.shippingFee)}` : 'Place order on WhatsApp';
      $('#placeOrder').className = `btn btn-block ${v === 'online' ? 'btn-primary' : 'btn-wa'}`;
    };
    $$('input[name="pay"]', body).forEach((r) => r.addEventListener('change', sync)); sync();
  }

  function renderDone() {
    const o = S.lastOrder;
    $('#drawerTitle').textContent = 'Thank you!';
    $('#drawerBody').innerHTML = `<div class="success"><div class="check">${icons.check}</div>
      <h3>${o.paid ? 'Payment received' : 'One last step'}</h3>
      <p>Order ID <span class="order-id">${esc(o.id)}</span></p>
      <p class="fine">${o.paid ? 'Jazz will message you on WhatsApp with dispatch details.' : 'Send this message to Jazz on WhatsApp. Your order is confirmed once she replies with payment details.'}</p>
      <pre class="msg-preview" id="msgText">${esc(o.message)}</pre>
      <p class="fine">WhatsApp: <b style="user-select:all">+${esc(S.cfg.whatsappNumber)}</b></p>
      ${o.loggedIn ? '<a class="link" href="/account">Track this order in My account</a>' : ''}</div>`;
    $('#drawerFoot').innerHTML = `${o.paid ? '' : `<a class="btn btn-wa btn-block" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener">Open WhatsApp &amp; send</a>`}<button class="btn btn-ghost btn-block" type="button" id="copyMsg">Copy order message</button>`;
  }

  async function placeOrder(e) {
    e.preventDefault();
    const v = (s) => $(s).value.trim();
    const customer = { name: v('#cName'), phone: v('#cPhone'), address: v('#cAddress'), city: v('#cCity'), state: v('#cState'), pincode: v('#cPin') };
    const errs = [];
    if (!customer.name) errs.push('Enter your name.');
    if (customer.phone.replace(/\D/g, '').length < 10) errs.push('Enter a 10-digit mobile number.');
    if (!customer.address) errs.push('Enter your delivery address.');
    if (!customer.city) errs.push('Enter your city.');
    if (!/^\d{6}$/.test(customer.pincode)) errs.push('Enter a 6-digit PIN code.');
    if (errs.length) { $('#cErrors').innerHTML = errs.map((x) => `<span>${x}</span>`).join(''); return; }
    const payOnline = ($('input[name="pay"]:checked') || {}).value === 'online';
    const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Placing your order…';
    let r;
    try {
      r = await api('/api/orders', { method: 'POST', body: { customer, notes: v('#cNotes'), payOnline, items: validItems() } });
    } catch (err) {
      $('#cErrors').textContent = err.message; btn.disabled = false; btn.textContent = 'Try again'; return;
    }
    const user = await me();
    S.lastOrder = { id: r.order.id, whatsappUrl: r.whatsappUrl, message: decodeURIComponent(r.whatsappUrl.split('?text=')[1] || ''), paid: false, loggedIn: !!user };
    if (payOnline && r.payment) {
      const ok = await payWithRazorpay(r, customer);
      if (!ok) { btn.disabled = false; btn.textContent = 'Try payment again'; return; }
      S.lastOrder.paid = true;
    }
    cart.clear();
    S.view = 'done'; renderDrawer();
    if (!S.lastOrder.paid) window.open(r.whatsappUrl, '_blank', 'noopener');
  }

  function loadScript(src) { return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }
  async function payWithRazorpay(r, customer) {
    try { if (!window.Razorpay) await loadScript('https://checkout.razorpay.com/v1/checkout.js'); }
    catch { $('#cErrors').textContent = 'Online payment could not load. Choose WhatsApp ordering instead.'; return false; }
    return new Promise((resolve) => {
      new window.Razorpay({
        key: r.payment.keyId, order_id: r.payment.razorpayOrderId, amount: r.payment.amount, currency: 'INR',
        name: 'Nails by Jazz', description: `Order ${r.order.id}`, prefill: { name: customer.name, contact: customer.phone }, theme: { color: '#D23A6E' },
        handler: async (resp) => {
          try { await api('/api/payments/verify', { method: 'POST', body: { orderId: r.order.id, ...resp } }); resolve(true); }
          catch { $('#cErrors').textContent = 'We could not verify the payment. Message Jazz on WhatsApp with your order ID.'; resolve(false); }
        },
        modal: { ondismiss: () => resolve(false) },
      }).open();
    });
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    const d = t.dataset;
    if (d.filter) { S.filter = d.filter; renderFilters(); renderGrid(); }
    else if (d.open) openModal(d.open);
    else if (d.recreate) {
      e.preventDefault();
      $('#rLink').value = d.recreate; $('#rErr').textContent = '';
      $('#recreate').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => $('#rShape').focus({ preventScroll: true }), 600);
      toast('Design link added. Choose your shape and length.');
    }
    else if (d.img) { M.img = Number(d.img); renderGallery(); }
    else if (d.size && !t.disabled) { M.size = d.size; updateModal(); }
    else if (d.inc || d.dec) { const items = cart.items(); const it = items.find((x) => x.key === (d.inc || d.dec)); if (it) { it.qty = Math.max(1, Math.min(10, it.qty + (d.inc ? 1 : -1))); cart.save(items); renderDrawer(); } }
    else if (d.remove) { cart.save(cart.items().filter((x) => x.key !== d.remove)); renderDrawer(); }
    else if ('closeCart' in d) closeCart();
    else if ('closeModal' in d) closeModal();
    else if (t.id === 'openCart') openCart();
    else if (t.id === 'closeCart') closeCart();
    else if (t.id === 'closeModal') closeModal();
    else if (t.id === 'mMinus') { M.qty = Math.max(1, M.qty - 1); updateModal(); }
    else if (t.id === 'mPlus') { M.qty = Math.min(10, M.qty + 1); updateModal(); }
    else if (t.id === 'mAdd') addFromModal();
    else if (t.id === 'toCheckout') { S.view = 'checkout'; renderDrawer(); }
    else if (t.id === 'backToCart') { S.view = 'cart'; renderDrawer(); }
    else if (t.id === 'copyMsg') {
      const text = S.lastOrder?.message || '';
      const sel = () => { const r = document.createRange(); r.selectNodeContents($('#msgText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Message selected. Copy it now.'); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Order message copied')).catch(sel); else sel();
    }
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'checkoutForm') placeOrder(e); });
  $('#mCustom').addEventListener('change', (e) => { M.custom = e.target.checked; updateModal(); });
  $('#shapeFilter').addEventListener('change', (e) => { S.shape = e.target.value; renderGrid(); });
  $('#sortBy').addEventListener('change', (e) => { S.sort = e.target.value; renderGrid(); });
  $('#scrim').addEventListener('click', () => { closeModal(); closeCart(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeCart(); } });
  window.addEventListener('hashchange', () => { if (location.hash === '#cart') openCart(); });
  document.addEventListener('cart:change', () => { if ($('#drawer').classList.contains('open') && S.view === 'cart') renderDrawer(); });

  load();
})();
