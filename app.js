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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: 'perpus_mi_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set true if using HTTPS
}));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables for views (like school_name)
app.use(async (req, res, next) => {
  res.locals.user = req.session.admin || null;
  try {
    const schoolNameSetting = await Setting.findOne({ where: { key: 'school_name' } });
    res.locals.school_name = schoolNameSetting ? schoolNameSetting.value : 'Sistem Perpustakaan';
  } catch (error) {
    res.locals.school_name = 'Sistem Perpustakaan';
  }
  next();
});

// Database Sync and Init Default Data
const initDatabase = async () => {
  try {
    await sequelize.sync({ alter: true }); // Change force: true to drop and recreate
    console.log('Database synced successfully.');

    // Initialize Default Admin
    const adminCount = await Admin.count();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log('Default admin created: admin / admin123');
    }

    // Initialize Default Settings
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
    console.log('Default settings initialized.');

  } catch (err) {
    console.error('Failed to sync database:', err);
  }
};

initDatabase();

// Routes
const indexRoutes = require('./routes/index');
const studentRoutes = require('./routes/students');
const bookRoutes = require('./routes/books');
const transactionRoutes = require('./routes/transactions');

app.use('/', indexRoutes);
app.use('/admin/students', studentRoutes);
app.use('/admin/books', bookRoutes);
app.use('/transactions', transactionRoutes);

app.get('/', (req, res) => {
  if (req.session.admin) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
module.exports = app;