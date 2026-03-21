// Chrono100 — Life 数据层
// 只定义函数，不立即执行任何代码

const SB_URL = 'https://flerfkkbzrnxreszxmcd.supabase.co';
const SB_KEY = 'sb_publishable_9ipOnX_DwgqDi1-z8Im4qA_EeAs7MEn';
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

let TRAJ = [];

function getSBToken() {
  try {
    const s = localStorage.getItem('sb-flerfkkbzrnxreszxmcd-auth-token');
    const p = JSON.parse(s);
    const token = p?.access_token || SB_KEY;
    const userId = p?.user?.id || null;
    return { token, userId };
  } catch(e) { return { token: SB_KEY, userId: null }; }
}

async function loadTRAJ() {
  let { token, userId } = getSBToken();
  // 优先用全局 user 对象（Google OAuth 登录后）
  if (!userId && typeof user !== 'undefined' && user?.id) { userId = user.id; }
  // 未登录直接返回空
  
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/moments?user_id=eq.${userId}&order=taken_at.desc&select=*`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }
    );
    const rows = await res.json();
    TRAJ = rows.map(r => {
      const d = r.taken_at ? new Date(r.taken_at) : new Date();
      const raw = (r.title || '').trim();
      const isUUID = /^[0-9A-F\-]{20,}$/i.test(raw.replace(/\.[^.]+$/, ''));
      return {
        id: r.id, _date: d,
        mon: MONTHS[d.getMonth()],
        day: String(d.getDate()).padStart(2, '0'),
        gold: false,
        title: (isUUID || !raw) ? '未命名记录' : raw,
        time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        loc: r.location_name || (r.lat && r.lng ? `${(+r.lat).toFixed(3)},${(+r.lng).toFixed(3)}` : '未设置位置'),
        e: r.photo_url ? '📷' : '📌',
        photos: r.photo_url ? 1 : 0,
        lat: r.lat ? +r.lat : null,
        lng: r.lng ? +r.lng : null,
        photo_url: r.photo_url || null,
        needsLoc: !r.lat || !r.lng,
      };
    });
  } catch(err) {
    console.error('loadTRAJ:', err);
    TRAJ = [];
  }
  renderLifeViews();
}

async function saveMomentLocation(id, lat, lng, name) {
  const { token } = getSBToken();
  await fetch(`${SB_URL}/rest/v1/moments?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ lat, lng, location_name: name })
  });
  loadTRAJ();
}

function promptLocation(id, title) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:#1c1c2e;border-radius:16px;padding:24px;width:320px;color:#fff">'
    + '<div style="font-size:16px;font-weight:700;margin-bottom:4px">📍 设置位置</div>'
    + '<div style="font-size:12px;color:#888;margin-bottom:16px">' + title + '</div>'
    + '<input id="_locName" placeholder="地点名称（如：Auckland CBD）"'
    + ' style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;font-size:14px;margin-bottom:10px"/>'
    + '<button id="_gpsBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:#6c63ff;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px">🌐 使用当前位置</button>'
    + '<button id="_saveBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:#3a3a5c;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px">✅ 保存</button>'
    + '<button id="_skipBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:transparent;color:#555;font-size:13px;cursor:pointer">跳过</button>'
    + '</div>';
  document.body.appendChild(ov);
  var _lat = null, _lng = null;
  document.getElementById('_gpsBtn').onclick = function() {
    navigator.geolocation.getCurrentPosition(function(p) {
      _lat = p.coords.latitude; _lng = p.coords.longitude;
      var ni = document.getElementById('_locName');
      if (!ni.value) ni.value = _lat.toFixed(4) + ', ' + _lng.toFixed(4);
    }, function() { alert('无法获取GPS，请手动输入'); });
  };
  document.getElementById('_saveBtn').onclick = function() {
    var name = document.getElementById('_locName').value.trim();
    if (!name) { alert('请输入地点名称'); return; }
    ov.remove();
    saveMomentLocation(id, _lat || 0, _lng || 0, name);
  };
  document.getElementById('_skipBtn').onclick = function() { ov.remove(); };
}

function renderLifeViews() {
  var tlEl = document.getElementById('timelineItems');
  if (!tlEl) return;
  if (!TRAJ.length) {
    tlEl.innerHTML = '<div style="text-align:center;color:#555;padding:48px 20px;line-height:2">暂无记录<br><span style="font-size:12px">点击上方按钮添加第一条记忆</span></div>';
    return;
  }
  var now = new Date(), todayStr = now.toDateString();
  var week = new Date(now); week.setDate(now.getDate() - 7);
  var groups = [
    { label: 'Today · ' + now.getFullYear(), items: TRAJ.filter(function(t) { return t._date.toDateString() === todayStr; }) },
    { label: 'Last 7 Days', items: TRAJ.filter(function(t) { return t._date < now && t._date >= week; }) },
    { label: 'Earlier', items: TRAJ.filter(function(t) { return t._date < week; }) },
  ].filter(function(g) { return g.items.length; });

  tlEl.innerHTML = groups.map(function(g) {
    return '<div class="tl-group-label" style="margin-top:4px">' + g.label + '</div>'
      + g.items.map(function(t) {
        return '<div class="tl-row">'
          + '<div class="tl-date-col">'
          + '<div class="tl-bubble' + (t.gold ? ' gold' : '') + '">'
          + '<span class="mo">' + t.mon + '</span><span class="dy">' + t.day + '</span>'
          + '</div><div class="tl-vline"></div></div>'
          + '<div class="tl-content" style="margin-left:12px;padding-bottom:10px">'
          + '<div class="tl-card"><div class="tl-card-inner">'
          + (t.photo_url ? '<img src="' + t.photo_url + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-bottom:8px;display:block">' : '')
          + '<div class="tl-card-title">' + t.e + ' ' + t.title + '</div>'
          + '<div class="tl-card-meta">' + t.time + ' · ' + t.loc
          + (t.needsLoc ? ' <span onclick="promptLocation(\'' + t.id + '\',\'' + t.title.replace(/'/g, '') + '\')" style="color:#6c63ff;cursor:pointer;font-size:11px;margin-left:4px">＋设置位置</span>' : '')
          + '</div></div></div></div></div>';
      }).join('');
  }).join('');
}
