// 数据存储
const STORAGE_KEY = 'checkin_records';

// 状态
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentCategory = '全部';
let selectedDate = new Date();
let currentMonth = new Date();
let pendingImages = []; // 待提交的图片（base64）

// 常量
const MAX_DAYS_AGO = 21; // 打卡日期限制21天内

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  renderRecords();
  updateStats();
  bindEvents();
});

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
    // 限制不能往前超出21天范围
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
}

// 处理图片选择
function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const preview = document.getElementById('imagePreview');

  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      pendingImages.push(event.target.result);
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
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
function submitCheckin() {
  const category = document.getElementById('categorySelect').value;
  const content = document.getElementById('contentInput').value.trim();

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
  const record = {
    id: Date.now(),
    category,
    content: content.substring(0, 2000), // 限制2000字
    images: [...pendingImages],
    date: formatDate(selectedDate),
    time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  };

  records.unshift(record);
  saveRecords();

  // 清空表单
  document.getElementById('contentInput').value = '';
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
}

// 保存数据
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// 删除记录
function deleteRecord(id) {
  if (!confirm('确定删除这条打卡记录？')) return;
  records = records.filter(r => r.id !== id);
  saveRecords();
  renderRecords();
  renderCalendar();
  updateStats();
}

// 渲染日历
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // 显示月份
  document.getElementById('currentMonth').textContent = `${year}年 ${month + 1}月`;

  // 获取当月第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // 获取上个月的天数
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const container = document.getElementById('calendarDays');
  container.innerHTML = '';

  const today = new Date();
  const todayStr = formatDate(today);
  const selectedStr = formatDate(selectedDate);

  // 计算21天前的日期
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - MAX_DAYS_AGO);

  // 生成日期
  let dayCount = 1;
  let nextMonthDay = 1;

  for (let i = 0; i < 42; i++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    if (i < startDay) {
      // 上个月
      dayEl.classList.add('other-month');
      dayEl.textContent = prevMonthLastDay - startDay + i + 1;
    } else if (dayCount <= totalDays) {
      // 当月
      const dateObj = new Date(year, month, dayCount);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
      dayEl.textContent = dayCount;

      // 检查是否在21天以内
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
      // 检查是否有记录
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
      // 下个月
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

  // 筛选记录
  let filtered = records.filter(r => r.date === dateStr);

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

// 更新统计
function updateStats() {
  const totalCount = document.getElementById('totalCount');
  const streakCount = document.getElementById('streakCount');
  const todayCount = document.getElementById('todayCount');

  // 总打卡次数
  totalCount.textContent = records.length;

  // 今日打卡
  const todayStr = formatDate(new Date());
  const todayRecords = records.filter(r => r.date === todayStr);
  todayCount.textContent = todayRecords.length;

  // 连续打卡天数
  let streak = 0;
  let checkDate = new Date();

  while (true) {
    const dateStr = formatDate(checkDate);
    const hasRecord = records.some(r => r.date === dateStr);
    if (hasRecord) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  streakCount.textContent = streak;
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
