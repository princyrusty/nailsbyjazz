// Nails by Jazz — store server (Express)
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* optional */ }
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { connect, newId } = require('./lib/db');
const auth = require('./lib/auth');
const razorpay = require('./payments/razorpay');

const env = {
  port: Number(process.env.PORT) || 3000,
  adminUser: process.env.ADMIN_USERNAME || 'nailsbyjazzy',
  adminPass: process.env.ADMIN_PASSWORD || 'change-me',
  paymentMode: (process.env.PAYMENT_MODE || 'whatsapp').toLowerCase(),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
};
const onlinePayments = () => env.paymentMode === 'razorpay' && razorpay.isConfigured(env);

const DEFAULT_SETTINGS = {
  id: 'site',
  whatsappNumber: (process.env.WHATSAPP_NUMBER || '918439411560').replace(/\D/g, ''),
  instagram: process.env.INSTAGRAM || 'jassmakeover13',
  customizationFee: 100,
  shippingFee: 99,
  deliveryDays: '5–6',
  recreateBasePrice: 700,
  announcement: 'Pan-India home delivery · ₹99 shipping · Delivered in 5–6 days',
  pinterestPins: [
    'https://in.pinterest.com/pin/4292562141585009/',
    'https://in.pinterest.com/pin/55169164192025443/',
    'https://in.pinterest.com/pin/4609223212192349824/',
    'https://in.pinterest.com/pin/14566398794050117/',
    'https://in.pinterest.com/pin/172333123236659553/',
    'https://in.pinterest.com/pin/1618549865456355/',
    'https://in.pinterest.com/pin/4604930746735375488/',
    'https://in.pinterest.com/pin/351912467599944/',
    'https://in.pinterest.com/pin/4594093950163129728/',
    'https://in.pinterest.com/pin/1124211125773583848/',
    'https://in.pinterest.com/pin/563018699896585/',
    'https://in.pinterest.com/pin/20266267069660442/',
  ],
};
const PIN_RE = /^https:\/\/((www|[a-z]{2})\.)?pinterest\.[a-z.]{2,6}\/pin\/[\w-]+\/?$|^https:\/\/pin\.it\/[\w]+\/?$/i;
const STANDARD_SIZES = ['XS', 'S', 'M', 'L'];
const SHAPES = ['Almond', 'Coffin', 'Square', 'Oval', 'Stiletto'];
const LENGTHS = ['Short', 'Medium', 'Long'];
const ORDER_STATUSES = ['new', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];

// ---------- helpers ----------
const rupee = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const clean = (s, max = 300) => String(s ?? '').trim().slice(0, max);
const slug = (s) => clean(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const phone10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const publicUser = (u) => u && ({ id: u.id, name: u.name, phone: u.phone, email: u.email || '', address: u.address || '', city: u.city || '', pincode: u.pincode || '', state: u.state || '', createdAt: u.createdAt });

function orderId() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `NBJ-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function whatsappMessage(order, s) {
  const L = [`Hi Jazz! I'd like to place an order 💅`, `Order ID: ${order.id}`, ''];
  order.items.forEach((it, i) => {
    if (it.productId === 'recreate') {
      L.push(`${i + 1}. Recreate a design (${it.shape}, ${it.length}) x${it.qty}`);
      if (it.inspirationLink) L.push(`   Inspiration: ${it.inspirationLink}`);
    } else {
      L.push(`${i + 1}. ${it.name} (${it.shape}, ${it.length}) x${it.qty}`);
    }
    L.push(`   Size: ${it.custom ? 'Custom fit' : it.size}${it.custom && it.productId !== 'recreate' ? ` (+${rupee(it.customFee)})` : ''}`);
    if (it.fingerSizes) L.push(`   Finger sizes: ${it.fingerSizes}`);
    if (it.customNotes) L.push(`   Design notes: ${it.customNotes}`);
    L.push(`   ${rupee(it.unitPrice)} x ${it.qty} = ${rupee(it.lineTotal)}`);
  });
  L.push('', `Subtotal: ${rupee(order.subtotal)}`, `Shipping: ${rupee(order.shipping)}`, `Total: ${rupee(order.total)}`, '');
  L.push(`Name: ${order.customer.name}`, `Phone: ${order.customer.phone}`);
  L.push(`Address: ${order.customer.address}, ${order.customer.city}${order.customer.state ? ', ' + order.customer.state : ''} - ${order.customer.pincode}`);
  if (order.notes) L.push(`Notes: ${order.notes}`);
  L.push('', `Please share UPI payment details. Expected delivery: ${s.deliveryDays} days after dispatch. Thank you!`);
  return L.join('\n');
}

async function main() {
  const db = await connect();

  // ---------- seed ----------
  let settings = await db.get('settings', 'site');
  if (!settings) settings = await db.insert('settings', DEFAULT_SETTINGS);
  else settings = { ...DEFAULT_SETTINGS, ...settings };
  if ((await db.count('products')) === 0) {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed-products.json'), 'utf8'));
    for (const [i, p] of seed.entries()) await db.insert('products', { ...p, images: [], order: i, createdAt: new Date().toISOString() });
    console.log(`Seeded ${seed.length} products`);
  }

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
    const c = auth.parseCookies(req);
    const u = auth.verify(c.nbj_user); if (u && u.role === 'user') req.userId = u.sub;
    const a = auth.verify(c.nbj_admin); if (a && a.role === 'admin') req.isAdmin = true;
    next();
  });
  app.use('/api/admin/images', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

  app.get('/healthz', (_req, res) => res.send('ok'));

  // ---------- public ----------
  app.get('/api/config', (_req, res) => {
    res.json({
      whatsappNumber: settings.whatsappNumber, instagram: settings.instagram,
      customizationFee: settings.customizationFee, shippingFee: settings.shippingFee, deliveryDays: settings.deliveryDays,
      recreateBasePrice: settings.recreateBasePrice, announcement: settings.announcement,
      pinterestPins: settings.pinterestPins || [],
      standardSizes: STANDARD_SIZES, shapes: SHAPES, lengths: LENGTHS,
      paymentMode: onlinePayments() ? 'razorpay' : 'whatsapp',
    });
  });

  app.get('/api/products', wrap(async (_req, res) => {
    const list = await db.list('products', {}, { sort: { order: 1 } });
    res.json(list.filter((p) => p.inStock !== false));
  }));

  app.get('/img/:id', wrap(async (req, res) => {
    const img = await db.getImage(req.params.id);
    if (!img) return res.status(404).end();
    res.set({ 'Content-Type': img.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(img.data);
  }));

  // ---------- customer accounts ----------
  function startSession(res, user) { auth.setCookie(res, 'nbj_user', auth.sign({ sub: user.id, role: 'user' }, 60), 60); }

  app.post('/api/auth/signup', wrap(async (req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 80), phone = phone10(b.phone), email = clean(b.email, 120).toLowerCase(), password = String(b.password || '');
    const errors = [];
    if (!name) errors.push('Enter your name.');
    if (phone.length !== 10) errors.push('Enter a 10-digit mobile number.');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('Check your email address.');
    if (password.length < 6) errors.push('Use a password of at least 6 characters.');
    if (errors.length) return res.status(400).json({ errors });
    if (await db.findOne('users', { phone })) return res.status(409).json({ errors: ['An account with this number already exists. Log in instead.'] });
    const user = await db.insert('users', { name, phone, email, password: auth.hashPassword(password), createdAt: new Date().toISOString() });
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const phone = phone10(req.body?.phone);
    if (auth.tooManyAttempts(`u:${req.ip}`)) return res.status(429).json({ errors: ['Too many attempts. Try again in 15 minutes.'] });
    const user = phone && await db.findOne('users', { phone });
    if (!user || !auth.checkPassword(req.body?.password, user.password)) return res.status(401).json({ errors: ['Mobile number or password is incorrect.'] });
    startSession(res, user);
    res.json({ user: publicUser(user) });
  }));

  app.post('/api/auth/logout', (_req, res) => { auth.setCookie(res, 'nbj_user', '', 0); res.json({ ok: true }); });

  const requireUser = wrap(async (req, res, next) => {
    const user = req.userId && await db.get('users', req.userId);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    req.user = user; next();
  });

  app.get('/api/me', wrap(async (req, res) => {
    const user = req.userId && await db.get('users', req.userId);
    res.json({ user: publicUser(user) || null });
  }));

  app.put('/api/me', requireUser, wrap(async (req, res) => {
    const b = req.body || {};
    const patch = {
      name: clean(b.name, 80) || req.user.name, email: clean(b.email, 120).toLowerCase(),
      address: clean(b.address, 300), city: clean(b.city, 60), state: clean(b.state, 60), pincode: clean(b.pincode, 6).replace(/\D/g, ''),
    };
    const user = await db.update('users', req.user.id, patch);
    res.json({ user: publicUser(user) });
  }));

  app.put('/api/me/password', requireUser, wrap(async (req, res) => {
    const { current, next: nextPw } = req.body || {};
    if (!auth.checkPassword(current, req.user.password)) return res.status(400).json({ errors: ['Your current password is incorrect.'] });
    if (String(nextPw || '').length < 6) return res.status(400).json({ errors: ['Use a new password of at least 6 characters.'] });
    await db.update('users', req.user.id, { password: auth.hashPassword(nextPw) });
    res.json({ ok: true });
  }));

  app.get('/api/me/orders', requireUser, wrap(async (req, res) => {
    res.json(await db.list('orders', { userId: req.user.id }, { sort: { createdAt: -1 } }));
  }));

  // ---------- orders ----------
  app.post('/api/orders', wrap(async (req, res) => {
    const b = req.body || {}, c = b.customer || {};
    const customer = {
      name: clean(c.name, 80), phone: phone10(c.phone), address: clean(c.address, 300),
      city: clean(c.city, 60), state: clean(c.state, 60), pincode: clean(c.pincode, 6).replace(/\D/g, ''),
    };
    const errors = [];
    if (!customer.name) errors.push('Enter your name.');
    if (customer.phone.length !== 10) errors.push('Enter a 10-digit mobile number.');
    if (!customer.address) errors.push('Enter your delivery address.');
    if (!customer.city) errors.push('Enter your city.');
    if (customer.pincode.length !== 6) errors.push('Enter a 6-digit PIN code.');

    const catalogue = new Map((await db.list('products')).map((p) => [p.id, p]));
    const items = [];
    for (const raw of (Array.isArray(b.items) ? b.items.slice(0, 30) : [])) {
      const qty = Math.min(Math.max(parseInt(raw.qty, 10) || 1, 1), 10);
      if (raw.productId === 'recreate') {
        const unitPrice = settings.recreateBasePrice + settings.customizationFee;
        items.push({
          productId: 'recreate', name: 'Recreate a design', shape: SHAPES.includes(raw.shape) ? raw.shape : 'Almond',
          length: LENGTHS.includes(raw.length) ? raw.length : 'Medium', custom: true, customFee: settings.customizationFee,
          size: 'Custom', inspirationLink: clean(raw.inspirationLink, 400), fingerSizes: clean(raw.fingerSizes, 120),
          customNotes: clean(raw.customNotes, 400), qty, unitPrice, lineTotal: unitPrice * qty,
        });
        continue;
      }
      const p = catalogue.get(raw.productId);
      if (!p || p.inStock === false) { errors.push(`"${clean(raw.name || raw.productId, 40)}" is no longer available. Remove it from your cart.`); continue; }
      const custom = Boolean(raw.custom);
      const customFee = custom ? settings.customizationFee : 0;
      const unitPrice = p.price + customFee;
      items.push({
        productId: p.id, name: p.name, shape: p.shape, length: p.length, image: (p.images || [])[0] || '',
        basePrice: p.price, custom, customFee, size: custom ? 'Custom' : (STANDARD_SIZES.includes(raw.size) ? raw.size : 'M'),
        fingerSizes: custom ? clean(raw.fingerSizes, 120) : '', customNotes: custom ? clean(raw.customNotes, 400) : '',
        qty, unitPrice, lineTotal: unitPrice * qty,
      });
    }
    if (!items.length && !errors.length) errors.push('Your cart is empty.');
    if (errors.length) return res.status(400).json({ errors });

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const shipping = settings.shippingFee;
    const order = {
      id: orderId(), createdAt: new Date().toISOString(), userId: req.userId || null,
      status: 'new', paymentStatus: 'pending', paymentMethod: 'whatsapp', tracking: '',
      customer, items, notes: clean(b.notes, 500), subtotal, shipping, total: subtotal + shipping,
    };
    const response = { order };
    if (b.payOnline && onlinePayments()) {
      try {
        const rp = await razorpay.createOrder(env, { amount: order.total, receipt: order.id, notes: { phone: customer.phone } });
        order.paymentMethod = 'razorpay'; order.razorpayOrderId = rp.id;
        response.payment = { provider: 'razorpay', keyId: env.razorpayKeyId, razorpayOrderId: rp.id, amount: rp.amount, currency: rp.currency };
      } catch (err) { console.error('Razorpay error:', err.message); }
    }
    await db.insert('orders', order);
    // Remember the address on the customer's profile
    if (req.userId) {
      const u = await db.get('users', req.userId);
      if (u && !u.address) await db.update('users', u.id, { address: customer.address, city: customer.city, state: customer.state, pincode: customer.pincode });
    }
    response.whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(whatsappMessage(order, settings))}`;
    res.status(201).json(response);
  }));

  app.post('/api/payments/verify', wrap(async (req, res) => {
    const order = await db.get('orders', String(req.body?.orderId || ''));
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!onlinePayments() || req.body.razorpay_order_id !== order.razorpayOrderId || !razorpay.verifySignature(env, req.body)) {
      return res.status(400).json({ error: 'Payment could not be verified.' });
    }
    const updated = await db.update('orders', order.id, { paymentStatus: 'paid', status: 'paid', razorpayPaymentId: req.body.razorpay_payment_id });
    res.json({ ok: true, order: updated });
  }));

  // ---------- admin ----------
  app.post('/api/admin/login', (req, res) => {
    if (auth.tooManyAttempts(`a:${req.ip}`, 6)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const { username, password } = req.body || {};
    if (!auth.safeEqual(String(username || '').trim().toLowerCase(), env.adminUser.toLowerCase()) || !auth.safeEqual(password || '', env.adminPass)) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    auth.setCookie(res, 'nbj_admin', auth.sign({ sub: 'admin', role: 'admin' }, 14), 14);
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', (_req, res) => { auth.setCookie(res, 'nbj_admin', '', 0); res.json({ ok: true }); });
  const requireAdmin = (req, res, next) => (req.isAdmin ? next() : res.status(401).json({ error: 'Please log in to the admin panel.' }));
  app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ ok: true, username: env.adminUser, database: db.kind }));

  app.get('/api/admin/orders', requireAdmin, wrap(async (_req, res) => res.json(await db.list('orders', {}, { sort: { createdAt: -1 } }))));
  app.patch('/api/admin/orders/:id', requireAdmin, wrap(async (req, res) => {
    const b = req.body || {}, patch = {};
    if (ORDER_STATUSES.includes(b.status)) patch.status = b.status;
    if (['pending', 'paid', 'refunded'].includes(b.paymentStatus)) patch.paymentStatus = b.paymentStatus;
    if (b.tracking !== undefined) patch.tracking = clean(b.tracking, 200);
    const o = await db.update('orders', req.params.id, patch);
    if (!o) return res.status(404).json({ error: 'Order not found.' });
    res.json(o);
  }));

  app.get('/api/admin/customers', requireAdmin, wrap(async (_req, res) => {
    const [users, orders] = await Promise.all([db.list('users', {}, { sort: { createdAt: -1 } }), db.list('orders')]);
    res.json(users.map((u) => {
      const mine = orders.filter((o) => o.userId === u.id && o.status !== 'cancelled');
      return { ...publicUser(u), orders: mine.length, spent: mine.reduce((s, o) => s + o.total, 0) };
    }));
  }));

  function productFrom(b, existing = {}) {
    const price = Math.round(Number(b.price ?? existing.price));
    return {
      name: clean(b.name ?? existing.name, 60),
      price: Number.isFinite(price) && price > 0 ? price : 700,
      shape: SHAPES.includes(b.shape) ? b.shape : existing.shape || 'Almond',
      length: LENGTHS.includes(b.length) ? b.length : existing.length || 'Medium',
      finish: clean(b.finish ?? existing.finish, 20) || 'Glossy',
      pattern: clean(b.pattern ?? existing.pattern, 20) || 'solid',
      colors: Array.isArray(b.colors) ? b.colors.slice(0, 5).map((x) => clean(x, 9)) : existing.colors || ['#F7B6CB', '#FFFFFF'],
      description: clean(b.description ?? existing.description, 500),
      tags: Array.isArray(b.tags) ? b.tags.map((t) => clean(t, 20).toLowerCase()).filter(Boolean) : existing.tags || [],
      inStock: b.inStock ?? existing.inStock ?? true,
      images: Array.isArray(b.images) ? b.images.filter((x) => typeof x === 'string' && /^\/img\/[a-f0-9]+$|^https:\/\//.test(x)).slice(0, 12) : existing.images || [],
    };
  }

  app.get('/api/admin/products', requireAdmin, wrap(async (_req, res) => res.json(await db.list('products', {}, { sort: { order: 1 } }))));
  app.post('/api/admin/products', requireAdmin, wrap(async (req, res) => {
    const p = productFrom(req.body || {});
    if (!p.name) return res.status(400).json({ error: 'Give the design a name.' });
    let id = slug(p.name) || newId(4);
    if (await db.get('products', id)) id = `${id}-${newId(2)}`;
    const count = await db.count('products');
    res.status(201).json(await db.insert('products', { id, ...p, order: count, createdAt: new Date().toISOString() }));
  }));
  app.put('/api/admin/products/:id', requireAdmin, wrap(async (req, res) => {
    const existing = await db.get('products', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Design not found.' });
    const p = productFrom(req.body || {}, existing);
    if (!p.name) return res.status(400).json({ error: 'Give the design a name.' });
    res.json(await db.update('products', existing.id, p));
  }));
  app.delete('/api/admin/products/:id', requireAdmin, wrap(async (req, res) => {
    const ok = await db.remove('products', req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { ok } : { error: 'Design not found.' });
  }));
  // Change many prices at once: { ids?: [], mode: 'set'|'add'|'percent', value }
  app.post('/api/admin/prices', requireAdmin, wrap(async (req, res) => {
    const { mode, value } = req.body || {};
    const v = Number(value);
    if (!['set', 'add', 'percent'].includes(mode) || !Number.isFinite(v)) return res.status(400).json({ error: 'Choose how to change prices and enter a number.' });
    const ids = Array.isArray(req.body.ids) && req.body.ids.length ? new Set(req.body.ids) : null;
    const products = await db.list('products');
    let changed = 0;
    for (const p of products) {
      if (ids && !ids.has(p.id)) continue;
      let price = mode === 'set' ? v : mode === 'add' ? p.price + v : p.price * (1 + v / 100);
      price = Math.max(50, Math.round(price / 10) * 10);
      await db.update('products', p.id, { price }); changed++;
    }
    res.json({ changed });
  }));

  // Upload one image as a data URL (the admin page shrinks photos before sending)
  app.post('/api/admin/images', requireAdmin, wrap(async (req, res) => {
    const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(String(req.body?.dataUrl || ''));
    if (!m) return res.status(400).json({ error: 'Upload a JPG, PNG or WebP photo.' });
    const data = Buffer.from(m[3], 'base64');
    if (data.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'That photo is too large (max 4 MB).' });
    const img = await db.putImage({ contentType: m[1], data, size: data.length, createdAt: new Date().toISOString() });
    res.status(201).json({ id: img.id, url: `/img/${img.id}` });
  }));
  app.delete('/api/admin/images/:id', requireAdmin, wrap(async (req, res) => {
    await db.remove('images', req.params.id); res.json({ ok: true });
  }));

  app.get('/api/admin/settings', requireAdmin, (_req, res) => res.json(settings));
  app.put('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
    const b = req.body || {}, num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : d);
    const patch = {
      whatsappNumber: String(b.whatsappNumber ?? settings.whatsappNumber).replace(/\D/g, '') || settings.whatsappNumber,
      instagram: clean(b.instagram ?? settings.instagram, 60).replace(/^@/, ''),
      customizationFee: num(b.customizationFee, settings.customizationFee),
      shippingFee: num(b.shippingFee, settings.shippingFee),
      recreateBasePrice: num(b.recreateBasePrice, settings.recreateBasePrice),
      deliveryDays: clean(b.deliveryDays ?? settings.deliveryDays, 20) || settings.deliveryDays,
      announcement: clean(b.announcement ?? settings.announcement, 160),
      pinterestPins: Array.isArray(b.pinterestPins)
        ? [...new Set(b.pinterestPins.map((u) => clean(u, 200).split('?')[0]).filter((u) => PIN_RE.test(u)))].slice(0, 40)
        : settings.pinterestPins || [],
    };
    settings = { ...settings, ...(await db.update('settings', 'site', patch)) };
    res.json(settings);
  }));

  // ---------- errors ----------
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err, _req, res, _next) => {
    console.error(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large.' });
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  app.listen(env.port, () => {
    console.log(`Nails by Jazz running on http://localhost:${env.port}  (admin: /admin)`);
    if (env.adminPass === 'change-me') console.warn('Set ADMIN_PASSWORD before going live.');
  });
}

main().catch((err) => { console.error('Failed to start:', err); process.exit(1); });
