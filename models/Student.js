const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Student = sequelize.define('Student', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nisn: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  class: {
    type: DataTypes.STRING,
    allowNull: false
  },
  qr_code_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  photo_path: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = Student;
