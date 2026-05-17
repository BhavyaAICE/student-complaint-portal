// ==================== ADMIN LOGIN ====================
function renderAdminLogin(app) {
  app.innerHTML = `
    <div class="admin-login page active">
      <div class="login-card">
        <div class="login-icon">${icon('shield',28)}</div>
        <h1>Admin Portal</h1>
        <p class="subtitle">Sign in to manage student grievances</p>
        <div class="login-error" id="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" id="admin-user" placeholder="Enter username" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="admin-pass" placeholder="Enter password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">${icon('lock',16)} Sign In</button>
        </form>
        <p style="text-align:center;margin-top:16px;font-size:.75rem;color:var(--text-muted)">Default: admin / admin123</p>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username: document.getElementById('admin-user').value, password: document.getElementById('admin-pass').value })
      });
      const data = await res.json();
      if (data.success) { navigate('/admin/dashboard'); }
      else { errEl.textContent = data.message; errEl.style.display = 'block'; }
    } catch(err) { errEl.textContent = 'Connection error'; errEl.style.display = 'block'; }
  });
}

// ==================== ADMIN DASHBOARD ====================
function renderAdminDashboard(app) {
  // Check auth first
  fetch('/api/admin/check').then(r => r.json()).then(data => {
    if (!data.success) { navigate('/admin/login'); return; }
    buildDashboard(app, data.admin);
  }).catch(() => navigate('/admin/login'));
}

function buildDashboard(app, admin) {
  app.innerHTML = `
    <div class="admin-page page active">
      <div class="container">
        <div class="admin-header">
          <div>
            <h1>${icon('grid',24)} Dashboard</h1>
            <p style="color:var(--text-muted);font-size:.85rem;margin-top:4px">Welcome, ${admin.fullName}</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost" onclick="loadDashboard()">${icon('refresh',16)} Refresh</button>
            <button class="btn btn-danger btn-sm" onclick="adminLogout()">${icon('logout',16)} Logout</button>
          </div>
        </div>
        <div class="admin-stats" id="admin-stats"></div>
        <div class="admin-grid">
          <div class="admin-main">
            <div class="filters-bar">
              <div class="search-box">
                ${icon('search',16)}
                <input type="text" class="form-input" id="admin-search" placeholder="Search complaints...">
              </div>
              <select class="filter-select" id="filter-status"><option value="all">All Status</option><option value="pending">Pending</option><option value="in_review">In Review</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option></select>
              <select class="filter-select" id="filter-category"><option value="all">All Categories</option></select>
              <select class="filter-select" id="filter-priority"><option value="all">All Priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
            </div>
            <div class="table-wrapper">
              <table class="complaints-table">
                <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Status</th><th>Priority</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody id="complaints-tbody"></tbody>
              </table>
            </div>
            <div id="complaints-empty" style="display:none"></div>
          </div>
          <div class="admin-sidebar">
            <div class="chart-card"><h3>${icon('pieChart',16)} By Category</h3><canvas id="cat-chart" width="200" height="200"></canvas><div class="chart-legend" id="cat-legend"></div></div>
            <div class="activity-feed"><h3>${icon('activity',16)} Recent Activity</h3><div id="activity-list"></div></div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-overlay" id="complaint-modal"><div class="modal" id="modal-content"></div></div>
  `;

  // Load categories for filter
  fetch('/api/categories').then(r=>r.json()).then(cats => {
    const sel = document.getElementById('filter-category');
    cats.forEach(c => { const o = document.createElement('option'); o.value = c.slug; o.textContent = c.name; sel.appendChild(o); });
  });

  // Filter events
  ['admin-search','filter-status','filter-category','filter-priority'].forEach(id => {
    document.getElementById(id).addEventListener(id === 'admin-search' ? 'input' : 'change', loadComplaints);
  });

  loadDashboard();
  loadComplaints();
}

window.loadDashboard = function() {
  fetch('/api/admin/stats').then(r=>r.json()).then(data => {
    if (!data.success) return;
    const s = data.stats;

    document.getElementById('admin-stats').innerHTML = `
      <div class="admin-stat-card total"><div class="stat-icon">${icon('inbox',20)}</div><div class="admin-stat-value" data-count="${s.total}">0</div><div class="admin-stat-label">Total</div></div>
      <div class="admin-stat-card pending"><div class="stat-icon">${icon('clock',20)}</div><div class="admin-stat-value" data-count="${s.pending}">0</div><div class="admin-stat-label">Pending</div></div>
      <div class="admin-stat-card review"><div class="stat-icon">${icon('eye',20)}</div><div class="admin-stat-value" data-count="${s.inReview}">0</div><div class="admin-stat-label">In Review</div></div>
      <div class="admin-stat-card resolved"><div class="stat-icon">${icon('checkCircle',20)}</div><div class="admin-stat-value" data-count="${s.resolved}">0</div><div class="admin-stat-label">Resolved</div></div>
      <div class="admin-stat-card escalated"><div class="stat-icon">${icon('alertTriangle',20)}</div><div class="admin-stat-value" data-count="${s.escalated}">0</div><div class="admin-stat-label">Escalated</div></div>
    `;
    document.querySelectorAll('[data-count]').forEach(el => animateCounter(el, parseInt(el.dataset.count)));

    // Draw donut chart
    drawDonut(s.categories);

    // Activity feed
    const actList = document.getElementById('activity-list');
    if (s.recentActivity.length) {
      actList.innerHTML = s.recentActivity.map(a => {
        const colors = {status_change:'var(--accent-primary)',response:'var(--accent-tertiary)',submitted:'var(--status-pending)',followup:'var(--accent-secondary)',priority_change:'var(--priority-high)'};
        return `<div class="activity-item"><div class="activity-dot" style="background:${colors[a.action]||'var(--text-muted)'}"></div><div><div class="activity-text"><strong>${a.tracking_id}</strong> — ${a.details||a.action}</div><div class="activity-time">${timeAgo(a.created_at)}</div></div></div>`;
      }).join('');
    } else {
      actList.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">No recent activity</p>';
    }
  });
};

function drawDonut(categories) {
  const canvas = document.getElementById('cat-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 70, inner = 45;
  const colors = ['hsl(262,80%,65%)','hsl(340,75%,60%)','hsl(175,65%,50%)','hsl(45,90%,55%)','hsl(210,90%,60%)','hsl(25,90%,55%)','hsl(0,80%,60%)','hsl(150,70%,50%)','hsl(280,60%,55%)','hsl(195,70%,50%)'];
  const total = categories.reduce((a,c)=>a+c.count,0) || 1;

  ctx.clearRect(0,0,200,200);
  let start = -Math.PI/2;
  categories.forEach((c,i) => {
    if (c.count === 0) return;
    const angle = (c.count/total)*2*Math.PI;
    ctx.beginPath();
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.arc(cx,cy,inner,start+angle,start,true);
    ctx.closePath();
    ctx.fillStyle = colors[i%colors.length];
    ctx.fill();
    start += angle;
  });

  // Center text
  ctx.fillStyle = '#eee';
  ctx.font = 'bold 24px Space Grotesk';
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy+4);
  ctx.font = '10px Inter';
  ctx.fillStyle = '#888';
  ctx.fillText('TOTAL', cx, cy+18);

  // Legend
  document.getElementById('cat-legend').innerHTML = categories.filter(c=>c.count>0).map((c,i) =>
    `<div class="legend-item"><div class="legend-left"><div class="legend-dot" style="background:${colors[i%colors.length]}"></div>${c.name}</div><span class="legend-count">${c.count}</span></div>`
  ).join('');
}

window.loadComplaints = function() {
  const params = new URLSearchParams();
  const search = document.getElementById('admin-search')?.value;
  const status = document.getElementById('filter-status')?.value;
  const category = document.getElementById('filter-category')?.value;
  const priority = document.getElementById('filter-priority')?.value;
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (category && category !== 'all') params.set('category', category);
  if (priority && priority !== 'all') params.set('priority', priority);

  fetch(`/api/admin/complaints?${params}`).then(r=>r.json()).then(data => {
    const tbody = document.getElementById('complaints-tbody');
    const empty = document.getElementById('complaints-empty');
    if (!data.complaints || !data.complaints.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.innerHTML = `<div class="empty-state">${icon('inbox',48)}<h3>No complaints found</h3><p>Try adjusting your filters</p></div>`;
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = data.complaints.map(c => `
      <tr>
        <td class="tid">${c.tracking_id}</td>
        <td class="title-cell">${c.title}</td>
        <td><span style="font-size:.8rem">${c.category_name||'—'}</span></td>
        <td><span class="badge badge-${c.status}">${statusLabel(c.status)}</span></td>
        <td><span class="badge badge-${c.priority}">${priorityLabel(c.priority)}</span></td>
        <td class="date-cell">${timeAgo(c.created_at)}</td>
        <td><div class="table-actions"><button class="btn btn-ghost btn-sm" onclick="openComplaintModal(${c.id})">${icon('eye',14)} View</button></div></td>
      </tr>
    `).join('');
  });
};

window.openComplaintModal = function(id) {
  fetch(`/api/admin/complaints/${id}`).then(r=>r.json()).then(data => {
    if (!data.success) return;
    const c = data.complaint;
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-header">
        <h2>${c.tracking_id} — ${c.title}</h2>
        <button class="btn btn-ghost" onclick="closeModal()">${icon('close',18)}</button>
      </div>
      <div class="modal-body">
        <div class="detail-row">
          <div class="detail-item"><div class="detail-label">Status</div><select class="status-select" id="modal-status" onchange="updateComplaint(${c.id},'status',this.value)">
            <option value="pending" ${c.status==='pending'?'selected':''}>Pending</option>
            <option value="in_review" ${c.status==='in_review'?'selected':''}>In Review</option>
            <option value="resolved" ${c.status==='resolved'?'selected':''}>Resolved</option>
            <option value="escalated" ${c.status==='escalated'?'selected':''}>Escalated</option>
          </select></div>
          <div class="detail-item"><div class="detail-label">Priority</div><select class="status-select" id="modal-priority" onchange="updateComplaint(${c.id},'priority',this.value)">
            <option value="low" ${c.priority==='low'?'selected':''}>Low</option>
            <option value="medium" ${c.priority==='medium'?'selected':''}>Medium</option>
            <option value="high" ${c.priority==='high'?'selected':''}>High</option>
            <option value="urgent" ${c.priority==='urgent'?'selected':''}>Urgent</option>
          </select></div>
          <div class="detail-item"><div class="detail-label">Type</div><div class="detail-value">${c.is_anonymous?'Anonymous':'Identified'}</div></div>
        </div>
        <div class="detail-row">
          <div class="detail-item"><div class="detail-label">Category</div><div class="detail-value">${c.category_name||'N/A'}</div></div>
          <div class="detail-item"><div class="detail-label">Submitted</div><div class="detail-value">${formatDate(c.created_at)}</div></div>
          ${!c.is_anonymous?`<div class="detail-item"><div class="detail-label">Student</div><div class="detail-value">${c.student_name||'—'} (${c.student_id||'—'})</div></div>`:''}
        </div>
        <div style="margin:16px 0"><div class="detail-label" style="margin-bottom:8px">Description</div><p style="color:var(--text-secondary);line-height:1.8;font-size:.875rem;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">${c.description}</p></div>

        <h3 style="margin:20px 0 12px;font-size:.95rem;display:flex;align-items:center;gap:6px">${icon('messageCircle',16)} Responses (${c.responses.length})</h3>
        ${c.responses.length?`<div class="timeline">${c.responses.map(r=>`
          <div class="timeline-item ${r.responder_role!=='admin'?'response':''}"><div class="ti-header"><span class="ti-author">${r.responder}</span><span class="ti-date">${timeAgo(r.created_at)}</span></div><div class="ti-message">${r.message}</div></div>
        `).join('')}</div>`:'<p style="color:var(--text-muted);font-size:.85rem">No responses yet</p>'}

        <div class="admin-response-form">
          <div class="form-label" style="margin-top:20px">Send Response</div>
          <textarea class="form-textarea" id="admin-response" placeholder="Write your response to the student..." style="min-height:80px"></textarea>
          <button class="btn btn-primary" onclick="sendAdminResponse(${c.id})">${icon('send',16)} Send Response</button>
        </div>
      </div>
    `;
    document.getElementById('complaint-modal').classList.add('active');
  });
};

window.closeModal = function() {
  document.getElementById('complaint-modal').classList.remove('active');
};

window.updateComplaint = async function(id, field, value) {
  const body = {};
  body[field] = value;
  await fetch(`/api/admin/complaints/${id}`, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  showToast(`${field.charAt(0).toUpperCase()+field.slice(1)} updated`);
  loadComplaints();
  loadDashboard();
};

window.sendAdminResponse = async function(id) {
  const msg = document.getElementById('admin-response').value.trim();
  if (!msg) return showToast('Please write a response','error');
  await fetch(`/api/admin/complaints/${id}/respond`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:msg}) });
  showToast('Response sent');
  openComplaintModal(id);
  loadComplaints();
};

window.adminLogout = async function() {
  await fetch('/api/admin/logout', {method:'POST'});
  navigate('/admin/login');
};

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) closeModal();
});
