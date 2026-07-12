require('dotenv').config();
const sequelize = require('./models/index');
const Transaction = require('./models/Transaction');

async function test() {
  try {
    const trx = await Transaction.findOne();
    console.log("Transaction works. batch_id is:", trx ? trx.batch_id : "No transactions");
  } catch(e) {
    console.error("Error reading Transaction:", e);
  }
}
test();
