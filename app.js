/* ============================================================
   PedidoRapido — Application Logic
   ============================================================ */

// ── Storage ────────────────────────────────────────────────────
const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

// ── State ──────────────────────────────────────────────────────
let orders = DB.get('pedidorapido_orders') || [];
let currentPage = 'dashboard';

function saveOrders() {
  DB.set('pedidorapido_orders', orders);
}

// ── Helpers ────────────────────────────────────────────────────
function genId() {
  return '#ORD-' + String(Math.floor(1000 + Math.random() * 9000));
}

function formatCurrency(n) {
  return '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status) {
  return { pending: 'Pendiente', process: 'En Proceso', delivered: 'Entregado' }[status] || status;
}

function statusClass(status) {
  return { pending: 'pending', process: 'process', delivered: 'delivered' }[status] || '';
}

function isToday(ts) {
  const d = new Date(ts), now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function todaysOrders() {
  return orders.filter(o => isToday(o.createdAt));
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = { success: 'check_circle', error: 'error', info: 'info' }[type] || 'info';
  t.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span> ${escHtml(msg)}`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('hiding');
    t.addEventListener('animationend', () => t.remove());
  }, 3200);
}

// ── Confirm Modal ──────────────────────────────────────────────
function showConfirm(msg, onYes) {
  const backdrop = document.getElementById('confirm-backdrop');
  document.getElementById('confirm-msg').textContent = msg;
  backdrop.classList.add('open');
  const yesBtn = document.getElementById('confirm-yes');
  const handler = () => {
    backdrop.classList.remove('open');
    yesBtn.removeEventListener('click', handler);
    onYes();
  };
  yesBtn.addEventListener('click', handler);
  document.getElementById('confirm-no').onclick = () => {
    backdrop.classList.remove('open');
    yesBtn.removeEventListener('click', handler);
  };
}

// ── Navigation ─────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  closeMobileSidebar();
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':   renderDashboard();   break;
    case 'orders':      renderOrders();      break;
    case 'new-order':   renderNewOrder();    break;
    case 'history':     renderHistory();     break;
  }
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const tod = todaysOrders();
  const total = tod.reduce((s, o) => s + o.total, 0);
  const prev = 22; // simulated previous day

  document.getElementById('dash-total-orders').textContent = tod.length;
  document.getElementById('dash-delta').textContent = tod.length > prev ? `+${tod.length - prev} vs ayer` : `${tod.length - prev} vs ayer`;
  document.getElementById('dash-revenue').textContent = formatCurrency(total);

  // Render recent orders table (last 5)
  const tbody = document.getElementById('dash-orders-tbody');
  const recent = [...tod].reverse().slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-symbols-outlined">receipt_long</span><p>No hay pedidos hoy</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(o => `
    <tr>
      <td class="order-id">${escHtml(o.id)}</td>
      <td class="client-cell"><div class="name">${escHtml(o.client)}</div></td>
      <td class="amount-cell">${formatCurrency(o.total)}</td>
      <td><span class="badge ${statusClass(o.status)}"><span class="dot"></span>${statusLabel(o.status)}</span></td>
      <td><div class="row-actions">
        <button class="row-btn view" onclick="navigate('orders')" title="Ver pedidos"><span class="material-symbols-outlined">arrow_forward</span></button>
      </div></td>
    </tr>
  `).join('');

  // Summary numbers on dashboard
  document.getElementById('dash-summary-orders').textContent = tod.length;
  document.getElementById('dash-summary-revenue').textContent = formatCurrency(total);
}

// ── Orders Page ────────────────────────────────────────────────
function renderOrders() {
  const tod = todaysOrders();
  document.getElementById('orders-count-pending').textContent   = tod.filter(o => o.status === 'pending').length;
  document.getElementById('orders-count-process').textContent   = tod.filter(o => o.status === 'process').length;
  document.getElementById('orders-count-delivered').textContent = tod.filter(o => o.status === 'delivered').length;

  const tbody = document.getElementById('orders-tbody');
  if (tod.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="material-symbols-outlined">inbox</span><p>No hay pedidos registrados hoy</p><small>Crea uno nuevo para comenzar</small></div></td></tr>`;
    return;
  }
  tbody.innerHTML = tod.map(o => `
    <tr data-order-id="${escHtml(o.id)}">
      <td class="order-id">${escHtml(o.id)}</td>
      <td>
        <div class="client-with-avatar">
          <div class="avatar-initials">${getInitials(o.client)}</div>
          <div class="client-cell"><div class="name">${escHtml(o.client)}</div></div>
        </div>
      </td>
      <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(o.products.map(p => `${p.qty}x ${p.name}`).join(', '))}</td>
      <td class="amount-cell">${formatCurrency(o.total)}</td>
      <td class="status-cell" id="status-cell-${escHtml(o.id).replace('#','').replace('-','')}">
        <button class="badge ${statusClass(o.status)}" onclick="toggleStatusDropdown('${escHtml(o.id)}')">
          <span class="dot"></span>${statusLabel(o.status)}
          <span class="material-symbols-outlined" style="font-size:14px;margin-left:2px">expand_more</span>
        </button>
        <div class="status-dropdown" id="sd-${escHtml(o.id).replace('#','').replace('-','')}">
          ${['pending','process','delivered'].filter(s => s !== o.status).map(s => `
            <button onclick="changeStatus('${escHtml(o.id)}','${s}')">
              <span class="dot badge ${s}" style="width:8px;height:8px;padding:0;border:none;background:currentColor;border-radius:50%"></span>
              ${statusLabel(s)}
            </button>
          `).join('')}
        </div>
      </td>
      <td>
        <div class="row-actions">
          <button class="row-btn delete" onclick="deleteOrder('${escHtml(o.id)}')" title="Eliminar"><span class="material-symbols-outlined">delete</span></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleStatusDropdown(orderId) {
  const cleanId = orderId.replace('#','').replace('-','');
  const dd = document.getElementById('sd-' + cleanId);
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  document.querySelectorAll('.status-dropdown.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) dd.classList.add('open');
}

function changeStatus(orderId, newStatus) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.status = newStatus;
  saveOrders();
  document.querySelectorAll('.status-dropdown.open').forEach(el => el.classList.remove('open'));
  renderOrders();
  renderDashboard();
  showToast(`Estado actualizado a "${statusLabel(newStatus)}"`, 'success');
}

function deleteOrder(orderId) {
  showConfirm(`¿Eliminar el pedido ${orderId}? Esta acción no se puede deshacer.`, () => {
    orders = orders.filter(o => o.id !== orderId);
    saveOrders();
    renderOrders();
    renderDashboard();
    showToast('Pedido eliminado', 'info');
  });
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.status-cell')) {
    document.querySelectorAll('.status-dropdown.open').forEach(el => el.classList.remove('open'));
  }
});

// ── New Order Form ─────────────────────────────────────────────
let formProducts = [{ name: '', qty: 1, price: 0 }];

function renderNewOrder() {
  renderProductsList();
  calcTotal();
}

function renderProductsList() {
  const container = document.getElementById('products-list');
  container.innerHTML = formProducts.map((p, i) => `
    <div class="product-row">
      <input class="form-input" type="text" placeholder="Nombre del producto" value="${escHtml(p.name)}"
        oninput="formProducts[${i}].name = this.value" />
      <input class="form-input" type="number" placeholder="Cant." min="1" value="${p.qty}"
        oninput="formProducts[${i}].qty = parseInt(this.value)||1; calcTotal()" />
      <input class="form-input" type="number" placeholder="Precio" min="0" step="0.01" value="${p.price || ''}"
        oninput="formProducts[${i}].price = parseFloat(this.value)||0; calcTotal()" />
      <button class="remove-product-btn" onclick="removeProduct(${i})" ${formProducts.length === 1 ? 'disabled style="opacity:.3;cursor:default"' : ''}>
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  `).join('');
}

function addProduct() {
  formProducts.push({ name: '', qty: 1, price: 0 });
  renderProductsList();
}

function removeProduct(i) {
  if (formProducts.length <= 1) return;
  formProducts.splice(i, 1);
  renderProductsList();
  calcTotal();
}

function calcTotal() {
  const total = formProducts.reduce((s, p) => s + (p.qty * p.price), 0);
  document.getElementById('order-total-display').textContent = formatCurrency(total);
  return total;
}

function submitOrder(e) {
  e.preventDefault();
  const clientName = document.getElementById('order-client').value.trim();
  if (!clientName) { showToast('Ingresa el nombre del cliente', 'error'); return; }
  const validProducts = formProducts.filter(p => p.name.trim());
  if (validProducts.length === 0) { showToast('Agrega al menos un producto', 'error'); return; }

  const total = calcTotal();
  const order = {
    id: genId(),
    client: clientName,
    products: validProducts.map(p => ({ name: p.name.trim(), qty: p.qty, price: p.price })),
    total,
    status: 'pending',
    createdAt: Date.now()
  };
  orders.push(order);
  saveOrders();

  // Reset form
  document.getElementById('order-client').value = '';
  document.getElementById('order-notes').value = '';
  formProducts = [{ name: '', qty: 1, price: 0 }];
  renderProductsList();
  calcTotal();

  showToast(`Pedido ${order.id} registrado exitosamente`, 'success');
  navigate('orders');
}

// ── History Page ───────────────────────────────────────────────
let selectedClient = null;

function renderHistory() {
  renderHistoryResults(null);
}

function searchClients(q) {
  const drop = document.getElementById('client-search-drop');
  if (!q.trim()) { drop.classList.remove('open'); return; }
  const clients = [...new Set(orders.map(o => o.client))].filter(c => c.toLowerCase().includes(q.toLowerCase()));
  if (clients.length === 0) { drop.classList.remove('open'); return; }
  drop.innerHTML = clients.map(c => `
    <div class="search-result-item" onclick="selectClient('${escHtml(c)}')">
      <div class="avatar-initials">${getInitials(c)}</div>
      ${escHtml(c)}
    </div>
  `).join('');
  drop.classList.add('open');
}

function selectClient(name) {
  selectedClient = name;
  document.getElementById('client-search-input').value = name;
  document.getElementById('client-search-drop').classList.remove('open');
  renderHistoryResults(name);
}

function renderHistoryResults(clientName) {
  const resultsSection = document.getElementById('history-results');

  if (!clientName) {
    // Show all unique clients as cards
    const clients = [...new Set(orders.map(o => o.client))];
    if (clients.length === 0) {
      resultsSection.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state">
        <span class="material-symbols-outlined">manage_search</span>
        <p>Busca un cliente para ver su historial</p>
        <small>O espera a que haya pedidos registrados</small>
      </div></div></div>`;
      return;
    }
    resultsSection.innerHTML = clients.slice(0, 8).map(c => {
      const clientOrders = orders.filter(o => o.client === c);
      const spent = clientOrders.reduce((s, o) => s + o.total, 0);
      return `<div class="card" style="cursor:pointer" onclick="selectClient('${escHtml(c)}')">
        <div class="card-body" style="display:flex;align-items:center;gap:16px">
          <div class="avatar-initials" style="width:44px;height:44px;font-size:16px">${getInitials(c)}</div>
          <div style="flex:1">
            <div style="font-weight:600">${escHtml(c)}</div>
            <div style="font-size:12px;color:var(--outline)">${clientOrders.length} pedidos · ${formatCurrency(spent)} total</div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--outline)">chevron_right</span>
        </div>
      </div>`;
    }).join('');
    return;
  }

  const clientOrders = orders.filter(o => o.client === clientName).sort((a, b) => b.createdAt - a.createdAt);
  const totalSpent = clientOrders.reduce((s, o) => s + o.total, 0);

  if (clientOrders.length === 0) {
    resultsSection.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state">
      <span class="material-symbols-outlined">person_search</span>
      <p>No se encontró historial para "${escHtml(clientName)}"</p>
    </div></div></div>`;
    return;
  }

  // Profile card + orders
  resultsSection.innerHTML = `
    <div class="card">
      <div class="card-body profile-card">
        <div class="profile-header">
          <div class="profile-avatar">${getInitials(clientName)}</div>
          <div class="profile-info">
            <h3>${escHtml(clientName)}</h3>
            <p>Cliente registrado</p>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-box"><span class="val">${clientOrders.length}</span><span class="lbl">Pedidos Totales</span></div>
          <div class="stat-box"><span class="val">${formatCurrency(totalSpent)}</span><span class="lbl">Gasto Total</span></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="text-headline-sm">Historial de Pedidos</span>
        <span style="font-size:13px;color:var(--outline)">${clientOrders.length} pedidos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ID de Pedido</th>
            <th>Fecha</th>
            <th>Productos</th>
            <th>Estado</th>
            <th class="text-right">Total</th>
          </tr></thead>
          <tbody>
            ${clientOrders.map(o => `
              <tr>
                <td class="order-id">${escHtml(o.id)}</td>
                <td>${formatDate(o.createdAt)}</td>
                <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(o.products.map(p => `${p.qty}x ${p.name}`).join(', '))}</td>
                <td><span class="badge ${statusClass(o.status)}"><span class="dot"></span>${statusLabel(o.status)}</span></td>
                <td class="text-right amount-cell">${formatCurrency(o.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Export CSV ─────────────────────────────────────────────────
function exportCSV() {
  const tod = todaysOrders();
  if (tod.length === 0) { showToast('No hay pedidos para exportar', 'error'); return; }
  const header = ['ID Pedido', 'Cliente', 'Productos', 'Cantidades', 'Total', 'Estado', 'Fecha'];
  const rows = tod.map(o => [
    o.id,
    o.client,
    o.products.map(p => p.name).join(' | '),
    o.products.map(p => p.qty).join(' | '),
    o.total.toFixed(2),
    statusLabel(o.status),
    formatDate(o.createdAt)
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo CSV exportado exitosamente', 'success');
}

// ── Mobile Sidebar ─────────────────────────────────────────────
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Seed sample data if empty
  if (orders.length === 0) {
    const now = Date.now();
    orders = [
      { id: '#ORD-9021', client: 'Elena Rodríguez', products: [{ name: 'Sillas de Oficina', qty: 2, price: 45 }, { name: 'Tapete de Escritorio', qty: 1, price: 55 }], total: 145, status: 'delivered', createdAt: now - 7200000 },
      { id: '#ORD-9022', client: 'Carlos Gómez',    products: [{ name: 'Monitor LG 27"', qty: 1, price: 82.5 }], total: 82.5, status: 'process', createdAt: now - 5400000 },
      { id: '#ORD-9023', client: 'Ana Martínez',    products: [{ name: 'Teclado Mecánico', qty: 1, price: 120 }, { name: 'Mouse Ergonómico', qty: 1, price: 90 }], total: 210, status: 'pending', createdAt: now - 3600000 },
      { id: '#ORD-9024', client: 'Robert King',     products: [{ name: 'Lámpara de Escritorio', qty: 3, price: 150 }], total: 450, status: 'delivered', createdAt: now - 1800000 },
      { id: '#ORD-9025', client: 'Carlos Gómez',    products: [{ name: 'Soporte Monitor', qty: 2, price: 55 }], total: 110, status: 'pending', createdAt: now - 900000 },
    ];
    saveOrders();
  }

  navigate('dashboard');

  // Mobile sidebar toggle
  document.getElementById('hamburger-btn').addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);

  // New order form
  document.getElementById('new-order-form').addEventListener('submit', submitOrder);

  // Add product button
  document.getElementById('add-product-btn').addEventListener('click', addProduct);

  // Export buttons
  document.querySelectorAll('[data-action="export"]').forEach(btn => {
    btn.addEventListener('click', exportCSV);
  });

  // History search
  const histInput = document.getElementById('client-search-input');
  if (histInput) {
    histInput.addEventListener('input', (e) => searchClients(e.target.value));
    histInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('client-search-drop').classList.remove('open'); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.client-search-wrapper')) {
        document.getElementById('client-search-drop').classList.remove('open');
      }
    });
  }

  // Global search bar
  const topSearch = document.getElementById('top-search');
  if (topSearch) {
    topSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = topSearch.value.trim();
        if (q) {
          navigate('history');
          setTimeout(() => {
            document.getElementById('client-search-input').value = q;
            searchClients(q);
          }, 50);
        }
      }
    });
  }

  // New order quick button on dashboard
  document.querySelectorAll('[data-action="new-order"]').forEach(btn => {
    btn.addEventListener('click', () => navigate('new-order'));
  });
});
