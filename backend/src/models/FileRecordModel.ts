const { DataTypes, Model } = require("sequelize");

class FileRecord extends Model {}

const initFileRecordModel = (sequelize: any) => {
  FileRecord.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      ownerPatientId: {
        type: DataTypes.INTEGER.UNSIGNED, // patient the file belongs to, strict access control
        allowNull: false,
      },

      uploadedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      originalName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      mimeType: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      sizeBytes: {
        type: DataTypes.BIGINT.UNSIGNED, // BIGINT avoids overflow for larger files
        allowNull: false,
      },

      storageProvider: {
        type: DataTypes.STRING(50), // keeps storage abstraction flexible
        allowNull: false,
        defaultValue: "local",
      },

      storageKey: {
        type: DataTypes.STRING(255), // internal storage path/key, separate from original filename
        allowNull: false,
      },

      sha256: {
        type: DataTypes.STRING(64), //SHA-256 hex digest for integrity checking + duplicate detection
        allowNull: false,
      },

      deletedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "FileRecord",
      tableName: "file_records",
      timestamps: true, // createdAt/updatedAt useful for audit timeline + admin review
      paranoid: true, // soft delete preserves record history instead of hard removing metadata
      deletedAt: "deletedAt",
    }
  );

  return FileRecord;
};

module.exports = initFileRecordModel;

export {};