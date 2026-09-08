const SPREADSHEET_ID = '1fR2FqN3YKwFLUEub8eIRIAB9IAwbqj7QpAr1RN4vbs8';

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getSettings') {
    return jsonResponse(getSettings());
  }
  if (action === 'getLoans') {
    return jsonResponse(getLoans());
  }
  if (action === 'getEquipment') {
    return jsonResponse(getEquipment());
  }
  if (action === 'getAvailableSlots') {
    const date = e.parameter.date;
    return jsonResponse(getAvailableSlots(date));
  }

  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

function doPost(e) {
  const data = typeof e.postData.contents === 'string'
    ? JSON.parse(e.postData.contents)
    : e.parameter;
  const action = data.action;

  if (action === 'submitLoan') {
    return jsonResponse(submitLoan(data));
  }
  if (action === 'returnLoan') {
    return jsonResponse(returnLoan(data));
  }
  if (action === 'deleteLoan') {
    return jsonResponse(deleteLoan(data));
  }
  if (action === 'updateSettings') {
    return jsonResponse(updateSettings(data));
  }
  if (action === 'updateEquipment') {
    return jsonResponse(updateEquipment(data));
  }
  if (action === 'addEquipment') {
    return jsonResponse(addEquipment(data));
  }
  if (action === 'deleteEquipment') {
    return jsonResponse(deleteEquipment(data));
  }
  if (action === 'adminLogin') {
    return jsonResponse(adminLogin(data));
  }

  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Loans') {
      sheet.appendRow(['ID', 'Name', 'Phone', 'EquipmentID', 'EquipmentName', 'Date', 'TimeSlot', 'PhotoURL', 'Status', 'CreatedAt', 'ReturnedAt']);
    } else if (name === 'Settings') {
      sheet.appendRow(['Key', 'Value']);
      sheet.appendRow(['siteName', 'ระบบยืมอุปกรณ์กีฬา']);
      sheet.appendRow(['logoUrl', '']);
      sheet.appendRow(['primaryColor', '#4f46e5']);
      sheet.appendRow(['accentColor', '#10b981']);
      sheet.appendRow(['siteDescription', 'กรุณายืมอุปกรณ์กีฬาตามกฎระเบียบที่กำหนด']);
      sheet.appendRow(['adminPassword', 'admin123']);
      sheet.appendRow(['maxBorrowDays', '7']);
    } else if (name === 'Equipment') {
      sheet.appendRow(['ID', 'Name', 'Description', 'Quantity', 'Available', 'ImageUrl', 'Active']);
    }
  }
  return sheet;
}

function generateId() {
  return 'LOAN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
}

function generateEqId() {
  return 'EQ-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ===== SETTINGS =====
function getSettings() {
  const sheet = getSheet('Settings');
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return { status: 'ok', settings };
}

function updateSettings(data) {
  const sheet = getSheet('Settings');
  const existing = sheet.getDataRange().getValues();
  const updates = data.settings;

  for (const [key, value] of Object.entries(updates)) {
    let found = false;
    for (let i = 1; i < existing.length; i++) {
      if (existing[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value]);
    }
  }
  return { status: 'ok', message: 'Settings updated' };
}

// ===== LOANS =====
function submitLoan(data) {
  const sheet = getSheet('Loans');
  const id = generateId();
  const now = new Date().toISOString();

  sheet.appendRow([
    id,
    data.name,
    data.phone || '',
    data.equipmentId,
    data.equipmentName,
    data.date,
    data.timeSlot,
    data.photoUrl || '',
    'borrowed',
    now,
    ''
  ]);

  // Decrease available count
  decreaseAvailable(data.equipmentId);

  return { status: 'ok', message: 'ยืมอุปกรณ์สำเร็จ', loanId: id };
}

function getLoans() {
  const sheet = getSheet('Loans');
  const data = sheet.getDataRange().getValues();
  const loans = [];
  for (let i = 1; i < data.length; i++) {
    loans.push({
      id: data[i][0],
      name: data[i][1],
      phone: data[i][2],
      equipmentId: data[i][3],
      equipmentName: data[i][4],
      date: data[i][5],
      timeSlot: data[i][6],
      photoUrl: data[i][7],
      status: data[i][8],
      createdAt: data[i][9],
      returnedAt: data[i][10]
    });
  }
  return { status: 'ok', loans };
}

function returnLoan(data) {
  const sheet = getSheet('Loans');
  const data_range = sheet.getDataRange().getValues();

  for (let i = 1; i < data_range.length; i++) {
    if (data_range[i][0] === data.loanId) {
      sheet.getRange(i + 1, 9).setValue('returned');
      sheet.getRange(i + 1, 11).setValue(new Date().toISOString());
      increaseAvailable(data_range[i][3]);
      return { status: 'ok', message: 'คืนอุปกรณ์สำเร็จ' };
    }
  }
  return { status: 'error', message: 'ไม่พบรายการยืม' };
}

function deleteLoan(data) {
  const sheet = getSheet('Loans');
  const data_range = sheet.getDataRange().getValues();

  for (let i = 1; i < data_range.length; i++) {
    if (data_range[i][0] === data.loanId) {
      if (data_range[i][8] === 'borrowed') {
        increaseAvailable(data_range[i][3]);
      }
      sheet.deleteRow(i + 1);
      return { status: 'ok', message: 'ลบรายการสำเร็จ' };
    }
  }
  return { status: 'error', message: 'ไม่พบรายการ' };
}

// ===== EQUIPMENT =====
function getEquipment() {
  const sheet = getSheet('Equipment');
  const data = sheet.getDataRange().getValues();
  const equipment = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === true || data[i][6] === 'TRUE') {
      equipment.push({
        id: data[i][0],
        name: data[i][1],
        description: data[i][2],
        quantity: data[i][3],
        available: data[i][4],
        imageUrl: data[i][5],
        active: data[i][6]
      });
    }
  }
  return { status: 'ok', equipment };
}

function addEquipment(data) {
  const sheet = getSheet('Equipment');
  const id = generateEqId();
  sheet.appendRow([
    id,
    data.name,
    data.description || '',
    data.quantity || 1,
    data.quantity || 1,
    data.imageUrl || '',
    true
  ]);
  return { status: 'ok', message: 'เพิ่มอุปกรณ์สำเร็จ', equipmentId: id };
}

function updateEquipment(data) {
  const sheet = getSheet('Equipment');
  const data_range = sheet.getDataRange().getValues();

  for (let i = 1; i < data_range.length; i++) {
    if (data_range[i][0] === data.equipmentId) {
      if (data.name !== undefined) sheet.getRange(i + 1, 2).setValue(data.name);
      if (data.description !== undefined) sheet.getRange(i + 1, 3).setValue(data.description);
      if (data.quantity !== undefined) {
        const diff = data.quantity - data_range[i][3];
        sheet.getRange(i + 1, 4).setValue(data.quantity);
        sheet.getRange(i + 1, 5).setValue(data_range[i][4] + diff);
      }
      if (data.imageUrl !== undefined) sheet.getRange(i + 1, 6).setValue(data.imageUrl);
      if (data.active !== undefined) sheet.getRange(i + 1, 7).setValue(data.active);
      return { status: 'ok', message: 'อัปเดตอุปกรณ์สำเร็จ' };
    }
  }
  return { status: 'error', message: 'ไม่พบอุปกรณ์' };
}

function deleteEquipment(data) {
  const sheet = getSheet('Equipment');
  const data_range = sheet.getDataRange().getValues();

  for (let i = 1; i < data_range.length; i++) {
    if (data_range[i][0] === data.equipmentId) {
      sheet.getRange(i + 1, 7).setValue(false);
      return { status: 'ok', message: 'ลบอุปกรณ์สำเร็จ' };
    }
  }
  return { status: 'error', message: 'ไม่พบอุปกรณ์' };
}

function decreaseAvailable(eqId) {
  const sheet = getSheet('Equipment');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eqId) {
      sheet.getRange(i + 1, 5).setValue(Math.max(0, data[i][4] - 1));
      break;
    }
  }
}

function increaseAvailable(eqId) {
  const sheet = getSheet('Equipment');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eqId) {
      sheet.getRange(i + 1, 5).setValue(data[i][4] + 1);
      break;
    }
  }
}

// ===== AVAILABLE SLOTS =====
function getAvailableSlots(date) {
  const sheet = getSheet('Loans');
  const data = sheet.getDataRange().getValues();
  const slots = [
    '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
    '16:00-17:00', '17:00-18:00'
  ];
  const booked = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === date && data[i][8] === 'borrowed') {
      const slot = data[i][6];
      booked[slot] = (booked[slot] || 0) + 1;
    }
  }
  const result = slots.map(slot => ({
    slot,
    booked: booked[slot] || 0
  }));
  return { status: 'ok', slots: result };
}

// ===== ADMIN LOGIN =====
function adminLogin(data) {
  const settings = getSettings().settings;
  if (settings.adminPassword === data.password) {
    return { status: 'ok', message: 'Login success' };
  }
  return { status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
