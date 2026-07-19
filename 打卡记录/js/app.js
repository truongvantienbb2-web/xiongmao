// JSONBin API 配置
const BIN_API_URL = `https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': CONFIG.MASTER_KEY
};

// localStorage key
const USER_ID_KEY = 'checkin_user_id';
const SHARED_KEY = 'checkin_shared_ids';

// 状态
let records = [];
let sharedRecords = [];
let userCount = 0;
let currentCategory = '全部';
let selectedDate = new Date();
let currentMonth = new Date();
let pendingImages = []; // 待提交的图片（base64）
let isLoading = false;

// 常量
const MAX_DAYS_AGO = 21; // 打卡日期限制21天内

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  loadData().then(() => {
    renderCalendar();
    renderRecords();
    updateStats();
    renderSharedRecords();
    bindEvents();
  });
});

// 初始化用户ID
function initUser() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

// 获取用户ID
function getUserId() {
  return localStorage.getItem(USER_ID_KEY);
}

// 从 JSONBin 加载数据
async function loadData() {
  try {
    isLoading = true;
    const response = await fetch(`${BIN_API_URL}/latest`, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) {
      throw new Error('加载失败：' + response.status);
    }

    const result = await response.json();
    const data = result.record || {};

    records = data.records || [];
    sharedRecords = data.sharedRecords || [];
    userCount = data.userCount || 0;

    // 如果是新用户，增加使用人数
    await maybeIncrementUserCount();
  } catch (error) {
    console.error('加载数据失败:', error);
    alert('数据加载失败，请检查网络或配置');
    records = [];
    sharedRecords = [];
    userCount = 0;
  } finally {
    isLoading = false;
  }
}

// 检查是否需要增加使用人数
async function maybeIncrementUserCount() {
  const userId = getUserId();
  // 用本地存储标记是否已经统计过
  const countedKey = `counted_${CONFIG.BIN_ID}`;
  if (localStorage.getItem(countedKey)) return;

  const data = await fetchLatestData();
  data.userCount = (data.userCount || 0) + 1;

  const saved = await saveDataToBin(data);
  if (saved) {
    localStorage.setItem(countedKey, 'true');
    userCount = data.userCount;
    document.getElementById('userCount').textContent = userCount;
  }
}

// 获取最新数据
async function fetchLatestData() {
  const response = await fetch(`${BIN_API_URL}/latest`, {
    method: 'GET',
    headers: HEADERS
  });
  const result = await response.json();
  return result.record || { records: [], sharedRecords: [], userCount: 0 };
}

// 保存数据到 JSONBin
async function saveDataToBin(data) {
  try {
    const response = await fetch(BIN_API_URL, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(data)
    });
    return response.ok;
  } catch (error) {
    console.error('保存失败:', error);
    return false;
  }
}

// 保存完整数据（合并本地记录）
async function saveRecords() {
  const data = await fetchLatestData();
  data.records = records;
  data.sharedRecords = sharedRecords;
  return await saveDataToBin(data);
}

// 绑定事件
function bindEvents() {
  // 分类按钮
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderRecords();
    });
  });

  // 日历导航
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    const minMonth = new Date();
    minMonth.setDate(minMonth.getDate() - MAX_DAYS_AGO);
    minMonth.setDate(1);
    if (currentMonth < minMonth) {
      currentMonth = minMonth;
    }
    renderCalendar();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    const today = new Date();
    today.setDate(1);
    if (currentMonth > today) {
      currentMonth = today;
    }
    renderCalendar();
  });

  // 提交打卡
  document.getElementById('submitBtn').addEventListener('click', submitCheckin);

  // 图片上传
  document.getElementById('imageInput').addEventListener('change', handleImageSelect);

  // 分享按钮
  document.getElementById('shareBtn').addEventListener('click', sharePage);
}

// 处理图片选择
async function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const MAX_IMAGES = 3;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  if (pendingImages.length + files.length > MAX_IMAGES) {
    alert(`最多只能上传 ${MAX_IMAGES} 张图片`);
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_FILE_SIZE) {
      alert(`图片 ${file.name} 超过 5MB，请压缩后重试`);
      continue;
    }

    try {
      const compressed = await compressImage(file);
      pendingImages.push(compressed);
      renderImagePreview();
    } catch (err) {
      console.error('图片压缩失败:', err);
      alert('图片处理失败，请换一张试试');
    }
  }

  e.target.value = '';
}

// 压缩图片
function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          } else {
            width = Math.round(width * maxWidth / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 渲染图片预览
function renderImagePreview() {
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = pendingImages.map((img, index) => `
    <div class="image-preview-item">
      <img src="${img}" alt="预览图${index + 1}" />
      <button class="remove-img" onclick="removeImage(${index})">✕</button>
    </div>
  `).join('');
}

// 删除待提交的图片
function removeImage(index) {
  pendingImages.splice(index, 1);
  renderImagePreview();
}

// 提交打卡
async function submitCheckin() {
  const category = document.getElementById('categorySelect').value;
  const content = document.getElementById('contentInput').value.trim();
  const isShared = document.getElementById('shareInput').checked;

  if (!content && pendingImages.length === 0) {
    alert('请输入文字或上传图片');
    return;
  }

  // 检查日期是否在21天以内
  const today = new Date();
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - MAX_DAYS_AGO);

  if (selectedDate < minDate || selectedDate > today) {
    alert('只能打卡21天内的日期');
    return;
  }

  const now = new Date();
  const userId = getUserId();
  const record = {
    id: Date.now(),
    userId,
    category,
    content: content.substring(0, 2000),
    images: [...pendingImages],
    date: formatDate(selectedDate),
    time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
    shared: isShared
  };

  // 先获取最新数据，避免覆盖
  const data = await fetchLatestData();
  records = data.records || [];
  sharedRecords = data.sharedRecords || [];

  records.unshift(record);

  // 如果勾选分享，加入共享记录
  if (isShared) {
    sharedRecords.unshift({
      id: record.id,
      userId,
      category,
      content: record.content,
      images: record.images,
      date: record.date,
      time: record.time
    });
  }

  data.records = records;
  data.sharedRecords = sharedRecords;

  const saved = await saveDataToBin(data);
  if (!saved) {
    alert('保存失败，可能是图片太大或网络问题，请减少图片数量后重试');
    return;
  }

  // 清空表单
  document.getElementById('contentInput').value = '';
  document.getElementById('shareInput').checked = false;
  pendingImages = [];
  renderImagePreview();

  // 切换到该分类并选中今天
  currentCategory = category;
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  selectedDate = now;
  currentMonth = new Date(now);
  renderCalendar();
  renderRecords();
  updateStats();
  renderSharedRecords();
}

// 删除记录
async function deleteRecord(id) {
  if (!confirm('确定删除这条打卡记录？')) return;

  const data = await fetchLatestData();
  records = data.records || [];
  sharedRecords = data.sharedRecords || [];

  records = records.filter(r => r.id !== id);
  sharedRecords = sharedRecords.filter(r => r.id !== id);

  data.records = records;
  data.sharedRecords = sharedRecords;

  await saveDataToBin(data);
  renderRecords();
  renderCalendar();
  updateStats();
  renderSharedRecords();
}

// 渲染日历
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  document.getElementById('currentMonth').textContent = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const container = document.getElementById('calendarDays');
  container.innerHTML = '';

  const today = new Date();
  const todayStr = formatDate(today);
  const selectedStr = formatDate(selectedDate);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - MAX_DAYS_AGO);

  let dayCount = 1;
  let nextMonthDay = 1;

  for (let i = 0; i < 42; i++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    if (i < startDay) {
      dayEl.classList.add('other-month');
      dayEl.textContent = prevMonthLastDay - startDay + i + 1;
    } else if (dayCount <= totalDays) {
      const dateObj = new Date(year, month, dayCount);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
      dayEl.textContent = dayCount;

      const isWithinRange = dateObj >= minDate && dateObj <= today;

      if (!isWithinRange) {
        dayEl.classList.add('disabled');
      }

      if (dateStr === todayStr) {
        dayEl.classList.add('today');
      }
      if (dateStr === selectedStr) {
        dayEl.classList.add('selected');
      }

      const hasRecord = records.some(r => r.date === dateStr && (currentCategory === '全部' || r.category === currentCategory));
      if (hasRecord) {
        dayEl.classList.add('has-record');
      }

      if (isWithinRange) {
        dayEl.addEventListener('click', () => {
          selectedDate = new Date(year, month, dayCount);
          renderCalendar();
          renderRecords();
        });
      }

      dayCount++;
    } else {
      dayEl.classList.add('other-month');
      dayEl.textContent = nextMonthDay++;
    }

    container.appendChild(dayEl);
  }
}

// 渲染记录列表
function renderRecords() {
  const container = document.getElementById('recordsContainer');
  const dateStr = formatDate(selectedDate);
  const dateDisplay = document.getElementById('selectedDate');

  dateDisplay.textContent = dateStr === formatDate(new Date()) ? '（今天）' : `（${dateStr}）`;

  const userId = getUserId();
  let filtered = records.filter(r => r.date === dateStr && r.userId === userId);

  if (currentCategory !== '全部') {
    filtered = filtered.filter(r => r.category === currentCategory);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无打卡记录</div>';
    return;
  }

  container.innerHTML = filtered.map(record => `
    <div class="record-item" data-category="${record.category}">
      <span class="record-cat">${record.category}</span>
      <div class="record-content">
        ${record.images && record.images.length > 0 ? `<div class="record-images">${record.images.map(img => `<img src="${img}" alt="打卡图片" onclick="previewImage('${img}')" />`).join('')}</div>` : ''}
        ${record.content ? `<p>${escapeHtml(record.content)}</p>` : ''}
        <span class="record-time">${record.time}</span>
      </div>
      <button class="record-delete" onclick="deleteRecord(${record.id})">✕</button>
    </div>
  `).join('');
}

// 渲染共享记录
function renderSharedRecords() {
  const container = document.getElementById('sharedContainer');

  if (sharedRecords.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无共享打卡</div>';
    return;
  }

  // 最多显示最近30条
  const recent = sharedRecords.slice(0, 30);

  container.innerHTML = recent.map(record => `
    <div class="shared-item" data-category="${record.category}">
      <div class="shared-header-row">
        <span class="record-cat">${record.category}</span>
        <span class="shared-date">${record.date} ${record.time}</span>
      </div>
      ${record.images && record.images.length > 0 ? `<div class="record-images">${record.images.map(img => `<img src="${img}" alt="打卡图片" onclick="previewImage('${img}')" />`).join('')}</div>` : ''}
      ${record.content ? `<p>${escapeHtml(record.content)}</p>` : ''}
    </div>
  `).join('');
}

// 更新统计
function updateStats() {
  const userId = getUserId();
  const totalCount = document.getElementById('totalCount');
  const streakCount = document.getElementById('streakCount');
  const todayCount = document.getElementById('todayCount');
  const userCountEl = document.getElementById('userCount');

  const myRecords = records.filter(r => r.userId === userId);

  totalCount.textContent = myRecords.length;
  userCountEl.textContent = userCount;

  const todayStr = formatDate(new Date());
  const todayRecords = myRecords.filter(r => r.date === todayStr);
  todayCount.textContent = todayRecords.length;

  // 连续打卡天数
  let streak = 0;
  let checkDate = new Date();

  while (true) {
    const dateStr = formatDate(checkDate);
    const hasRecord = myRecords.some(r => r.date === dateStr);
    if (hasRecord) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  streakCount.textContent = streak;
}

// 分享页面
function sharePage() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({
      title: '个人打卡记录',
      text: '来一起打卡吧！',
      url
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('链接已复制到剪贴板，可以分享到班级群了！');
    });
  }
}

// 工具函数
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 图片预览
function previewImage(src) {
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  overlay.innerHTML = `<img src="${src}" alt="预览" /><button onclick="this.parentElement.remove()">✕</button>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
