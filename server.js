/**
 * Blue Dream Interior Design — website server
 * Express + security headers + compression + contact API (leads saved to data/leads.json,
 * optional email notification via SMTP).
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const PROJECT_TYPES = ['Apartment', 'Duplex / Villa', 'Office', 'Restaurant / Café', 'Retail / Showroom', 'Other'];

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: '20kb' }));
app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders(res, file) {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  },
}));

// ---------- helpers ----------
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

let writeQueue = Promise.resolve(); // serialise file writes so concurrent leads never overwrite each other
async function readLeads() {
  try { return JSON.parse(await fs.readFile(LEADS_FILE, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function saveLead(lead) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const leads = await readLeads();
    leads.push(lead);
    const tmp = LEADS_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(leads, null, 2));
    await fs.rename(tmp, LEADS_FILE);
  });
  return writeQueue;
}

let mailer = null;
if (process.env.SMTP_HOST && process.env.NOTIFY_TO) {
  const nodemailer = require('nodemailer');
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
async function notify(lead) {
  if (!mailer) return;
  const lines = Object.entries(lead).map(([k, v]) => `${k}: ${v}`).join('\n');
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.NOTIFY_TO,
    replyTo: lead.email || undefined,
    subject: `New enquiry: ${lead.name} (${lead.projectType})`,
    text: lines,
  });
}

// ---------- API ----------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { ok: false, error: 'Too many enquiries from this connection. Please try again in 15 minutes or message us on WhatsApp.' },
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden field

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: clean(b.name, 80),
    phone: clean(b.phone, 24),
    email: clean(b.email, 120),
    projectType: PROJECT_TYPES.includes(b.projectType) ? b.projectType : 'Other',
    location: clean(b.location, 120),
    area: clean(b.area, 12).replace(/[^0-9]/g, ''),
    message: clean(b.message, 2000),
    ip: req.ip,
  };

  if (lead.name.length < 2) return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  if (!/^\+?[0-9\s()-]{7,20}$/.test(lead.phone)) return res.status(400).json({ ok: false, error: 'Please enter a valid phone number.' });
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return res.status(400).json({ ok: false, error: 'Please check your email address.' });

  try {
    await saveLead(lead);
    notify(lead).catch(err => console.error('Email notification failed:', err.message));
    res.status(201).json({ ok: true, id: lead.id });
  } catch (err) {
    console.error('Saving lead failed:', err);
    res.status(500).json({ ok: false, error: 'The enquiry could not be saved. Please message us on WhatsApp.' });
  }
});

// Admin: list enquiries — GET /api/leads with header "Authorization: Bearer <ADMIN_TOKEN>"
app.get('/api/leads', async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
    return res.status(401).json({ ok: false, error: 'Unauthorised' });
  }
  const leads = await readLeads();
  res.json({ ok: true, count: leads.length, leads: leads.reverse() });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Blue Dream website running → http://localhost:${PORT}`));
