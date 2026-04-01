const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const Setting = require('../models/Setting');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');

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

router.get('/dashboard', async (req, res) => {
  if (!req.session.admin) return res.redirect('/login');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [total_students, total_books, borrowed_count, overdue_count, recent_transactions] = await Promise.all([
      Student.count(),
      Book.count(),
      Transaction.count({ where: { return_date: null } }),
      Transaction.count({ 
        where: { 
          return_date: null,
          expected_return_date: { [Op.lt]: today }
        } 
      }),
      Transaction.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [Student, Book]
      })
    ]);

    res.render('dashboard', { 
      title: 'Dashboard',
      stats: {
        total_students,
        total_books,
        borrowed_count,
        overdue_count
      },
      recent_transactions
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard', { 
      title: 'Dashboard',
      stats: { total_students: 0, total_books: 0, borrowed_count: 0, overdue_count: 0 },
      recent_transactions: []
    });
  }
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
