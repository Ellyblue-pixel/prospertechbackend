
import express from 'express'; 
import sqlite3 from 'sqlite3'; 
import cors from 'cors'; 
const app=express(); 
app.use(cors()); 
app.use(express.urlencoded({extended:true})); 
app.use(express.json());

// ===== PASTE YOUR KEYS HERE ===== 
const PUBLIC_KEY  = 'pk_live_xxxxxxxxxxxxxxxx'; // For reference only
const SECRET_KEY  = 'sk_live_xxxxxxxxxxxxxxxx'; // <-- Your SECRET key here. Never share

// ===== DATABASE SETUP ===== 
const db=new sqlite3.Database('users.db');

// Users table = Join/Auth info
db.run(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  name TEXT, 
  number TEXT,
  email TEXT UNIQUE,
  country TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Payments table = Who paid + when
db.run(`CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY,
  user_email TEXT,
  amount REAL,
  currency TEXT,
  status TEXT,        // success, failed, pending
  ref TEXT,           // payment reference from provider
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_email) REFERENCES users(email)
)`);

// ===== ROUTES ===== 

// 1. SAVE JOIN/ AUTH INFO 
app.post('/api/join',(req,res)=>{
 const {name,number,email,country}=req.body;
 if(!email) return res.status(400).json({ok:false, error:'Email required'});
 
 db.run('INSERT OR IGNORE INTO users(name,number,email,country) VALUES(?,?,?,?)',
 [name,number,email,country], function(err){
  if(err) return res.status(500).json({ok:false, error: err.message});
  res.json({ok:true, user_id: this.lastID});
 });
});

// 2. SAVE PAYMENT - Call this from frontend after payment succeeds
app.post('/api/pay',(req,res)=>{
 // ===== PASTE SECRET KEY LOGIC HERE LATER ===== 
 // Example for Stripe: verify signature using SECRET_KEY
 
 const {email, amount, currency, ref, status} = req.body;
 if(!email || !amount) return res.status(400).json({ok:false, error:'Missing data'});

 db.run('INSERT INTO payments(user_email, amount, currency, status, ref) VALUES(?,?,?,?,?)',
 [email, amount, currency || 'USD', status || 'success', ref || 'manual'], function(err){
  if(err) return res.status(500).json({ok:false, error: err.message});
  res.json({ok:true, payment_id: this.lastID, key_set: SECRET_KEY!=='sk_live_xxxxxxxxxxxxxxxx'});
 });
});

// 3. ADMIN PANEL - See Users + Who Paid + When
app.get('/admin',(req,res)=>{ 
 const query = `
  SELECT u.id, u.name, u.email, u.number, u.country, u.created as joined_at,
         p.id as pay_id, p.amount, p.currency, p.status, p.ref, p.paid_at
  FROM users u 
  LEFT JOIN payments p ON u.email = p.user_email 
  ORDER BY u.id DESC, p.paid_at DESC
 `;
 
 db.all(query,[],(err,rows)=>{
  if(err) return res.send('DB Error: '+err.message);
  
  let html = `<style>
    body{background:#000;color:#0f0;font-family:mono;padding:20px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
    td,th{border:1px solid #0f0;padding:6px;text-align:left}
    .paid{color:#00ff88;font-weight:700}
    .unpaid{color:#ff5555}
  </style>
  <h1>Admin Panel</h1>
  <p><b>Secret Key Set:</b> ${SECRET_KEY!=='sk_live_xxxxxxxxxxxxxxxx' ? '✅ Yes' : '❌ No'}</p>
  <table>
  <tr><th>User</th><th>Email</th><th>Country</th><th>Joined</th><th>Payment</th><th>Amount</th><th>Status</th><th>Paid At</th></tr>`;
  
  rows.forEach(r=>{
    const paidClass = r.pay_id ? 'paid' : 'unpaid';
    const payText = r.pay_id ? `ID:${r.pay_id}` : 'No Payment';
    html += `<tr>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${r.country}</td>
      <td>${r.joined_at}</td>
      <td class="${paidClass}">${payText}</td>
      <td>${r.amount || '-'}</td>
      <td class="${paidClass}">${r.status || '-'}</td>
      <td>${r.paid_at || '-'}</td>
    </tr>`;
  });
  html += `</table>`;
  res.send(html);
 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log('Running on port '+PORT));
---

