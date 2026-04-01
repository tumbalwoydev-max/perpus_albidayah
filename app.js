const express = require('express');
const session = require('express-session');
const path = require('path');
const sequelize = require('./models');
const bcrypt = require('bcryptjs');

// Models
const Admin = require('./models/Admin');
const Setting = require('./models/Setting');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup - Optimized for Vercel
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const sessionStore = new SequelizeStore({
  db: sequelize,
});

app.use(session({
  secret: 'perpus_mi_secret_key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for secure cookie behind Vercel proxy
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Sync session store
sessionStore.sync();

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables for views
app.use(async (req, res, next) => {
  res.locals.user = req.session.admin || null;
  res.locals.school_name = 'MI AL-BIDAYAH'; // Default value
  try {
    const schoolNameSetting = await Setting.findOne({ where: { key: 'school_name' } });
    if (schoolNameSetting) res.locals.school_name = schoolNameSetting.value;
  } catch (e) {
    console.log('Setting fetch skipped');
  }
  next();
});

// Database Sync - Jalankan secara background agar tidak memicu timeout Vercel
const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    
    const adminCount = await Admin.count();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({ username: 'admin', password: hashedPassword });
    }
  } catch (err) {
    console.error('DB Init Error:', err.message);
  }
};
initDatabase();

// Routes
app.use('/', require('./routes/index'));
app.use('/admin/students', require('./routes/students'));
app.use('/admin/books', require('./routes/books'));
app.use('/transactions', require('./routes/transactions'));

app.get('/', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/dashboard');
  res.redirect('/login');
});

// Start Server - Hanya untuk lokal
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
}

module.exports = app;