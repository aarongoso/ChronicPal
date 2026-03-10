const { DataTypes, Model } = require("sequelize");
const bcrypt = require("bcrypt"); //bcrypt for hashing user passwords ( Secure app labs)

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
        allowNull: false, // hashed later in hooks so never stored raw
      },

      role: {
        type: DataTypes.ENUM("patient", "doctor", "admin"),
        allowNull: false,
        defaultValue: "patient", // default role for any registered user
      },

      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      mfaSecretCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      mfaSecretIv: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mfaSecretTag: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mfaTempSecretCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      mfaTempSecretIv: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mfaTempSecretTag: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      mfaFailedAttempts: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      mfaLockUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",

      hooks: {
        // Hash password before inserting new user record
        beforeCreate: async (user: any) => {
          if (user.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },

        // Hash password again if it changes during update
        beforeUpdate: async (user: any) => {
          if (user.changed("password")) {
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

export {};