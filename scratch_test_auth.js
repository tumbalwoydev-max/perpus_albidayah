require('dotenv').config();
const express = require('express');
const app = require('./app');
const sequelize = require('./models');

app.use((req, res, next) => {
    req.session.admin = { id: 1, username: 'admin' };
    next();
});

const server = app.listen(0, async () => {
    try {
        await sequelize.sync();
        const port = server.address().port;
        const res = await fetch(`http://localhost:${port}/transactions/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'student_id=1&book_id[]=1&borrow_date=2026-07-12&expected_return_date=2026-07-19'
        });
        console.log('Borrow:', res.status, await res.text());
    } catch(e) {
        console.error(e);
    }
    server.close();
});
