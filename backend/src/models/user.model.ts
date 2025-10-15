const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');

class User extends Model {}

const initUserModel = (sequelize: any) => {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('patient', 'doctor', 'admin'),
        allowNull: false,
        defaultValue: 'patient',
      },
    },
    {
      sequelize, 
      modelName: 'User',
      tableName: 'users',
      hooks: {
        beforeCreate: async (user: any) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
    }
  );

  return User;
};

module.exports = initUserModel;
