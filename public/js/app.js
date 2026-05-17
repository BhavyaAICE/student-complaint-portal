// ==================== ROUTER ====================
const routeMap = {
  '/': 'renderHome',
  '/submit': 'renderSubmit',
  '/track': 'renderTrack',
  '/admin/login': 'renderAdminLogin',
  '/admin/dashboard': 'renderAdminDashboard'
};

function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const app = document.getElementById('app');
  const fnName = routeMap[hash];
  if (fnName && typeof window[fnName] === 'function') {
    app.innerHTML = '';
    window[fnName](app);
    updateNav(hash);
    window.scrollTo(0, 0);
    initRevealObserver();
  }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

function updateNav(hash) {
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.route === hash);
  });
}

// ==================== TOAST ====================
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const ic = type === 'success' ? icon('checkCircle', 18) : icon('alertTriangle', 18);
  toast.innerHTML = `${ic}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==================== REVEAL OBSERVER ====================
function initRevealObserver() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// ==================== ANIMATED COUNTER ====================
function animateCounter(el, target, duration = 1200) {
  let start = 0;
  const step = (ts) => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.floor(ease * target);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ==================== TIME AGO ====================
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s) {
  const map = { pending: 'Pending', in_review: 'In Review', resolved: 'Resolved', escalated: 'Escalated' };
  return map[s] || s;
}

function priorityLabel(p) {
  const map = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
  return map[p] || p;
}

// ==================== HOME PAGE ====================
function renderHome(app) {
  app.innerHTML = `
    <section class="hero page active" id="home-page">
      <div class="hero-bg"></div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge reveal"><span class="dot"></span> Confidential & Secure Platform</div>
          <h1 class="reveal reveal-delay-1">Your Voice Matters. Report. Track. Resolve.</h1>
          <p class="reveal reveal-delay-2">A secure and transparent platform for students to raise grievances across all departments. Submit anonymously or with your identity — every complaint is tracked and addressed.</p>
          <div class="hero-actions reveal reveal-delay-3">
            <button class="btn btn-primary btn-lg" onclick="navigate('/submit')">${icon('send',18)} File a Complaint</button>
            <button class="btn btn-secondary btn-lg" onclick="navigate('/track')">${icon('search',18)} Track Status</button>
          </div>
        </div>
        <div class="stats-row reveal reveal-delay-4" id="home-stats"></div>
      </div>
    </section>

    <section class="features-section">
      <div class="container">
        <div class="section-header reveal">
          <h2>How It Works</h2>
          <p>Three simple steps to get your grievance addressed</p>
        </div>
        <div class="steps-row">
          <div class="step-item reveal reveal-delay-1">
            <div class="step-num">1</div>
            <h3>Submit Your Complaint</h3>
            <p>Choose a category, describe your issue, and submit — anonymously or with your student ID</p>
          </div>
          <div class="step-item reveal reveal-delay-2">
            <div class="step-num">2</div>
            <h3>Get a Tracking ID</h3>
            <p>Receive a unique tracking code to monitor the progress of your complaint anytime</p>
          </div>
          <div class="step-item reveal reveal-delay-3">
            <div class="step-num">3</div>
            <h3>Resolution & Response</h3>
            <p>The admin reviews, responds, and resolves. You can follow up until satisfied</p>
          </div>
        </div>
      </div>
    </section>

    <section class="features-section" style="padding-top:0">
      <div class="container">
        <div class="section-header reveal">
          <h2>Platform Features</h2>
          <p>Built to ensure transparency and accountability</p>
        </div>
        <div class="features-grid">
          <div class="feature-card reveal reveal-delay-1">
            <div class="feature-icon violet">${icon('shieldCheck',24)}</div>
            <h3>Anonymous Submissions</h3>
            <p>Report sensitive issues without revealing your identity. Your privacy is fully protected.</p>
          </div>
          <div class="feature-card reveal reveal-delay-2">
            <div class="feature-icon rose">${icon('activity',24)}</div>
            <h3>Real-time Tracking</h3>
            <p>Monitor your complaint status with a unique tracking ID. See every update as it happens.</p>
          </div>
          <div class="feature-card reveal reveal-delay-3">
            <div class="feature-icon teal">${icon('grid',24)}</div>
            <h3>Category Routing</h3>
            <p>Complaints are automatically categorized and routed to the relevant department for faster resolution.</p>
          </div>
          <div class="feature-card reveal reveal-delay-1">
            <div class="feature-icon violet">${icon('messageCircle',24)}</div>
            <h3>Two-way Communication</h3>
            <p>Receive admin responses and add follow-ups. Have a complete conversation thread on your complaint.</p>
          </div>
          <div class="feature-card reveal reveal-delay-2">
            <div class="feature-icon rose">${icon('barChart',24)}</div>
            <h3>Admin Dashboard</h3>
            <p>Comprehensive analytics, filters, and management tools for administrators to handle complaints efficiently.</p>
          </div>
          <div class="feature-card reveal reveal-delay-3">
            <div class="feature-icon teal">${icon('clock',24)}</div>
            <h3>Time-bound Resolution</h3>
            <p>Every complaint is tracked against resolution timelines as per UGC regulations.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="features-section" style="padding-top:0">
      <div class="container">
        <div class="section-header reveal">
          <h2>Complaint Categories</h2>
          <p>Select a category to file your complaint</p>
        </div>
        <div class="categories-grid" id="home-categories"></div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <p>Student Grievance Redressal Portal &mdash; Ensuring transparency and accountability in higher education</p>
      </div>
    </footer>
  `;

  // Load stats
  fetch('/api/admin/stats').then(r => r.json()).then(data => {
    if (!data.stats) return;
    const s = data.stats;
    document.getElementById('home-stats').innerHTML = `
      <div class="stat-card"><div class="stat-value" data-count="${s.total}">0</div><div class="stat-label">Total Complaints</div></div>
      <div class="stat-card"><div class="stat-value" data-count="${s.resolved}">0</div><div class="stat-label">Resolved</div></div>
      <div class="stat-card"><div class="stat-value" data-count="${s.pending + s.inReview}">0</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card"><div class="stat-value" data-count="${s.anonymous}">0</div><div class="stat-label">Anonymous Reports</div></div>
    `;
    document.querySelectorAll('[data-count]').forEach(el => {
      animateCounter(el, parseInt(el.dataset.count));
    });
  }).catch(() => {});

  // Load categories
  fetch('/api/categories').then(r => r.json()).then(cats => {
    const grid = document.getElementById('home-categories');
    if (!grid) return;
    grid.innerHTML = cats.map(c => `
      <div class="category-card reveal" onclick="navigate('/submit')">
        <div class="category-icon">${icon(c.icon, 22)}</div>
        <h4>${c.name}</h4>
      </div>
    `).join('');
    initRevealObserver();
  }).catch(() => {});
}
