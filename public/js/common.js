// Shared helpers for every page: API, config, cart store, header, toast, scroll reveals.
document.documentElement.classList.add('js');
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data.errors || [data.error || 'Something went wrong. Please try again.']).join(' '));
      err.status = res.status; err.errors = data.errors || [err.message]; throw err;
    }
    return data;
  }

  let configP, meP;
  const config = () => (configP ||= api('/api/config'));
  const me = (fresh) => { if (fresh || !meP) meP = api('/api/me').then((d) => d.user).catch(() => null); return meP; };

  // ---------- cart (saved in this browser) ----------
  const KEY = 'nbj-cart-v2';
  const cart = {
    items() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
    save(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage off */ } document.dispatchEvent(new CustomEvent('cart:change')); },
    count() { return this.items().reduce((s, i) => s + i.qty, 0); },
    add(item) {
      const items = this.items();
      const same = !item.custom && items.find((x) => x.productId === item.productId && !x.custom && x.size === item.size);
      if (same) same.qty = Math.min(10, same.qty + item.qty); else items.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...item });
      this.save(items);
    },
    clear() { this.save([]); },
  };

  let toastTimer;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- reveal on scroll ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
  function reveal(root = document) { $$('.reveal:not(.in)', root).forEach((el) => (io ? io.observe(el) : el.classList.add('in'))); }

  const icons = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2l-.4-.2Z"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="2" fill="#fff"/><circle cx="17" cy="17.5" r="2" fill="#fff"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-8 8H6v-6l8-8Z"/><path d="M11 7l6 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  // ---------- header / footer ----------
  async function initChrome() {
    $$('[data-icon]').forEach((el) => { el.insertAdjacentHTML('afterbegin', icons[el.dataset.icon] || ''); });
    const updateCount = () => $$('.cart-count').forEach((el) => { el.textContent = cart.count(); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
    $$('.cart-count').forEach((el) => (el.textContent = cart.count()));
    document.addEventListener('cart:change', updateCount);
    me().then((u) => $$('[data-account-label]').forEach((el) => (el.textContent = u ? `Hi, ${u.name.split(' ')[0]}` : 'Log in')));
    try {
      const c = await config();
      $$('[data-wa-link]').forEach((a) => (a.href = `https://wa.me/${c.whatsappNumber}?text=${encodeURIComponent(a.dataset.waLink || 'Hi Jazz! I have a question about press-on nails.')}`));
      $$('[data-wa-number]').forEach((el) => (el.textContent = '+' + c.whatsappNumber.replace(/^(\d{2})(\d{5})(\d{5})$/, '$1 $2 $3')));
      $$('[data-insta-link]').forEach((a) => (a.href = `https://instagram.com/${c.instagram}`));
      $$('[data-insta]').forEach((el) => (el.textContent = '@' + c.instagram));
      $$('[data-ship]').forEach((el) => (el.textContent = rupee(c.shippingFee)));
      $$('[data-days]').forEach((el) => (el.textContent = c.deliveryDays));
      $$('[data-fee]').forEach((el) => (el.textContent = rupee(c.customizationFee)));
      const r = $('#ribbonTrack');
      if (r) {
        const bits = [c.announcement, 'Handmade in Meerut', `Custom fit & design +${rupee(c.customizationFee)}`, 'Order on WhatsApp'].filter(Boolean);
        r.innerHTML = [...bits, ...bits].map((b) => `<span>${esc(b)}</span>`).join('');
      }
    } catch { /* offline */ }
    reveal();
  }

  window.NBJ = { $, $$, api, config, me, cart, toast, rupee, esc, reveal, icons };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initChrome); else initChrome();
})();
