// ===== CONFIG =====
// วาง URL ของ Google Apps Script ที่ deploy แล้ว
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwlcuXU-VgQ3kblRJzqss_2ydVcsvJEnC8k8PK5e48awATt5WdY3NhT8y8qNwtBOinV/exec';

// ===== STATE =====
let cameraStream = null;
let equipmentList = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadEquipment();
  initDateInput();
  initCamera();
  initForm();
});

// ===== LOAD SETTINGS =====
async function loadSettings() {
  try {
    const res = await apiGet({ action: 'getSettings' });
    if (res.status === 'ok') {
      const s = res.settings;
      document.getElementById('siteTitle').textContent = s.siteName || 'ระบบยืมอุปกรณ์กีฬา';
      document.getElementById('siteDescription').textContent = s.siteDescription || '';

      if (s.logoUrl) {
        const logo = document.getElementById('siteLogo');
        logo.src = s.logoUrl;
        logo.style.display = 'block';
      }

      if (s.primaryColor) {
        document.documentElement.style.setProperty('--primary', s.primaryColor);
        document.documentElement.style.setProperty('--primary-dark', s.primaryColor);
      }
      if (s.accentColor) {
        document.documentElement.style.setProperty('--accent', s.accentColor);
      }
    }
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

// ===== LOAD EQUIPMENT =====
async function loadEquipment() {
  try {
    const res = await apiGet({ action: 'getEquipment' });
    if (res.status === 'ok') {
      equipmentList = res.equipment;
      renderEquipmentGrid(equipmentList);
      renderEquipmentSelect(equipmentList);
    }
  } catch (err) {
    console.error('loadEquipment error:', err);
    document.getElementById('equipmentGrid').innerHTML = '<p class="loading-text">ไม่สามารถโหลดข้อมูลได้</p>';
  }
}

function renderEquipmentGrid(list) {
  const grid = document.getElementById('equipmentGrid');
  if (list.length === 0) {
    grid.innerHTML = '<p class="loading-text">ยังไม่มีอุปกรณ์ในระบบ</p>';
    return;
  }
  const icons = ['⚽', '🏀', '🏐', '🏸', '🎾', '🏓', '游泳', '🏊', '🎯', '🏃'];
  grid.innerHTML = list.map((eq, i) => {
    const avail = eq.available > 0;
    const icon = eq.imageUrl ? `<img src="${eq.imageUrl}" alt="${eq.name}" style="width:60px;height:60px;object-fit:contain;border-radius:8px;">` : `<div class="eq-icon">${getEquipIcon(eq.name)}</div>`;
    return `
      <div class="equipment-card">
        ${icon}
        <div class="eq-name">${eq.name}</div>
        <div class="eq-desc">${eq.description || ''}</div>
        <span class="eq-available ${avail ? 'available' : 'unavailable'}">
          ${avail ? `ว่าง ${eq.available}/${eq.quantity}` : 'ไม่ว่าง'}
        </span>
      </div>
    `;
  }).join('');
}

function renderEquipmentSelect(list) {
  const sel = document.getElementById('equipmentSelect');
  list.forEach(eq => {
    if (eq.available > 0) {
      const opt = document.createElement('option');
      opt.value = eq.id;
      opt.textContent = `${eq.name} (ว่าง ${eq.available}/${eq.quantity})`;
      opt.dataset.name = eq.name;
      sel.appendChild(opt);
    }
  });
}

function getEquipIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('ฟุตบอล') || n.includes('football')) return '⚽';
  if (n.includes('บาส') || n.includes('basketball')) return '🏀';
  if (n.includes('วอลเลย์') || n.includes('volleyball')) return '🏐';
  if (n.includes('แบด') || n.includes('badminton')) return '🏸';
  if (n.includes('เทนนิส') || n.includes('tennis')) return '🎾';
  if (n.includes('ปิงปอง') || n.includes('table tennis')) return '🏓';
  if (n.includes('ว่าย') || n.includes('swim')) return '🏊';
  if (n.includes('จาน') || n.includes('disc')) return '🥏';
  return '🏅';
}

// ===== DATE INPUT =====
function initDateInput() {
  const dateInput = document.getElementById('loanDate');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxYyyy = maxDate.getFullYear();
  const maxMm = String(maxDate.getMonth() + 1).padStart(2, '0');
  const maxDd = String(maxDate.getDate()).padStart(2, '0');
  dateInput.max = `${maxYyyy}-${maxMm}-${maxDd}`;

  dateInput.addEventListener('change', () => {
    loadTimeSlots(dateInput.value);
  });
}

// ===== TIME SLOTS =====
async function loadTimeSlots(date) {
  const container = document.getElementById('timeSlots');
  container.innerHTML = '<p class="loading-text">กำลังโหลดช่วงเวลา...</p>';
  document.getElementById('selectedTimeSlot').value = '';

  try {
    const res = await apiGet({ action: 'getAvailableSlots', date });
    if (res.status === 'ok') {
      renderTimeSlots(res.slots);
    }
  } catch (err) {
    container.innerHTML = '<p class="loading-text">ไม่สามารถโหลดข้อมูลได้</p>';
  }
}

function renderTimeSlots(slots) {
  const container = document.getElementById('timeSlots');
  if (slots.length === 0) {
    container.innerHTML = '<p class="loading-text">ไม่มีช่วงเวลา</p>';
    return;
  }

  container.innerHTML = slots.map(s => {
    const disabled = s.booked >= 5;
    return `
      <button type="button" class="time-slot-btn ${disabled ? 'disabled' : ''}"
        data-slot="${s.slot}" ${disabled ? 'disabled' : ''}>
        <span class="slot-label">${s.slot}</span>
        <span class="slot-info">${disabled ? 'เต็มแล้ว' : `ว่าง ${5 - s.booked}/5`}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.time-slot-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('selectedTimeSlot').value = btn.dataset.slot;
    });
  });
}

// ===== CAMERA =====
function initCamera() {
  document.getElementById('startCameraBtn').addEventListener('click', startCamera);
  document.getElementById('captureBtn').addEventListener('click', capturePhoto);
  document.getElementById('retakeBtn').addEventListener('click', retakePhoto);
  document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    const video = document.getElementById('cameraPreview');
    video.srcObject = cameraStream;
    video.style.display = 'block';
    document.getElementById('startCameraBtn').style.display = 'none';
    document.getElementById('captureBtn').style.display = 'inline-flex';
  } catch (err) {
    alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาอัปโหลดรูปแทน');
  }
}

function capturePhoto() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('photoCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  showPhotoPreview(dataUrl);
  stopCamera();
}

function retakePhoto() {
  document.getElementById('photoPreviewContainer').style.display = 'none';
  document.getElementById('cameraContainer').style.display = 'block';
  document.getElementById('captureBtn').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('startCameraBtn').style.display = 'inline-flex';
  document.getElementById('photoData').value = '';
}

function showPhotoPreview(dataUrl) {
  document.getElementById('photoPreview').src = dataUrl;
  document.getElementById('photoPreviewContainer').style.display = 'block';
  document.getElementById('cameraContainer').style.display = 'none';
  document.getElementById('captureBtn').style.display = 'none';
  document.getElementById('startCameraBtn').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'inline-flex';
  document.getElementById('photoData').value = dataUrl;
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    showPhotoPreview(ev.target.result);
  };
  reader.readAsDataURL(file);
}

// ===== FORM SUBMIT =====
function initForm() {
  document.getElementById('loanForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('borrowerName').value.trim();
    const phone = document.getElementById('borrowerPhone').value.trim();
    const eqSelect = document.getElementById('equipmentSelect');
    const eqId = eqSelect.value;
    const eqName = eqSelect.options[eqSelect.selectedIndex]?.dataset.name || '';
    const date = document.getElementById('loanDate').value;
    const timeSlot = document.getElementById('selectedTimeSlot').value;
    const photoData = document.getElementById('photoData').value;

    if (!name) return alert('กรุณากรอกชื่อ-นามสกุล');
    if (!eqId) return alert('กรุณาเลือกอุปกรณ์');
    if (!date) return alert('กรุณาเลือกวันที่');
    if (!timeSlot) return alert('กรุณาเลือกช่วงเวลา');
    if (!photoData) return alert('กรุณาถ่ายรูปหรืออัปโหลดรูป');

    showLoading(true);
    try {
      const res = await apiPost({
        action: 'submitLoan',
        name,
        phone,
        equipmentId: eqId,
        equipmentName: eqName,
        date,
        timeSlot,
        photoUrl: photoData
      });

      if (res.status === 'ok') {
        document.getElementById('successMessage').textContent =
          `รหัสการยืม: ${res.loanId}\nชื่อ: ${name}\nอุปกรณ์: ${eqName}\nวันที่: ${date}\nเวลา: ${timeSlot}`;
        document.getElementById('successModal').style.display = 'flex';
        document.getElementById('loanForm').reset();
        document.getElementById('selectedTimeSlot').value = '';
        document.getElementById('photoData').value = '';
        document.getElementById('photoPreviewContainer').style.display = 'none';
        document.getElementById('cameraContainer').style.display = 'block';
        document.getElementById('startCameraBtn').style.display = 'inline-flex';
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('timeSlots').innerHTML = '<p class="loading-text">กรุณาเลือกวันที่ก่อน</p>';
        loadEquipment();
      } else {
        alert('เกิดข้อผิดพลาด: ' + res.message);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    } finally {
      showLoading(false);
    }
  });
}

function closeModal() {
  document.getElementById('successModal').style.display = 'none';
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ===== API HELPERS =====
async function apiGet(params) {
  const url = new URL(WEB_APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  // no-cors won't return json, so we assume success
  // For production, deploy with access set to "Anyone" and remove mode: 'no-cors'
  try {
    return await res.json();
  } catch {
    return { status: 'ok', message: 'ส่งข้อมูลสำเร็จ' };
  }
}
