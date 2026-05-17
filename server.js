const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = process.env.VERCEL === '1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: 'grievance-portal-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Initialize DB
let dbReady;

// Middleware to ensure DB is ready before any API call
app.use('/api', async (req, res, next) => {
  if (!dbReady) dbReady = initDatabase();
  await dbReady;
  next();
});

// File upload config
const uploadDir = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch(e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

let db;

function generateTrackingId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `GRV-${id}`;
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (!IS_VERCEL) {
    const dbPath = path.join(__dirname, 'grievance.db');
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT UNIQUE NOT NULL,
    student_id TEXT,
    student_name TEXT,
    student_email TEXT,
    is_anonymous INTEGER DEFAULT 0,
    category_id INTEGER,
    subcategory TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    attachments TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    assigned_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaint_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL,
    responder TEXT NOT NULL,
    responder_role TEXT DEFAULT 'admin',
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER,
    action TEXT NOT NULL,
    actor TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)
  )`);

  // Seed categories
  const catCount = db.exec("SELECT COUNT(*) as c FROM categories");
  if (catCount[0].values[0][0] === 0) {
    const cats = [
      ['Hostel & Accommodation', 'hostel', 'Room conditions, mess food, water supply, cleanliness, wardens', 'hostel'],
      ['Academics & Teaching', 'academics', 'Faculty issues, syllabus concerns, teaching quality, attendance', 'academics'],
      ['Examination', 'examination', 'Paper evaluation, results delay, hall ticket issues, malpractice', 'exam'],
      ['Library', 'library', 'Book availability, timings, facilities, fines, digital access', 'library'],
      ['Transport', 'transport', 'Bus routes, timings, driver behavior, overcrowding, passes', 'transport'],
      ['Canteen & Mess', 'canteen', 'Food quality, hygiene, pricing, menu variety, timings', 'canteen'],
      ['Ragging & Harassment', 'ragging', 'Anti-ragging complaints, bullying, discrimination, harassment', 'ragging'],
      ['Infrastructure', 'infrastructure', 'Classrooms, labs, WiFi, parking, sports facilities', 'infrastructure'],
      ['Financial & Fees', 'financial', 'Fee structure, scholarships, refunds, payment issues', 'financial'],
      ['Other', 'other', 'General complaints that don\'t fit other categories', 'other']
    ];
    const stmt = db.prepare("INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)");
    cats.forEach(c => { stmt.run(c); });
    stmt.free();
  }

  // Seed admin
  const adminCount = db.exec("SELECT COUNT(*) as c FROM admin_users");
  if (adminCount[0].values[0][0] === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO admin_users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)",
      ['admin', hash, 'Portal Administrator', 'super_admin', 'Administration']);
  }

  // Seed demo complaints
  const compCount = db.exec("SELECT COUNT(*) as c FROM complaints");
  if (compCount[0].values[0][0] === 0) {
    const demoComplaints = [
      { tid: 'GRV-DM7K2A', sid: 'STU2024001', sname: 'Rahul Sharma', email: 'rahul@college.edu', anon: 0, cat: 1, sub: 'Water Supply', title: 'No hot water in Hostel Block C', desc: 'The hot water system in Block C has been non-functional for over 2 weeks. Despite multiple verbal complaints to the warden, no action has been taken. Students are forced to use cold water even during winter mornings.', status: 'in_review', priority: 'high', days: 5 },
      { tid: 'GRV-P8NX4F', sid: null, sname: null, email: null, anon: 1, cat: 7, sub: 'Bullying', title: 'Senior students demanding money from freshers', desc: 'A group of 3rd year students in the ME department are regularly demanding money from 1st year students near the canteen area after 6 PM. They threaten consequences if anyone reports. This has been going on for about a month.', status: 'escalated', priority: 'urgent', days: 2 },
      { tid: 'GRV-W3TQ9B', sid: 'STU2024078', sname: 'Priya Patel', email: 'priya@college.edu', anon: 0, cat: 2, sub: 'Teaching Quality', title: 'Professor not covering syllabus in Data Structures', desc: 'The professor for CS201 Data Structures has only covered 30% of the syllabus with exams approaching in 3 weeks. Classes are frequently cancelled without notice and no makeup classes are arranged.', status: 'pending', priority: 'high', days: 1 },
      { tid: 'GRV-LK5M8R', sid: 'STU2023156', sname: 'Aditya Kumar', email: 'aditya@college.edu', anon: 0, cat: 5, sub: 'Bus Timings', title: 'Route 7 bus consistently late by 30+ minutes', desc: 'The college bus on Route 7 (Sector 62 to Campus) has been arriving 30-45 minutes late almost every day for the past month. Students are missing their first period regularly.', status: 'resolved', priority: 'medium', days: 15 },
      { tid: 'GRV-YH2V6C', sid: null, sname: null, email: null, anon: 1, cat: 6, sub: 'Food Quality', title: 'Insects found in mess food multiple times', desc: 'Found insects in the dal served at dinner on three separate occasions this week in Mess Hall 2. Other students have also reported similar issues. Photos have been taken as evidence. The mess committee has not responded to complaints.', status: 'in_review', priority: 'urgent', days: 3 },
      { tid: 'GRV-QJ4N7E', sid: 'STU2024201', sname: 'Sneha Reddy', email: 'sneha@college.edu', anon: 0, cat: 3, sub: 'Results Delay', title: 'Semester 3 results pending for 2 months', desc: 'The results for Semester 3 examinations held in December have not been published yet despite the university portal showing "processing" for over 2 months. This is affecting internship applications.', status: 'pending', priority: 'medium', days: 0 },
      { tid: 'GRV-BF9X3D', sid: 'STU2023089', sname: 'Mohammed Faiz', email: 'faiz@college.edu', anon: 0, cat: 8, sub: 'WiFi Issues', title: 'Library WiFi extremely slow and unreliable', desc: 'The WiFi in the central library is extremely slow, with speeds dropping below 1 Mbps during peak hours. Students cannot access online journals or research databases which are essential for project work.', status: 'in_review', priority: 'medium', days: 7 },
      { tid: 'GRV-MC6A2H', sid: 'STU2024310', sname: 'Kavya Nair', email: 'kavya@college.edu', anon: 0, cat: 9, sub: 'Scholarship Delay', title: 'Merit scholarship amount not credited since 3 months', desc: 'I was awarded the university merit scholarship for academic year 2024-25. The amount has not been credited to my bank account for the last 3 months despite submitting all required documents to the accounts section.', status: 'pending', priority: 'high', days: 1 }
    ];

    demoComplaints.forEach(c => {
      const createdAt = new Date(Date.now() - c.days * 86400000).toISOString();
      db.run(`INSERT INTO complaints (tracking_id, student_id, student_name, student_email, is_anonymous, category_id, subcategory, title, description, status, priority, created_at, updated_at ${c.status === 'resolved' ? ', resolved_at' : ''})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ${c.status === 'resolved' ? ', ?' : ''})`,
        [c.tid, c.sid, c.sname, c.email, c.anon, c.cat, c.sub, c.title, c.desc, c.status, c.priority, createdAt, createdAt, ...(c.status === 'resolved' ? [createdAt] : [])]
      );
    });

    // Seed some responses
    db.run("INSERT INTO complaint_responses (complaint_id, responder, responder_role, message, created_at) VALUES (1, 'Warden Office', 'admin', 'We have contacted the maintenance department. A plumber has been assigned to inspect the water heating system in Block C.', datetime('now', '-3 days'))");
    db.run("INSERT INTO complaint_responses (complaint_id, responder, responder_role, message, created_at) VALUES (2, 'Anti-Ragging Cell', 'admin', 'This is a serious matter. We have alerted campus security and the anti-ragging committee. An investigation has been initiated. The identity of the complainant will be kept strictly confidential.', datetime('now', '-1 days'))");
    db.run("INSERT INTO complaint_responses (complaint_id, responder, responder_role, message, created_at) VALUES (4, 'Transport Office', 'admin', 'The issue has been identified. The bus on Route 7 was being delayed due to road construction on NH-24. We have rerouted the bus via Sector 63 bypass. The revised timetable has been updated.', datetime('now', '-10 days'))");

    // Seed activity log
    db.run("INSERT INTO activity_log (complaint_id, action, actor, details, created_at) VALUES (1, 'status_change', 'Admin', 'Status changed from pending to in_review', datetime('now', '-4 days'))");
    db.run("INSERT INTO activity_log (complaint_id, action, actor, details, created_at) VALUES (2, 'status_change', 'Admin', 'Status changed from pending to escalated', datetime('now', '-1 days'))");
    db.run("INSERT INTO activity_log (complaint_id, action, actor, details, created_at) VALUES (4, 'status_change', 'Admin', 'Status changed from in_review to resolved', datetime('now', '-10 days'))");
  }

  if (!IS_VERCEL) saveDb();
  console.log('Database initialized with seed data');
}

function saveDb() {
  if (IS_VERCEL) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(path.join(__dirname, 'grievance.db'), buffer);
  } catch(e) {}
}

// ==================== API ROUTES ====================

// Get categories
app.get('/api/categories', (req, res) => {
  const result = db.exec("SELECT * FROM categories ORDER BY id");
  if (!result.length) return res.json([]);
  const cols = result[0].columns;
  const rows = result[0].values.map(r => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = r[i]);
    return obj;
  });
  res.json(rows);
});

// Submit complaint
app.post('/api/complaints', upload.array('attachments', 5), (req, res) => {
  try {
    const { student_id, student_name, student_email, is_anonymous, category_id, subcategory, title, description, priority } = req.body;
    const trackingId = generateTrackingId();
    const attachments = req.files ? req.files.map(f => f.filename).join(',') : '';

    db.run(`INSERT INTO complaints (tracking_id, student_id, student_name, student_email, is_anonymous, category_id, subcategory, title, description, attachments, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trackingId, is_anonymous === '1' ? null : student_id, is_anonymous === '1' ? null : student_name, is_anonymous === '1' ? null : student_email, parseInt(is_anonymous) || 0, parseInt(category_id), subcategory || '', title, description, attachments, priority || 'medium']
    );

    db.run("INSERT INTO activity_log (complaint_id, action, actor, details) VALUES (last_insert_rowid(), 'submitted', ?, 'Complaint submitted')",
      [is_anonymous === '1' ? 'Anonymous' : student_name || 'Student']
    );

    saveDb();
    res.json({ success: true, trackingId, message: 'Complaint submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit complaint' });
  }
});

// Track complaint
app.get('/api/complaints/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const result = db.exec(`SELECT c.*, cat.name as category_name, cat.slug as category_slug
    FROM complaints c LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.tracking_id = ?`, [trackingId.toUpperCase()]);

  if (!result.length || !result[0].values.length) {
    return res.status(404).json({ success: false, message: 'No complaint found with this tracking ID' });
  }

  const cols = result[0].columns;
  const complaint = {};
  cols.forEach((c, i) => complaint[c] = result[0].values[0][i]);

  // Get responses
  const respResult = db.exec("SELECT * FROM complaint_responses WHERE complaint_id = ? ORDER BY created_at ASC", [complaint.id]);
  complaint.responses = [];
  if (respResult.length) {
    const rCols = respResult[0].columns;
    complaint.responses = respResult[0].values.map(r => {
      const obj = {};
      rCols.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
  }

  // Get activity log
  const actResult = db.exec("SELECT * FROM activity_log WHERE complaint_id = ? ORDER BY created_at DESC", [complaint.id]);
  complaint.activity = [];
  if (actResult.length) {
    const aCols = actResult[0].columns;
    complaint.activity = actResult[0].values.map(r => {
      const obj = {};
      aCols.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
  }

  res.json({ success: true, complaint });
});

// Student follow-up
app.post('/api/complaints/:trackingId/followup', (req, res) => {
  const { trackingId } = req.params;
  const { message } = req.body;
  const result = db.exec("SELECT id FROM complaints WHERE tracking_id = ?", [trackingId.toUpperCase()]);
  if (!result.length || !result[0].values.length) return res.status(404).json({ success: false, message: 'Not found' });

  const complaintId = result[0].values[0][0];
  db.run("INSERT INTO complaint_responses (complaint_id, responder, responder_role, message) VALUES (?, 'Student', 'student', ?)", [complaintId, message]);
  db.run("INSERT INTO activity_log (complaint_id, action, actor, details) VALUES (?, 'followup', 'Student', 'Student added a follow-up')", [complaintId]);
  saveDb();
  res.json({ success: true });
});

// ==================== ADMIN ROUTES ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const result = db.exec("SELECT * FROM admin_users WHERE username = ?", [username]);
  if (!result.length || !result[0].values.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const cols = result[0].columns;
  const admin = {};
  cols.forEach((c, i) => admin[c] = result[0].values[0][i]);

  if (!bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  req.session.admin = { id: admin.id, username: admin.username, role: admin.role, fullName: admin.full_name };
  res.json({ success: true, admin: req.session.admin });
});

// Admin auth check
app.get('/api/admin/check', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false });
  res.json({ success: true, admin: req.session.admin });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Admin stats (public for homepage counters, auth for full data)
app.get('/api/admin/stats', (req, res) => {
  const isAuthed = !!req.session.admin;

  const total = db.exec("SELECT COUNT(*) FROM complaints")[0].values[0][0];
  const pending = db.exec("SELECT COUNT(*) FROM complaints WHERE status = 'pending'")[0].values[0][0];
  const inReview = db.exec("SELECT COUNT(*) FROM complaints WHERE status = 'in_review'")[0].values[0][0];
  const resolved = db.exec("SELECT COUNT(*) FROM complaints WHERE status = 'resolved'")[0].values[0][0];
  const escalated = db.exec("SELECT COUNT(*) FROM complaints WHERE status = 'escalated'")[0].values[0][0];
  const anonymous = db.exec("SELECT COUNT(*) FROM complaints WHERE is_anonymous = 1")[0].values[0][0];

  // Category breakdown
  const catBreakdown = db.exec(`SELECT cat.name, cat.slug, COUNT(c.id) as count FROM categories cat LEFT JOIN complaints c ON cat.id = c.category_id GROUP BY cat.id ORDER BY count DESC`);
  const categories = catBreakdown.length ? catBreakdown[0].values.map(r => ({ name: r[0], slug: r[1], count: r[2] })) : [];

  // Priority breakdown
  const priBreakdown = db.exec("SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority");
  const priorities = priBreakdown.length ? priBreakdown[0].values.map(r => ({ priority: r[0], count: r[1] })) : [];

  // Recent activity
  const recent = db.exec(`SELECT al.*, c.tracking_id, c.title FROM activity_log al JOIN complaints c ON al.complaint_id = c.id ORDER BY al.created_at DESC LIMIT 10`);
  const recentActivity = recent.length ? recent[0].values.map(r => {
    const obj = {};
    recent[0].columns.forEach((c, i) => obj[c] = r[i]);
    return obj;
  }) : [];

  // Monthly trends (last 6 months)
  const trends = db.exec(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM complaints WHERE created_at >= datetime('now', '-6 months') GROUP BY month ORDER BY month`);
  const monthlyTrends = trends.length ? trends[0].values.map(r => ({ month: r[0], count: r[1] })) : [];

  res.json({
    success: true,
    stats: { total, pending, inReview, resolved, escalated, anonymous, categories, priorities, recentActivity, monthlyTrends }
  });
});

// Admin list complaints
app.get('/api/admin/complaints', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false });

  const { status, category, priority, search, sort, order } = req.query;
  let query = `SELECT c.*, cat.name as category_name, cat.slug as category_slug FROM complaints c LEFT JOIN categories cat ON c.category_id = cat.id WHERE 1=1`;
  const params = [];

  if (status && status !== 'all') { query += ` AND c.status = ?`; params.push(status); }
  if (category && category !== 'all') { query += ` AND cat.slug = ?`; params.push(category); }
  if (priority && priority !== 'all') { query += ` AND c.priority = ?`; params.push(priority); }
  if (search) { query += ` AND (c.title LIKE ? OR c.tracking_id LIKE ? OR c.description LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const sortCol = sort === 'priority' ? 'c.priority' : sort === 'status' ? 'c.status' : 'c.created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${sortCol} ${sortDir}`;

  const result = db.exec(query, params);
  if (!result.length) return res.json({ success: true, complaints: [] });

  const cols = result[0].columns;
  const complaints = result[0].values.map(r => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = r[i]);
    return obj;
  });

  res.json({ success: true, complaints });
});

// Admin get single complaint
app.get('/api/admin/complaints/:id', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false });

  const result = db.exec(`SELECT c.*, cat.name as category_name FROM complaints c LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = ?`, [parseInt(req.params.id)]);
  if (!result.length || !result[0].values.length) return res.status(404).json({ success: false });

  const cols = result[0].columns;
  const complaint = {};
  cols.forEach((c, i) => complaint[c] = result[0].values[0][i]);

  const respResult = db.exec("SELECT * FROM complaint_responses WHERE complaint_id = ? ORDER BY created_at ASC", [complaint.id]);
  complaint.responses = [];
  if (respResult.length) {
    complaint.responses = respResult[0].values.map(r => {
      const obj = {};
      respResult[0].columns.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
  }

  const actResult = db.exec("SELECT * FROM activity_log WHERE complaint_id = ? ORDER BY created_at DESC", [complaint.id]);
  complaint.activity = [];
  if (actResult.length) {
    complaint.activity = actResult[0].values.map(r => {
      const obj = {};
      actResult[0].columns.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
  }

  res.json({ success: true, complaint });
});

// Admin update complaint status
app.patch('/api/admin/complaints/:id', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false });
  const { status, priority } = req.body;
  const id = parseInt(req.params.id);

  if (status) {
    const resolvedAt = status === 'resolved' ? ", resolved_at = datetime('now')" : '';
    db.run(`UPDATE complaints SET status = ?, updated_at = datetime('now') ${resolvedAt} WHERE id = ?`, [status, id]);
    db.run("INSERT INTO activity_log (complaint_id, action, actor, details) VALUES (?, 'status_change', ?, ?)",
      [id, req.session.admin.fullName, `Status changed to ${status}`]);
  }
  if (priority) {
    db.run("UPDATE complaints SET priority = ?, updated_at = datetime('now') WHERE id = ?", [priority, id]);
    db.run("INSERT INTO activity_log (complaint_id, action, actor, details) VALUES (?, 'priority_change', ?, ?)",
      [id, req.session.admin.fullName, `Priority changed to ${priority}`]);
  }

  saveDb();
  res.json({ success: true });
});

// Admin respond
app.post('/api/admin/complaints/:id/respond', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ success: false });
  const { message } = req.body;
  const id = parseInt(req.params.id);

  db.run("INSERT INTO complaint_responses (complaint_id, responder, responder_role, message) VALUES (?, ?, 'admin', ?)",
    [id, req.session.admin.fullName, message]);
  db.run("INSERT INTO activity_log (complaint_id, action, actor, details) VALUES (?, 'response', ?, 'Admin responded')",
    [id, req.session.admin.fullName]);
  db.run("UPDATE complaints SET updated_at = datetime('now') WHERE id = ?", [id]);

  saveDb();
  res.json({ success: true });
});

// Start server (local dev only)
if (!IS_VERCEL) {
  dbReady = initDatabase();
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Student Grievance Portal running at http://localhost:${PORT}\n`);
    });
  });
}

// Export for Vercel
module.exports = app;
