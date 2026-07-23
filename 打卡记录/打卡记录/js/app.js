// JSONBin API 配置
const BIN_API_URL = `https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': CONFIG.MASTER_KEY
};

// localStorage key
const USER_ID_KEY = 'checkin_user_id';
const NICKNAME_KEY = 'checkin_nickname';
const SHARED_KEY = 'checkin_shared_ids';

// 状态
let records = [];
let sharedRecords = [];
let userCount = 0;
let currentCategory = '全部';
let selectedDate = new Date();
let currentMonth = new Date();
let isLoading = false;

// 常量
const MAX_DAYS_AGO = 21; // 打卡日期限制21天内

// 王潇金句（双语版）
const QUOTES = [
  { zh: "你应该全力以赴，同时又不抱任何希望。", en: "You should give your best effort, while not hoping for anything." },
  { zh: "你定义你，你塑造你，你成为你。", en: "You define yourself, you shape yourself, you become yourself." },
  { zh: "找到自己与别人的差别，成为极少数人。", en: "Find what sets you apart and become one of the rare few." },
  { zh: "生存和大灾大难之外的事，都不值得哭。", en: "Nothing beyond survival and great disasters is worth crying about." },
  { zh: "把一变成二，再把二变成三，无论如何，都好过旁边的嘲讽和抱怨。", en: "Turn one into two, then two into three — anything is better than the mockery and complaints beside you." },
  { zh: "逆境让人更渴望寻找答案，而答案永远在尝试之中产生。", en: "Adversity makes people more desperate to find answers, and the answers always come from trying." },
  { zh: "我们趁早吧，趁活着。", en: "Let's do it now, while we're still alive." },
  { zh: "没有长远的梦想，就没有持久的旅程。", en: "Without a long-term dream, there is no lasting journey." },
  { zh: "人生是一团随机和虚无，一直会是无意义，除非你赋予它意义。", en: "Life is chaos and nothingness — always meaningless, unless you give it meaning." },
  { zh: "无论顺境逆境，总会到来，也总会过去。", en: "Whether good times or bad, they always come and they always go." },
  { zh: "认识自己是需要不断追问不断定义不断操作，是一辈子都无法完成的。", en: "Knowing yourself requires constant questioning, defining, and action — a life-long journey." },
  { zh: "我会一直计划，也一直实践，一直付出代价，也一直承担风险，直到把时间用完。", en: "I will keep planning, keep practicing, keep paying the price, and keep taking risks — until time runs out." },
  { zh: "但凡劝你保持现状的人，他自己的人生选择的也是保持现状。", en: "Anyone who tells you to stay where you are has themselves chosen to stay where they are." },
  { zh: "再完美的人，也不可能赢得所有人，想要胜出，只需要一直赢得大多数就够了。", en: "No one perfect enough to win everyone — to win, you only need to keep winning most people." }
];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  loadData().then(() => {
    renderCalendar();
    renderRecords();
    updateStats();
    renderSharedRecords();
    bindEvents();
    initQuote();
    initNickname();
    checkSharedLink();
  });
});

// 初始化金句
function initQuote() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('dailyQuote').innerHTML = `<span class="quote-zh">"${quote.zh}"</span><span class="quote-en">${quote.en}</span>`;
}

// 初始化昵称
function initNickname() {
  const savedNickname = localStorage.getItem(NICKNAME_KEY);
  if (savedNickname) {
    document.getElementById('nicknameInput').value = savedNickname;
  }
}

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

  // 分享按钮
  document.getElementById('shareBtn').addEventListener('click', sharePage);
}

// 提交打卡
async function submitCheckin() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const categoryRadio = document.querySelector('input[name="categoryRadio"]:checked');
  const category = categoryRadio ? categoryRadio.value : '健身';
  const content = document.getElementById('contentInput').value.trim();
  const isShared = true; // 默认自动分享到打卡墙

  // 保存昵称
  if (nickname) {
    localStorage.setItem(NICKNAME_KEY, nickname);
  }

  if (!nickname) {
    alert('请输入微信昵称');
    return;
  }

  if (!content) {
    alert('请输入打卡内容');
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
    nickname: nickname || '匿名',
    category,
    content: content.substring(0, 2000),
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
      nickname: record.nickname,
      category,
      content: record.content,
      date: record.date,
      time: record.time
    });
  }

  data.records = records;
  data.sharedRecords = sharedRecords;

  const saved = await saveDataToBin(data);
  if (!saved) {
    alert('保存失败，请重试');
    return;
  }

  // 清空表单
  document.getElementById('contentInput').value = '';

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

  // 打卡成功后生成海报
  generatePoster(category, nickname, formatDate(now));
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
        <span class="record-nickname">${escapeHtml(record.nickname || '匿名')}</span>
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
        <span class="shared-nickname">${escapeHtml(record.nickname || '匿名')}</span>
        <span class="shared-date">${record.date}</span>
      </div>
      <span class="record-cat">${record.category}</span>
      ${record.content ? `<p>${escapeHtml(record.content)}</p>` : ''}
    </div>
  `).join('');
}

// 更新统计
function updateStats() {
  const userId = getUserId();
  const streakCount = document.getElementById('streakCount');
  const todayCount = document.getElementById('todayCount');
  const userCountEl = document.getElementById('userCount');

  const myRecords = records.filter(r => r.userId === userId);

  // 分类打卡天数
  const fitnessCount = myRecords.filter(r => r.category === '健身').length;
  const writingCount = myRecords.filter(r => r.category === '写作').length;
  const englishCount = myRecords.filter(r => r.category === '英语').length;
  const readingCount = myRecords.filter(r => r.category === '阅读').length;

  document.getElementById('fitnessCount').textContent = fitnessCount > 0 ? `Day ${fitnessCount}` : '0';
  document.getElementById('writingCount').textContent = writingCount > 0 ? `Day ${writingCount}` : '0';
  document.getElementById('englishCount').textContent = englishCount > 0 ? `Day ${englishCount}` : '0';
  document.getElementById('readingCount').textContent = readingCount > 0 ? `Day ${readingCount}` : '0';

  userCountEl.textContent = `${userCount} users`;

  const todayStr = formatDate(new Date());
  const todayRecords = myRecords.filter(r => r.date === todayStr);
  todayCount.textContent = `${todayRecords.length} times`;

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

  streakCount.textContent = streak > 0 ? `Day ${streak}` : '0';
}

// 分享页面
function sharePage() {
  const userId = getUserId();
  const url = `${window.location.origin}${window.location.pathname}?share=${userId}`;

  if (navigator.share) {
    navigator.share({
      title: '前额叶营业中',
      text: '来一起打卡吧！',
      url
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('分享链接已复制到剪贴板！');
    });
  }
}

// 检查是否是被分享的链接
function checkSharedLink() {
  const params = new URLSearchParams(window.location.search);
  const sharedUserId = params.get('share');

  if (sharedUserId) {
    // 显示被分享的用户记录
    const sharedRecords = records.filter(r => r.userId === sharedUserId);
    if (sharedRecords.length > 0) {
      showSharedRecordsModal(sharedUserId, sharedRecords);
    }
    // 清除 URL 参数
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// 显示分享记录弹窗
function showSharedRecordsModal(userId, records) {
  const modal = document.createElement('div');
  modal.className = 'image-overlay';
  modal.id = 'sharedModal';

  // 获取该用户信息
  const nickname = records[0]?.nickname || '匿名';

  // 按日期分组
  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const dateList = Object.keys(byDate).sort().reverse().slice(0, 7);

  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#1A1A1A;">${escapeHtml(nickname)}的打卡</h3>
        <button onclick="closeSharedModal()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">✕</button>
      </div>
      <div style="color:#666;font-size:13px;margin-bottom:16px;">共 ${records.length} 条打卡记录</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${dateList.map(date => {
          const dayRecords = byDate[date];
          return `
            <div style="background:#FAFAFA;border-radius:12px;padding:12px;">
              <div style="font-size:12px;color:#999;margin-bottom:8px;">${date}</div>
              ${dayRecords.map(r => `
                <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
                  <span style="padding:2px 8px;background:${getCategoryColor(r.category)};color:white;border-radius:8px;font-size:11px;">${r.category}</span>
                  <p style="margin:0;font-size:14px;color:#333;flex:1;">${escapeHtml(r.content.substring(0, 50))}${r.content.length > 50 ? '...' : ''}</p>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
      <button onclick="closeSharedModal()" style="width:100%;margin-top:16px;padding:12px;background:#1A1A1A;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">关闭</button>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeSharedModal() {
  const modal = document.getElementById('sharedModal');
  if (modal) modal.remove();
}

function getCategoryColor(category) {
  const colors = {
    '健身': '#3B82F6',
    '写作': '#8B5CF6',
    '英语': '#10B981',
    '阅读': '#F59E0B'
  };
  return colors[category] || '#6B7280';
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

// 生成打卡海报
async function generatePoster(category, nickname, dateStr) {
  const posterContainer = document.createElement('div');
  posterContainer.className = 'image-overlay';
  posterContainer.id = 'posterOverlay';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 540;
  canvas.height = 960;

  // 治愈系背景图片
  const bgImages = {
    '健身': [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=540&h=960&fit=crop'
    ],
    '写作': [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1517842645767-c639042777db?w=540&h=960&fit=crop'
    ],
    '英语': [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=540&h=960&fit=crop'
    ],
    '阅读': [
      'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=540&h=960&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=540&h=960&fit=crop'
    ]
  };

  const images = bgImages[category] || bgImages['健身'];
  const bgUrl = images[Math.floor(Math.random() * images.length)];

  try {
    const bgImg = await loadImage(bgUrl);
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    // 添加柔和遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制金句
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';

    const maxWidth = 460;
    const lineHeight = 50;
    const zhLines = wrapText(ctx, `"${quote.zh}"`, maxWidth);

    const zhStartY = 420;
    zhLines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, zhStartY + i * lineHeight);
    });

    // 分隔线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    const lineY = zhStartY + zhLines.length * lineHeight + 30;
    ctx.beginPath();
    ctx.moveTo(140, lineY);
    ctx.lineTo(400, lineY);
    ctx.stroke();

    // 英文金句
    ctx.font = 'italic 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const enLines = wrapText(ctx, quote.en, maxWidth);
    const enStartY = lineY + 30;
    enLines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, enStartY + i * 36);
    });

    // 右上角水印
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.fillText('前额叶营业中', canvas.width - 40, 50);

    // 左下角昵称
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const nicknameText = nickname || '匿名';
    ctx.fillText(nicknameText, 40, canvas.height - 58);

    // 左下角分类标签
    const catColors = {
      '健身': '#3B82F6',
      '写作': '#8B5CF6',
      '英语': '#10B981',
      '阅读': '#F59E0B'
    };
    const catColor = catColors[category] || '#3B82F6';

    ctx.fillStyle = catColor;
    const catText = category;
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    const catWidth = ctx.measureText(catText).width + 24;
    roundRect(ctx, 40 + ctx.measureText(nicknameText).width + 16, canvas.height - 68, catWidth, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(catText, 40 + ctx.measureText(nicknameText).width + 16 + catWidth / 2, canvas.height - 45);

    // 右下角日期
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, canvas.width - 40, canvas.height - 58);

    const dataUrl = canvas.toDataURL('image/png');

    posterContainer.innerHTML = `
      <div style="text-align:center;">
        <img src="${dataUrl}" style="max-width:90%;max-height:80%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);" />
        <div style="margin-top:20px;">
          <button onclick="downloadPoster()" style="padding:12px 32px;background:#1A1A1A;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-right:12px;">下载海报</button>
          <button onclick="closePoster()" style="padding:12px 32px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;">关闭</button>
        </div>
      </div>
    `;

    window.currentPosterData = dataUrl;
    document.body.appendChild(posterContainer);

  } catch (error) {
    console.error('生成海报失败:', error);
    generatePosterFallback(category, nickname, dateStr);
  }
}

// 备选渐变海报
function generatePosterFallback(category, nickname, dateStr) {
  const posterContainer = document.createElement('div');
  posterContainer.className = 'image-overlay';
  posterContainer.id = 'posterOverlay';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 540;
  canvas.height = 960;

  const bgColors = {
    '健身': ['#667eea', '#764ba2'],
    '写作': ['#f093fb', '#f5576c'],
    '英语': ['#4facfe', '#00f2fe'],
    '阅读': ['#43e97b', '#38f9d7']
  };
  const [color1, color2] = bgColors[category] || bgColors['健身'];

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';

  const maxWidth = 460;
  const lineHeight = 50;
  const zhLines = wrapText(ctx, `"${quote.zh}"`, maxWidth);
  const zhStartY = 420;
  zhLines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, zhStartY + i * lineHeight));

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  const lineY = zhStartY + zhLines.length * lineHeight + 30;
  ctx.beginPath();
  ctx.moveTo(140, lineY);
  ctx.lineTo(400, lineY);
  ctx.stroke();

  ctx.font = 'italic 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  const enLines = wrapText(ctx, quote.en, maxWidth);
  const enStartY = lineY + 30;
  enLines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, enStartY + i * 36));

  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  ctx.fillText('前额叶营业中', canvas.width - 40, 50);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const nicknameText = nickname || '匿名';
  ctx.fillText(nicknameText, 40, canvas.height - 58);

  const catColors = { '健身': '#3B82F6', '写作': '#8B5CF6', '英语': '#10B981', '阅读': '#F59E0B' };
  const catColor = catColors[category] || '#3B82F6';
  ctx.fillStyle = catColor;
  const catText = category;
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  const catWidth = ctx.measureText(catText).width + 24;
  roundRect(ctx, 40 + ctx.measureText(nicknameText).width + 16, canvas.height - 68, catWidth, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(catText, 40 + ctx.measureText(nicknameText).width + 16 + catWidth / 2, canvas.height - 45);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, canvas.width - 40, canvas.height - 58);

  const dataUrl = canvas.toDataURL('image/png');
  posterContainer.innerHTML = `
    <div style="text-align:center;">
      <img src="${dataUrl}" style="max-width:90%;max-height:80%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);" />
      <div style="margin-top:20px;">
        <button onclick="downloadPoster()" style="padding:12px 32px;background:#1A1A1A;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-right:12px;">下载海报</button>
        <button onclick="closePoster()" style="padding:12px 32px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;">关闭</button>
      </div>
    </div>
  `;
  window.currentPosterData = dataUrl;
  document.body.appendChild(posterContainer);
}

// 圆角矩形辅助函数
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 加载图片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

// 文字换行
function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (let char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// 下载海报
function downloadPoster() {
  if (window.currentPosterData) {
    const link = document.createElement('a');
    link.download = `打卡海报_${new Date().toISOString().slice(0,10)}.png`;
    link.href = window.currentPosterData;
    link.click();
  }
}

// 关闭海报
function closePoster() {
  const overlay = document.getElementById('posterOverlay');
  if (overlay) overlay.remove();
}
