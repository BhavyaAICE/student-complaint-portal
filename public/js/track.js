// ==================== TRACK PAGE ====================
function renderTrack(app) {
  app.innerHTML = `
    <div class="track-page page active">
      <div class="container">
        <div class="track-container">
          <div class="form-header reveal" style="text-align:center">
            <h1>Track Your Complaint</h1>
            <p>Enter your tracking ID to view the current status and responses</p>
          </div>
          <div class="track-input-group reveal reveal-delay-1">
            <input type="text" class="form-input" id="track-input" placeholder="GRV-XXXXXX" maxlength="10">
            <button class="btn btn-primary" onclick="trackComplaint()">${icon('search',18)} Track</button>
          </div>
          <div id="track-result"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('track-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') trackComplaint();
  });

  window.trackComplaint = async function() {
    const tid = document.getElementById('track-input').value.trim().toUpperCase();
    if (!tid) return showToast('Please enter a tracking ID', 'error');

    const resultDiv = document.getElementById('track-result');
    resultDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Searching...</div>';

    try {
      const res = await fetch(`/api/complaints/${tid}`);
      const data = await res.json();

      if (!data.success) {
        resultDiv.innerHTML = `<div class="empty-state" style="margin-top:40px">${icon('search',48)}<h3>No complaint found</h3><p>Please check your tracking ID and try again</p></div>`;
        return;
      }

      const c = data.complaint;
      resultDiv.innerHTML = `
        <div class="complaint-detail" style="animation:pageIn .5s var(--ease-out-expo) forwards">
          <div class="card" style="margin-bottom:20px">
            <div class="complaint-header">
              <div>
                <div style="font-family:'Space Grotesk';font-size:1.4rem;font-weight:700;color:var(--accent-primary);margin-bottom:8px">${c.tracking_id}</div>
                <h2 style="font-size:1.2rem;margin-bottom:12px">${c.title}</h2>
                <div class="complaint-meta">
                  <span class="badge badge-${c.status}">${statusLabel(c.status)}</span>
                  <span class="badge badge-${c.priority}">${priorityLabel(c.priority)} Priority</span>
                  <span class="badge badge-anon">${c.is_anonymous ? icon('shieldCheck',12) + ' Anonymous' : icon('user',12) + ' Identified'}</span>
                </div>
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-item"><div class="detail-label">Category</div><div class="detail-value">${c.category_name || 'N/A'}</div></div>
              <div class="detail-item"><div class="detail-label">Subcategory</div><div class="detail-value">${c.subcategory || 'N/A'}</div></div>
              <div class="detail-item"><div class="detail-label">Submitted</div><div class="detail-value">${formatDate(c.created_at)}</div></div>
            </div>
            <div style="margin-top:16px">
              <div class="detail-label" style="margin-bottom:8px">Description</div>
              <p style="color:var(--text-secondary);line-height:1.8;font-size:.9rem">${c.description}</p>
            </div>
          </div>

          <div class="card">
            <h3 style="margin-bottom:16px;display:flex;align-items:center;gap:8px">${icon('messageCircle',18)} Responses & Updates</h3>
            ${c.responses.length ? `<div class="timeline">
              ${c.responses.map(r => `
                <div class="timeline-item ${r.responder_role === 'admin' ? '' : 'response'}">
                  <div class="ti-header">
                    <span class="ti-author">${r.responder}</span>
                    <span class="badge badge-${r.responder_role === 'admin' ? 'in_review' : 'anon'}" style="font-size:.65rem">${r.responder_role === 'admin' ? 'Admin' : 'Student'}</span>
                    <span class="ti-date">${timeAgo(r.created_at)}</span>
                  </div>
                  <div class="ti-message">${r.message}</div>
                </div>
              `).join('')}
            </div>` : '<p style="color:var(--text-muted);font-size:.9rem">No responses yet. Your complaint is being reviewed.</p>'}

            ${c.status !== 'resolved' ? `
              <div class="followup-form">
                <input type="text" class="form-input" id="followup-msg" placeholder="Add a follow-up message...">
                <button class="btn btn-primary" onclick="sendFollowup('${c.tracking_id}')">${icon('send',16)}</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } catch (err) {
      resultDiv.innerHTML = `<div class="empty-state" style="margin-top:40px">${icon('alertTriangle',48)}<h3>Something went wrong</h3><p>Please try again later</p></div>`;
    }
  };

  window.sendFollowup = async function(tid) {
    const msg = document.getElementById('followup-msg').value.trim();
    if (!msg) return;
    try {
      await fetch(`/api/complaints/${tid}/followup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      showToast('Follow-up sent successfully');
      trackComplaint();
    } catch (err) {
      showToast('Failed to send follow-up', 'error');
    }
  };

  // Check URL params for pre-filled tracking ID
  const urlTid = new URLSearchParams(window.location.search).get('id');
  if (urlTid) {
    document.getElementById('track-input').value = urlTid;
    trackComplaint();
  }
}
