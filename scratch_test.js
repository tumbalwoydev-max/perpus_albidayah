require('dotenv').config();
const http = require('http');

async function run() {
  try {
    // Attempt borrow
    const borrowRes = await fetch('http://localhost:3000/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'student_id=1&book_id[]=1&borrow_date=2026-07-12&expected_return_date=2026-07-19'
    });
    console.log('Borrow Status:', borrowRes.status, await borrowRes.text());

    // Attempt return
    const returnRes = await fetch('http://localhost:3000/transactions/return/1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'return_date=2026-07-12&fine=0'
    });
    console.log('Return Status:', returnRes.status, await returnRes.text());

  } catch(e) {
    console.error(e);
  }
}

run();
