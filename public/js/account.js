// Customer account: log in / sign up, profile, saved address, order history, password.
(function () {
  const { $, $$, api, me, toast, rupee, esc } = window.NBJ;
  const root = $('#root');
  const next = new URLSearchParams(location.search).get('next');
  let mode = 'login';

  async function start() {
    const user = await me(true);
    if (user) return renderAccount(user);
    renderAuth();
  }

  // ---------- log in / sign up ----------
  function renderAuth() {
    root.innerHTML = `<div class="auth-wrap">
      <p class="eyebrow">My account</p>
      <h1>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p class="muted" style="margin-top:8px">Save your address, check out faster and track every order.</p>
      <div class="panel auth-card">
        <div class="tabs" role="tablist" style="margin-bottom:16px">
          <button class="chip" type="button" data-mode="login" aria-pressed="${mode === 'login'}">Log in</button>
          <button class="chip" type="button" data-mode="signup" aria-pressed="${mode === 'signup'}">Sign up</button>
        </div>
        <form class="form" id="authForm" novalidate>
          ${mode === 'signup' ? '<label>Full name<input id="aName" autocomplete="name" required></label>' : ''}
          <label>Mobile number<input id="aPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98XXXXXXXX" required></label>
          ${mode === 'signup' ? '<label>Email (optional)<input id="aEmail" type="email" autocomplete="email"></label>' : ''}
          <label>Password<input id="aPass" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6"></label>
          <p class="errors" id="aErr" role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">${mode === 'login' ? 'Log in' : 'Create account'}</button>
          ${mode === 'login' ? '<p class="fine">Forgot your password? Message Jazz on WhatsApp and she\'ll reset it for you.</p>' : ''}
        </form>
      </div></div>`;
    setTimeout(() => (mode === 'signup' ? $('#aName') : $('#aPhone')).focus(), 50);
  }

  async function submitAuth(e) {
    e.preventDefault();
    const body = { phone: $('#aPhone').value, password: $('#aPass').value };
    if (mode === 'signup') Object.assign(body, { name: $('#aName').value, email: $('#aEmail').value });
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const { user } = await api(`/api/auth/${mode}`, { method: 'POST', body });
      await me(true);
      toast(mode === 'login' ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Account created');
      if (next === 'checkout') { location.href = '/#cart'; return; }
      $$('[data-account-label]').forEach((el) => (el.textContent = `Hi, ${user.name.split(' ')[0]}`));
      renderAccount(user);
    } catch (err) { $('#aErr').innerHTML = err.errors.map((x) => `<span>${esc(x)}</span>`).join(''); btn.disabled = false; }
  }

  // ---------- account ----------
  const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
  async function renderAccount(user) {
    root.innerHTML = `<p class="eyebrow">My account</p><h1>Hi, ${esc(user.name.split(' ')[0])}</h1>
      <div class="acct">
        <div style="display:grid;gap:18px">
          <form class="panel form" id="profileForm" novalidate>
            <div style="display:flex;gap:14px;align-items:center"><div class="avatar">${esc(user.name[0] || 'J').toUpperCase()}</div><div><b>${esc(user.name)}</b><div class="fine">+91 ${esc(user.phone)}</div></div></div>
            <h3 style="font-size:22px;margin-top:6px">Profile &amp; address</h3>
            <label>Full name<input id="pName" autocomplete="name" value="${esc(user.name)}"></label>
            <label>Email<input id="pEmail" type="email" autocomplete="email" value="${esc(user.email)}"></label>
            <label>House no., street, area<textarea id="pAddress" rows="2" autocomplete="street-address">${esc(user.address)}</textarea></label>
            <div class="row2"><label>City<input id="pCity" value="${esc(user.city)}"></label><label>State<input id="pState" value="${esc(user.state)}"></label></div>
            <label>PIN code<input id="pPin" inputmode="numeric" maxlength="6" value="${esc(user.pincode)}"></label>
            <button class="btn btn-primary" type="submit">Save changes</button>
          </form>
          <form class="panel form" id="pwForm" novalidate>
            <h3 style="font-size:22px">Change password</h3>
            <label>Current password<input id="pwOld" type="password" autocomplete="current-password"></label>
            <label>New password<input id="pwNew" type="password" autocomplete="new-password" minlength="6"></label>
            <p class="errors" id="pwErr"></p>
            <button class="btn btn-ghost" type="submit">Update password</button>
          </form>
          <button class="btn btn-ghost" type="button" id="logout">Log out</button>
        </div>
        <div>
          <h2 style="font-size:32px;margin-bottom:14px">My orders</h2>
          <div class="orders" id="orders"><div class="skeleton" style="aspect-ratio:auto;height:140px"></div></div>
        </div>
      </div>`;
    try {
      const orders = await api('/api/me/orders');
      $('#orders').innerHTML = orders.length ? orders.map((o, i) => {
        const step = o.status === 'paid' ? 1 : STEPS.indexOf(o.status);
        return `<article class="panel order" style="animation-delay:${i * 60}ms">
          <div class="order-head"><b class="order-id">${esc(o.id)}</b><span class="status ${esc(o.status)}">${esc(o.status === 'new' ? 'Placed' : o.status)}</span></div>
          <p class="fine" style="margin-top:6px">${new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Payment ${esc(o.paymentStatus)}</p>
          ${o.status !== 'cancelled' ? `<div class="steps-bar">${STEPS.map((_, k) => `<span class="${k <= step ? 'on' : ''}"></span>`).join('')}</div><div class="steps-lbl"><span>Placed</span><span>Confirmed</span><span>Shipped</span><span>Delivered</span></div>` : ''}
          ${o.tracking ? `<p class="notice" style="margin-top:10px">Tracking: <b>${esc(o.tracking)}</b></p>` : ''}
          <div class="order-items">${o.items.map((it) => `<span>${esc(it.name)} × ${it.qty}${it.custom ? ' · custom' : ` · size ${esc(it.size)}`}</span>`).join('')}</div>
          <div class="order-foot"><span>Total (incl. ${rupee(o.shipping)} shipping)</span><span>${rupee(o.total)}</span></div>
        </article>`;
      }).join('') : '<div class="empty">No orders yet. <a href="/#shop">Browse designs</a> to place your first one.</div>';
    } catch { $('#orders').innerHTML = '<p class="empty">We couldn\'t load your orders. Refresh to try again.</p>'; }
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; renderAuth(); }
    if (b.id === 'logout') { await api('/api/auth/logout', { method: 'POST' }); await me(true); $$('[data-account-label]').forEach((el) => (el.textContent = 'Log in')); toast('Logged out'); mode = 'login'; renderAuth(); }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'authForm') return submitAuth(e);
    if (e.target.id === 'profileForm') {
      e.preventDefault();
      try {
        const { user } = await api('/api/me', { method: 'PUT', body: { name: $('#pName').value, email: $('#pEmail').value, address: $('#pAddress').value, city: $('#pCity').value, state: $('#pState').value, pincode: $('#pPin').value } });
        await me(true); toast('Profile saved'); renderAccount(user);
      } catch (err) { toast(err.message); }
    }
    if (e.target.id === 'pwForm') {
      e.preventDefault();
      try { await api('/api/me/password', { method: 'PUT', body: { current: $('#pwOld').value, next: $('#pwNew').value } }); e.target.reset(); $('#pwErr').textContent = ''; toast('Password updated'); }
      catch (err) { $('#pwErr').textContent = err.message; }
    }
  });

  start();
})();
