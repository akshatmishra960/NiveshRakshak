const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const STORE_FULL_TEXT = String(process.env.STORE_FULL_TEXT || 'false').toLowerCase() === 'true';
const publicDir = path.join(__dirname, 'public');
const localFile = path.join(__dirname, 'data', 'scans.json');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

const rules = [
  {name:'Guaranteed return', points:25, patterns:[/guaranteed/i,/guarantee[d]?/i,/fixed\s+return/i,/100\s*%\s*profit/i,/गारंटीड/i,/गारंटी/i], why:'Guaranteed-return language detected.'},
  {name:'Urgency / FOMO', points:15, patterns:[/today\s+only/i,/act\s+now/i,/limited\s+(time|slots)/i,/last\s+chance/i,/invest\s+today/i,/आज\s*ही/i,/अभी\s*निवेश/i,/जल्दी/i], why:'Urgency or FOMO language detected.'},
  {name:'Payment pressure', points:20, patterns:[/send\s*(₹|rs\.?|inr)?\s*\d+/i,/pay\s+now/i,/transfer\s+now/i,/immediately/i,/payment\s+today/i,/पैसे\s*भेज/i,/तुरंत\s*भुगतान/i], why:'Pressure to make an immediate payment detected.'},
  {name:'Sensitive information', points:30, patterns:[/\botp\b/i,/password/i,/\bpin\b/i,/\bcvv\b/i,/share\s+your\s+kyc/i,/ओटीपी/i,/पासवर्ड/i,/पिन/i], why:'Request for sensitive credentials or personal information detected.'},
  {name:'Unverified financial claim', points:15, patterns:[/insider\s+tip/i,/secret\s+tip/i,/exclusive\s+opportunity/i,/double\s+your\s+money/i,/10x/i,/sure\s+shot/i,/गुप्त\s*टिप/i,/पैसा\s*डबल/i], why:'Unverified or unusually strong financial claim detected.'},
  {name:'Possible impersonation', points:20, patterns:[/official\s+representative/i,/sebi\s+officer/i,/bank\s+manager/i,/government\s+official/i,/सेबी\s+अधिकारी/i,/सरकारी\s+अधिकारी/i], why:'Possible authority/impersonation language detected.'}
];

function analyze(text) {
  let score = 0; const signals = [];
  for (const rule of rules) {
    if (rule.patterns.some(p => p.test(text))) { score += rule.points; signals.push({name:rule.name, points:rule.points, why:rule.why}); }
  }
  score = Math.min(score, 100);
  const level = score >= 50 ? 'HIGH RISK INDICATORS' : score >= 25 ? 'NEEDS VERIFICATION' : 'LOW RISK INDICATORS';
  const tone = score >= 50 ? 'danger' : score >= 25 ? 'warning' : 'safe';
  return {score, level, tone, signals};
}
function languageOf(text) { return /[\u0900-\u097F]/.test(text) ? 'Hindi / Hinglish' : 'English'; }
function hashText(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function cleanSessionId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0,80); }

let pool = null;
let localStore = [];
function loadLocal() {
  try { localStore = JSON.parse(fs.readFileSync(localFile, 'utf8')); } catch { localStore = []; }
}
function saveLocal() {
  fs.mkdirSync(path.dirname(localFile), {recursive:true});
  fs.writeFileSync(localFile, JSON.stringify(localStore.slice(-500), null, 2));
}
async function initDb() {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : {rejectUnauthorized:false} });
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Database: PostgreSQL');
  } else {
    loadLocal();
    console.log('Database: local JSON fallback (set DATABASE_URL for PostgreSQL)');
  }
}

async function saveScan({sessionId, source, language, text, result}) {
  const preview = text.replace(/\s+/g, ' ').trim().slice(0, 180);
  const textHash = hashText(text);
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO scans(session_id,source,language,score,level,text_hash,preview,full_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,created_at`,
        [sessionId, source, language, result.score, result.level, textHash, preview, STORE_FULL_TEXT ? text : null]
      );
      const scanId = inserted.rows[0].id;
      for (const s of result.signals) await client.query('INSERT INTO scan_signals(scan_id,signal_name,points,reason) VALUES($1,$2,$3,$4)', [scanId,s.name,s.points,s.why]);
      await client.query('COMMIT');
      return {id: scanId, created_at: inserted.rows[0].created_at};
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  const item = {id: crypto.randomUUID(), session_id:sessionId, source, language, score:result.score, level:result.level, preview, text_hash:textHash, signals:result.signals, created_at:new Date().toISOString()};
  localStore.unshift(item); saveLocal(); return {id:item.id, created_at:item.created_at};
}

async function listScans(sessionId) {
  if (pool) {
    const q = await pool.query(`SELECT s.id,s.source,s.language,s.score,s.level,s.preview,s.created_at,
      COALESCE(json_agg(json_build_object('name',ss.signal_name,'points',ss.points,'why',ss.reason)) FILTER (WHERE ss.id IS NOT NULL),'[]') signals
      FROM scans s LEFT JOIN scan_signals ss ON ss.scan_id=s.id WHERE s.session_id=$1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT 20`, [sessionId]);
    return q.rows;
  }
  return localStore.filter(x=>x.session_id===sessionId).slice(0,20);
}

async function clearScans(sessionId) {
  if (pool) { await pool.query('DELETE FROM scans WHERE session_id=$1',[sessionId]); return; }
  localStore = localStore.filter(x=>x.session_id!==sessionId); saveLocal();
}

app.get('/api/health', async (req,res)=>res.json({ok:true, database:pool?'postgresql':'local-fallback', timestamp:new Date().toISOString()}));
app.post('/api/analyze', async (req,res)=>{
  try {
    const text = String(req.body?.text || '').trim();
    const source = String(req.body?.source || 'Message').slice(0,40);
    const sessionId = cleanSessionId(req.body?.sessionId);
    if (!sessionId || sessionId.length < 12) return res.status(400).json({error:'Valid sessionId is required.'});
    if (!text || text.length > 20000) return res.status(400).json({error:'Text must contain 1–20,000 characters.'});
    const result = analyze(text);
    const language = languageOf(text);
    const saved = await saveScan({sessionId,source,language,text,result});
    res.json({...result, language, saved, privacy:{storedFullText:STORE_FULL_TEXT}});
  } catch(e) { console.error(e); res.status(500).json({error:'Analysis could not be saved.'}); }
});
app.get('/api/scans', async (req,res)=>{
  try { const sessionId=cleanSessionId(req.query.sessionId); if(!sessionId) return res.status(400).json({error:'sessionId required'}); res.json({scans:await listScans(sessionId)}); }
  catch(e){res.status(500).json({error:'Could not load history.'});}
});
app.delete('/api/scans', async (req,res)=>{
  try { const sessionId=cleanSessionId(req.query.sessionId); if(!sessionId) return res.status(400).json({error:'sessionId required'}); await clearScans(sessionId); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Could not clear history.'});}
});

app.use(express.static(publicDir));
app.use((req,res)=>res.sendFile(path.join(publicDir,'index.html')));

initDb().then(()=>app.listen(PORT,()=>console.log(`NiveshRakshak running on http://localhost:${PORT}`))).catch(err=>{console.error(err);process.exit(1);});
