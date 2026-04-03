require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const GOAL = parseInt(process.env.GOAL_AMOUNT) || 20000000;
const ADMIN_KEY = process.env.ADMIN_KEY;

// ============================================================
// DATABASE
// ============================================================
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('[DB] Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  });

const donationSchema = new mongoose.Schema({
  name: String,
  amount: Number,
  message: String,
  date: { type: Date, default: Date.now }
});

const Donation = mongoose.model('Donation', donationSchema);

// One-time migration from db.json
async function migrateData() {
  try {
    const count = await Donation.countDocuments();
    if (count === 0 && fs.existsSync(path.join(__dirname, 'db.json'))) {
      console.log('[SEED] Migrating data from db.json...');
      const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
      if (dbData.donators && dbData.donators.length > 0) {
        await Donation.insertMany(dbData.donators);
        console.log('[SEED] Migration complete!');
      }
    }
  } catch (err) {
    console.error('[SEED] Migration error:', err.message);
  }
}
migrateData();

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));
app.use(bodyParser.json());

// Security: Block direct access to sensitive files
app.use((req, res, next) => {
  const blocked = ['.env', '.gitignore', 'db.json', 'package.json', 'package-lock.json', 'server.js', 'start.bat'];
  const requestedFile = path.basename(req.path);
  if (blocked.includes(requestedFile)) {
    return res.status(403).send('Access denied');
  }
  next();
});

app.use(express.static(__dirname));

// ============================================================
// SECURITY: Admin Key Middleware
// ============================================================
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin Key' });
  }
  next();
}

// ============================================================
// HELPER: sanitize user input to prevent XSS
// ============================================================
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, (ch) => {
    switch (ch) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '&': return '&amp;';
      default: return ch;
    }
  }).trim().substring(0, 200); // limit length too
}

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Get donation stats
app.get('/api/stats', async (req, res) => {
  try {
    const donations = await Donation.find().sort({ date: -1 }).limit(20);
    const total = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      total_collected: total.length > 0 ? total[0].total : 0,
      goal: GOAL,
      donators: donations
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// External webhook (for future payment gateway integration)
app.post('/webhook', async (req, res) => {
  const data = req.body;
  const amount = parseInt(data.amount || 0);
  const senderName = sanitize(data.senderName || "DLG Supporter");
  const message = sanitize(data.content || "Gánh tạ tiếp đi bro!");

  if (amount > 0) {
    try {
      const newDonation = new Donation({ name: senderName, amount, message });
      await newDonation.save();

      const totalRes = await Donation.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const total_collected = totalRes[0].total;

      io.emit('donation_received', { total_collected, new_donation: newDonation });
      console.log(`[WEBHOOK] Saved ${amount} from ${senderName}`);
    } catch (err) {
      console.error('[WEBHOOK] Save error:', err.message);
    }
  }
  res.status(200).send('OK');
});

// ============================================================
// ADMIN ROUTES (Protected by Admin Key)
// ============================================================

// Admin: Add donation manually
app.post('/api/admin/add-donation', requireAdminKey, async (req, res) => {
  const { name, amount, message } = req.body;
  const parsedAmount = parseInt(amount || 0);

  if (parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount: must be > 0' });
  }

  try {
    const newDonation = new Donation({
      name: sanitize(name) || "Ẩn danh",
      amount: parsedAmount,
      message: sanitize(message) || "Gửi lời chào từ Reactor!"
    });

    await newDonation.save();

    const totalRes = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const total_collected = totalRes.length > 0 ? totalRes[0].total : 0;

    io.emit('donation_received', { total_collected, new_donation: newDonation });
    console.log(`[ADMIN] Saved ${parsedAmount} from ${name}`);
    res.json({ success: true, total_collected });
  } catch (err) {
    console.error('[ADMIN] Save error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin: Reset all data
app.get('/api/reset-reactor', requireAdminKey, async (req, res) => {
  if (req.query.confirm !== "true") {
    return res.status(403).send('<h1>CẢNH BÁO!</h1><p>Thêm <b>&confirm=true</b> để xác nhận xoá toàn bộ dữ liệu.</p>');
  }

  try {
    await Donation.deleteMany({});
    io.emit('donation_received', { total_collected: 0, new_donation: null });
    console.log('[ADMIN] Reactor reset: all data purged.');
    res.send('<h1>Reset thành công!</h1><p>Dữ liệu đã xoá sạch.</p>');
  } catch (err) {
    res.status(500).send('Reset failed');
  }
});

// ============================================================
// SOCKET.IO
// ============================================================
io.on('connection', async (socket) => {
  try {
    const donations = await Donation.find().sort({ date: -1 }).limit(10);
    const total = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    socket.emit('init_data', {
      total_collected: total.length > 0 ? total[0].total : 0,
      goal: GOAL,
      donators: donations
    });
  } catch (err) {
    console.error('[SOCKET] Init error:', err.message);
  }
});

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
  console.log(`[SERVER] DLG Backend running on http://localhost:${PORT}`);
  console.log(`[SERVER] Admin panel: http://localhost:${PORT}/admin.html`);
});
