// ==================== SUBMIT PAGE ====================
function renderSubmit(app) {
  app.innerHTML = `
    <div class="form-page page active">
      <div class="container">
        <div class="form-container">
          <div class="form-header reveal">
            <h1>File a Complaint</h1>
            <p>Your complaint will be reviewed and addressed by the relevant department</p>
          </div>
          <form id="complaint-form" class="reveal reveal-delay-1">
            <div class="form-group">
              <div class="form-label">Submission Type</div>
              <div class="toggle-group">
                <button type="button" class="toggle-btn active" data-anon="0" onclick="setAnon(0)">${icon('user',16)} With Identity</button>
                <button type="button" class="toggle-btn" data-anon="1" onclick="setAnon(1)">${icon('shieldCheck',16)} Anonymous</button>
              </div>
              <div class="anon-info" id="anon-info" style="display:none">
                ${icon('shield',18)}
                <div><strong>Anonymous Mode</strong><br>Your identity will not be recorded. You'll receive a tracking ID to monitor your complaint.</div>
              </div>
            </div>
            <div id="identity-fields">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Student ID</label>
                  <input type="text" class="form-input" id="student_id" placeholder="e.g. STU2024001">
                </div>
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input type="text" class="form-input" id="student_name" placeholder="Your full name">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="student_email" placeholder="your.email@college.edu">
              </div>
            </div>
            <div class="form-group">
              <div class="form-label">Category</div>
              <div class="categories-grid" id="submit-categories" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Sub-category</label>
              <input type="text" class="form-input" id="subcategory" placeholder="e.g. Water Supply, Teaching Quality">
            </div>
            <div class="form-group">
              <label class="form-label">Complaint Title</label>
              <input type="text" class="form-input" id="comp-title" placeholder="Brief title describing your complaint" required>
            </div>
            <div class="form-group">
              <label class="form-label">Detailed Description</label>
              <textarea class="form-textarea" id="comp-desc" placeholder="Describe your complaint in detail. Include dates, locations, and any relevant information..." required></textarea>
            </div>
            <div class="form-group">
              <div class="form-label">Priority Level</div>
              <div class="priority-options">
                <div class="priority-opt low" onclick="setPriority(this,'low')">Low</div>
                <div class="priority-opt medium active" onclick="setPriority(this,'medium')">Medium</div>
                <div class="priority-opt high" onclick="setPriority(this,'high')">High</div>
                <div class="priority-opt urgent" onclick="setPriority(this,'urgent')">Urgent</div>
              </div>
            </div>
            <div class="form-group">
              <div class="form-label">Attachments (Optional)</div>
              <div class="file-upload" id="file-upload-area">
                <div class="upload-icon">${icon('upload',32)}</div>
                <p>Drag & drop files here or click to browse</p>
                <p style="font-size:.7rem;margin-top:4px">Max 5MB per file. Images & PDFs accepted.</p>
                <input type="file" id="file-input" multiple accept="image/*,.pdf" style="display:none">
              </div>
              <div class="file-list" id="file-list"></div>
            </div>
            <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">${icon('send',18)} Submit Complaint</button>
          </form>
          <div id="success-screen" style="display:none"></div>
        </div>
      </div>
    </div>
  `;

  let isAnon = 0, selectedCategory = null, selectedPriority = 'medium', files = [];

  // Load categories
  fetch('/api/categories').then(r => r.json()).then(cats => {
    document.getElementById('submit-categories').innerHTML = cats.map(c => `
      <div class="category-card" data-id="${c.id}" data-slug="${c.slug}" onclick="selectCategory(this)">
        <div class="category-icon">${icon(c.icon,20)}</div>
        <h4>${c.name}</h4>
      </div>
    `).join('');
  });

  window.setAnon = function(v) {
    isAnon = v;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.anon) === v));
    document.getElementById('identity-fields').style.display = v ? 'none' : 'block';
    document.getElementById('anon-info').style.display = v ? 'flex' : 'none';
  };

  window.selectCategory = function(el) {
    document.querySelectorAll('#submit-categories .category-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedCategory = el.dataset.id;
  };

  window.setPriority = function(el, p) {
    selectedPriority = p;
    document.querySelectorAll('.priority-opt').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
  };

  // File upload
  const uploadArea = document.getElementById('file-upload-area');
  const fileInput = document.getElementById('file-input');
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => addFiles(fileInput.files));

  function addFiles(newFiles) {
    for (const f of newFiles) { if (files.length < 5) files.push(f); }
    renderFiles();
  }

  function renderFiles() {
    document.getElementById('file-list').innerHTML = files.map((f, i) => `
      <div class="file-item"><span>${icon('paperclip',14)} ${f.name} (${(f.size/1024).toFixed(1)}KB)</span>
      <button type="button" class="btn btn-ghost btn-sm" onclick="removeFile(${i})">${icon('close',14)}</button></div>
    `).join('');
  }

  window.removeFile = function(i) { files.splice(i, 1); renderFiles(); };

  // Submit
  document.getElementById('complaint-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('comp-title').value.trim();
    const desc = document.getElementById('comp-desc').value.trim();
    if (!title || !desc) return showToast('Please fill in title and description', 'error');
    if (!selectedCategory) return showToast('Please select a category', 'error');

    const formData = new FormData();
    formData.append('is_anonymous', isAnon);
    if (!isAnon) {
      formData.append('student_id', document.getElementById('student_id').value);
      formData.append('student_name', document.getElementById('student_name').value);
      formData.append('student_email', document.getElementById('student_email').value);
    }
    formData.append('category_id', selectedCategory);
    formData.append('subcategory', document.getElementById('subcategory').value);
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('priority', selectedPriority);
    files.forEach(f => formData.append('attachments', f));

    try {
      const res = await fetch('/api/complaints', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        document.getElementById('complaint-form').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
        document.getElementById('success-screen').innerHTML = `
          <div class="success-screen">
            <div class="success-icon">${icon('check',36)}</div>
            <h2>Complaint Submitted</h2>
            <p style="color:var(--text-secondary);margin:12px 0">Your complaint has been recorded. Use the tracking ID below to check status.</p>
            <div class="tracking-id-display">${data.trackingId}</div>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${data.trackingId}');showToast('Tracking ID copied!')">${icon('copy',14)} Copy Tracking ID</button>
            <div style="margin-top:32px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-primary" onclick="navigate('/track')">${icon('search',16)} Track Complaint</button>
              <button class="btn btn-secondary" onclick="navigate('/submit')">${icon('plus',16)} Submit Another</button>
            </div>
          </div>
        `;
      } else {
        showToast(data.message || 'Submission failed', 'error');
      }
    } catch (err) {
      showToast('Network error. Please try again.', 'error');
    }
  });
}
