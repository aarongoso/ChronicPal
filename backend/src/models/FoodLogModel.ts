const { DataTypes, Model } = require("sequelize");

class FoodLog extends Model {}

const initFoodLogModel = (sequelize: any) => {
  FoodLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Patient user who logged the entry
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // External API source used
      // Manual is supported for homemade meals etc
      source: {
        type: DataTypes.ENUM("NUTRITIONIX", "OPENFOODFACTS", "MANUAL"),
        allowNull: false,
      },

      // External ID so can fetch server side and also avoid tampering
      // Manual entries there is no external id
      externalId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      brand: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      caloriesKcal: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      // Storing a small structured subset for quick reporting / future AI
      macros: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      // Optional trigger/flare-up flags (tri state= true/false/null for unknown)
      riskTags: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      // When patient consumed it (important for insights)
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      // Sanitised snapshot of external response relied on when logging
      externalRaw: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "FoodLog",
      tableName: "food_logs",
      indexes: [
        { fields: ["userId", "consumedAt"] },
        { fields: ["userId", "externalId"] },
      ],
    }
  );

  return FoodLog;
};

module.exports = initFoodLogModel;

export {};