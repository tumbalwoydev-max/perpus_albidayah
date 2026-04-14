const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const Student = require('./Student');
const Book = require('./Book');

const Transaction = sequelize.define('Transaction', {
  borrow_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expected_return_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  fine: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  batch_id: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Relationships
Student.hasMany(Transaction, { foreignKey: 'student_id' });
Transaction.belongsTo(Student, { foreignKey: 'student_id' });

Book.hasMany(Transaction, { foreignKey: 'book_id' });
Transaction.belongsTo(Book, { foreignKey: 'book_id' });

module.exports = Transaction;
