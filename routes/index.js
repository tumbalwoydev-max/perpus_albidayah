const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Setting = require('../models/Setting');
const Admin = require('../models/Admin');

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/dashboard');
  res.render('login', { title: 'Login', error: req.query.error });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const admin = await Admin.findOne({ where: { username } });
    
    if (admin && await bcrypt.compare(password, admin.password)) {
      req.session.admin = { id: admin.id, username: admin.username };
      return res.redirect('/dashboard');
    }
    
    res.redirect('/login?error=Username atau password salah');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/login?error=Terjadi kesalahan pada server');
  }
});

router.get('/dashboard', (req, res) => {
  if (!req.session.admin) return res.redirect('/login');
  res.render('dashboard', { title: 'Dashboard' });
});

router.get('/settings', async (req, res) => {
    if (!req.session.admin) return res.redirect('/login');
    try {
        const settings = await Setting.findAll();
        // convert to key-value pairs
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);
        res.render('settings', { title: 'Settings', settings: settingsMap });
    } catch (err) {
        console.error(err);
        res.render('settings', { title: 'Settings', settings: {} });
    }
});

router.post('/settings', async (req, res) => {
    if (!req.session.admin) return res.redirect('/login');
    try {
        const { school_name, fine_per_day, max_borrow_days } = req.body;
        
        await Setting.update({ value: school_name }, { where: { key: 'school_name' } });
        await Setting.update({ value: fine_per_day }, { where: { key: 'fine_per_day' } });
        await Setting.update({ value: max_borrow_days }, { where: { key: 'max_borrow_days' } });
        
        res.redirect('/settings');
    } catch (err) {
        console.error(err);
        res.redirect('/settings');
    }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
