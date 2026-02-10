const { DataTypes, Model } = require("sequelize");

class Favourite extends Model {}

const initFavouriteModel = (sequelize: any) => {
  Favourite.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Patient user who saved this favourite
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // food + medication favourites only
      type: {
        type: DataTypes.ENUM("FOOD", "MEDICATION"),
        allowNull: false,
      },

      // Display name (never store raw payloads here)
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      // external ID (if item came from an external API)
      externalId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },

      // source tag for explainability / UI grouping
      source: {
        type: DataTypes.ENUM(
          "NUTRITIONIX",
          "OPENFOODFACTS",
          "OPENFDA",
          "DAILYMED",
          "MANUAL"
        ),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Favourite",
      tableName: "favourites",
      indexes: [
        { fields: ["userId", "type"] },
        { fields: ["userId", "type", "name"] },
        // Helps avoid accidental duplicates
        { fields: ["userId", "type", "externalId"] },
      ],
    }
  );

  return Favourite;
};

module.exports = initFavouriteModel;

export {};
