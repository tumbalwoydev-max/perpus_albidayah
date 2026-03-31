const express = require('express');
const session = require('express-session');
const path = require('path');
const sequelize = require('./models');
const bcrypt = require('bcryptjs');

// Models
const Admin = require('./models/Admin');
const Student = require('./models/Student');
const Book = require('./models/Book');
const Transaction = require('./models/Transaction');
const Setting = require('./models/Setting');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: 'perpus_mi_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Otomatis true kalau sudah online (HTTPS)
    maxAge: 24 * 60 * 60 * 1000 // 24 jam
  }
}));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables for views
app.use(async (req, res, next) => {
  res.locals.user = req.session.admin || null;
  try {
    // Tambahkan timeout atau default biar nggak gantung kalau DB lemot
    const schoolNameSetting = await Setting.findOne({ where: { key: 'school_name' } });
    res.locals.school_name = schoolNameSetting ? schoolNameSetting.value : 'MI AL-BIDAYAH';
  } catch (error) {
    res.locals.school_name = 'MI AL-BIDAYAH';
  }
  next();
});

// Database Sync and Init Default Data
const initDatabase = async () => {
  try {
    // Di Vercel/Production, idealnya alter: false agar tidak merusak data. 
    // Tapi karena kita baru setup, kita biarkan dulu.
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    const adminCount = await Admin.count();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log('Default admin created: admin / admin123');
    }

    const defaults = [
      { key: 'school_name', value: 'MI AL-BIDAYAH' },
      { key: 'fine_per_day', value: '1000' },
      { key: 'max_borrow_days', value: '7' }
    ];

    for (const item of defaults) {
      const exists = await Setting.findOne({ where: { key: item.key } });
      if (!exists) {
        await Setting.create(item);
      }
    }
  } catch (err) {
    console.error('Failed to sync database:', err);
  }
};

// Jalankan initDatabase tapi jangan ditunggu (biar app nggak timeout)
initDatabase().then(() => console.log('Init check done.'));

// Routes
const indexRoutes = require('./routes/index');
const studentRoutes = require('./routes/students');
const bookRoutes = require('./routes/books');
const transactionRoutes = require('./routes/transactions');

app.use('/', indexRoutes);
app.use('/admin/students', studentRoutes);
app.use('/admin/books', bookRoutes);
app.use('/transactions', transactionRoutes);

// Root Route Fix
app.get('/', (req, res) => {
  if (req.session && req.session.admin) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Start Server - HANYA JALAN DI LOKAL
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// WAJIB UNTUK VERCEL
module.exports = app;