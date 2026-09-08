// ===== CONFIG =====
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxgERuu0R3Y1jYnOBZ8HARq_64UmBuUG_G9J_QNjg_FCokcff9bzo23fCA0n9UXvG_b/exec';

// ===== STATE =====
let allLoans = [];
let allEquipment = [];
let isAdmin = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initLogin();
  // Check session
  if (sessionStorage.getItem('adminAuth')) {
    isAdmin = true;
    showAdminPanel();
  }
});

// ===== TABS =====
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ===== LOGIN =====
function initLogin() {
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const pass = document.getElementById('adminPassword').value.trim();
    if (!pass) return;

    showLoading(true);
    try {
      const res = await apiPost({ action: 'adminLogin', password: pass });
      if (res.status === 'ok') {
        isAdmin = true;
        sessionStorage.setItem('adminAuth', 'true');
        showAdminPanel();
      } else {
        const err = document.getElementById('loginError');
        err.textContent = res.message || 'รหัสผ่านไม่ถูกต้อง';
        err.style.display = 'block';
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      showLoading(false);
    }
  });

  document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
}

function showAdminPanel() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadLoans();
  loadEquipment();
  loadSettings();
}

// ===== LOANS =====
async function loadLoans() {
  try {
    const res = await apiGet({ action: 'getLoans' });
    if (res.status === 'ok') {
      allLoans = res.loans;
      renderLoans(allLoans);
    }
  } catch (err) {
    console.error('loadLoans error:', err);
  }
}

function renderLoans(loans) {
  const filter = document.getElementById('filterStatus').value;
  let filtered = loans;
  if (filter !== 'all') {
    filtered = loans.filter(l => l.status === filter);
  }

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const body = document.getElementById('loansBody');
  const noLoans = document.getElementById('noLoans');

  if (filtered.length === 0) {
    body.innerHTML = '';
    noLoans.style.display = 'block';
    return;
  }

  noLoans.style.display = 'none';
  body.innerHTML = filtered.map(loan => {
    const photoHtml = loan.photoUrl
      ? `<img src="${loan.photoUrl}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;cursor:pointer;" onclick="viewPhoto('${loan.photoUrl.replace(/'/g, "\\'")}')">`
      : '<span style="color:#999;">-</span>';

    return `
      <tr>
        <td>${photoHtml}</td>
        <td><code style="font-size:0.75rem;">${loan.id}</code></td>
        <td><strong>${loan.name}</strong></td>
        <td>${loan.phone || '-'}</td>
        <td>${loan.equipmentName}</td>
        <td>${formatDate(loan.date)}</td>
        <td>${loan.timeSlot}</td>
        <td><span class="status-badge ${loan.status === 'borrowed' ? 'status-borrowed' : 'status-returned'}">${loan.status === 'borrowed' ? 'กำลังยืม' : 'คืนแล้ว'}</span></td>
        <td>
          ${loan.status === 'borrowed' ? `
            <button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem;" onclick="returnLoan('${loan.id}')">คืน</button>
          ` : ''}
          <button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem;" onclick="deleteLoan('${loan.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function returnLoan(loanId) {
  if (!confirm('ยืนยันการคืนอุปกรณ์?')) return;
  showLoading(true);
  try {
    await apiPost({ action: 'returnLoan', loanId });
    loadLoans();
    loadEquipment();
  } catch (err) {
    alert('เกิดข้อผิดพลาด');
  } finally {
    showLoading(false);
  }
}

async function deleteLoan(loanId) {
  if (!confirm('ยืนยันการลบรายการนี้?')) return;
  showLoading(true);
  try {
    await apiPost({ action: 'deleteLoan', loanId });
    loadLoans();
    loadEquipment();
  } catch (err) {
    alert('เกิดข้อผิดพลาด');
  } finally {
    showLoading(false);
  }
}

function viewPhoto(url) {
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>รูปผู้ยืม</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#111;}img{max-width:95vw;max-height:95vh;object-fit:contain;}</style></head><body><img src="${url}"></body></html>`);
}

// Filter change
document.getElementById('filterStatus')?.addEventListener('change', () => renderLoans(allLoans));

// ===== EQUIPMENT =====
async function loadEquipment() {
  try {
    const res = await apiGet({ action: 'getEquipment' });
    if (res.status === 'ok') {
      allEquipment = res.equipment;
      renderEquipmentAdmin(allEquipment);
    }
  } catch (err) {
    console.error('loadEquipment error:', err);
  }
}

function renderEquipmentAdmin(list) {
  const body = document.getElementById('equipmentBody');
  if (list.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="loading-text">ยังไม่มีอุปกรณ์</td></tr>';
    return;
  }

  body.innerHTML = list.map(eq => {
    const imgHtml = eq.imageUrl
      ? `<img src="${eq.imageUrl}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">`
      : '🏅';

    return `
      <tr>
        <td>${imgHtml}</td>
        <td><code style="font-size:0.75rem;">${eq.id}</code></td>
        <td><strong>${eq.name}</strong></td>
        <td>${eq.description || '-'}</td>
        <td>${eq.quantity}</td>
        <td>${eq.available}</td>
        <td><span class="status-badge ${eq.available > 0 ? 'status-returned' : 'status-borrowed'}">${eq.available > 0 ? 'ว่าง' : 'ไม่ว่าง'}</span></td>
        <td>
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="editEquipment('${eq.id}')">✏️</button>
          <button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem;" onclick="deleteEquipment('${eq.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function showAddEquipment() {
  document.getElementById('eqModalTitle').textContent = 'เพิ่มอุปกรณ์';
  document.getElementById('eqName').value = '';
  document.getElementById('eqDesc').value = '';
  document.getElementById('eqQty').value = '1';
  document.getElementById('eqImage').value = '';
  document.getElementById('eqEditId').value = '';
  document.getElementById('eqModal').style.display = 'flex';
}

function editEquipment(eqId) {
  const eq = allEquipment.find(e => e.id === eqId);
  if (!eq) return;

  document.getElementById('eqModalTitle').textContent = 'แก้ไขอุปกรณ์';
  document.getElementById('eqName').value = eq.name;
  document.getElementById('eqDesc').value = eq.description || '';
  document.getElementById('eqQty').value = eq.quantity;
  document.getElementById('eqImage').value = eq.imageUrl || '';
  document.getElementById('eqEditId').value = eq.id;
  document.getElementById('eqModal').style.display = 'flex';
}

function closeEqModal() {
  document.getElementById('eqModal').style.display = 'none';
}

async function saveEquipment() {
  const eqId = document.getElementById('eqEditId').value;
  const data = {
    name: document.getElementById('eqName').value.trim(),
    description: document.getElementById('eqDesc').value.trim(),
    quantity: parseInt(document.getElementById('eqQty').value) || 1,
    imageUrl: document.getElementById('eqImage').value.trim()
  };

  if (!data.name) return alert('กรุณากรอกชื่ออุปกรณ์');

  showLoading(true);
  try {
    if (eqId) {
      await apiPost({ action: 'updateEquipment', equipmentId: eqId, ...data });
    } else {
      await apiPost({ action: 'addEquipment', ...data });
    }
    closeEqModal();
    loadEquipment();
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + (err.message || ''));
  } finally {
    showLoading(false);
  }
}

async function deleteEquipment(eqId) {
  if (!confirm('ยืนยันการลบอุปกรณ์นี้?')) return;
  showLoading(true);
  try {
    await apiPost({ action: 'deleteEquipment', equipmentId: eqId });
    loadEquipment();
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + (err.message || ''));
  } finally {
    showLoading(false);
  }
}

// ===== SETTINGS =====
async function loadSettings() {
  try {
    const res = await apiGet({ action: 'getSettings' });
    if (res.status === 'ok') {
      const s = res.settings;
      document.getElementById('setSiteName').value = s.siteName || '';
      document.getElementById('setSiteDesc').value = s.siteDescription || '';
      document.getElementById('setLogoUrl').value = s.logoUrl || '';
      document.getElementById('setPrimaryColor').value = s.primaryColor || '#4f46e5';
      document.getElementById('setPrimaryColorText').value = s.primaryColor || '#4f46e5';
      document.getElementById('setAccentColor').value = s.accentColor || '#10b981';
      document.getElementById('setAccentColorText').value = s.accentColor || '#10b981';
      document.getElementById('setAdminPass').value = s.adminPassword || '';
      document.getElementById('setMaxDays').value = s.maxBorrowDays || '7';

      if (s.logoUrl) {
        const preview = document.getElementById('logoPreview');
        preview.src = s.logoUrl;
        preview.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

function previewLogo(url) {
  const preview = document.getElementById('logoPreview');
  if (url) {
    preview.src = url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

function syncColor(type, value) {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    if (type === 'primary') {
      document.getElementById('setPrimaryColor').value = value;
    } else {
      document.getElementById('setAccentColor').value = value;
    }
  }
}

document.getElementById('setPrimaryColor')?.addEventListener('input', function() {
  document.getElementById('setPrimaryColorText').value = this.value;
});

document.getElementById('setAccentColor')?.addEventListener('input', function() {
  document.getElementById('setAccentColorText').value = this.value;
});

async function saveSettings() {
  const settings = {
    siteName: document.getElementById('setSiteName').value.trim(),
    siteDescription: document.getElementById('setSiteDesc').value.trim(),
    logoUrl: document.getElementById('setLogoUrl').value.trim(),
    primaryColor: document.getElementById('setPrimaryColor').value,
    accentColor: document.getElementById('setAccentColor').value,
    adminPassword: document.getElementById('setAdminPass').value,
    maxBorrowDays: document.getElementById('setMaxDays').value
  };

  showLoading(true);
  try {
    await apiPost({ action: 'updateSettings', settings });
    alert('บันทึกการตั้งค่าสำเร็จ!');
  } catch (err) {
    alert('เกิดข้อผิดพลาด');
  } finally {
    showLoading(false);
  }
}

// ===== HELPERS =====
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

async function apiGet(params) {
  const url = new URL(WEB_APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(data) {
  // GAS does not support CORS preflight, so we POST with "no-cors".
  // The backend writes on its side; we can't read the response body (opaque),
  // so any error is surfaced by re-fetching data afterwards (GET crosses CORS).
  await fetch(WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  return { status: 'ok' };
}
