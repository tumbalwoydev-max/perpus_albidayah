const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/dashboard');
  res.render('login', { title: 'Login' });
});

router.post('/login', async (req, res) => {
  // Dummy logic, real implementation will use Admin model and bcrypt
  const { username, password } = req.body;
  if(username === 'admin' && password === 'admin123') { // hardcoded fallback checking
    req.session.admin = { username: 'admin' };
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
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
