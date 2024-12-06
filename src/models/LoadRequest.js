module.exports = (sequelize, DataTypes) => {
    const LoadRequest = sequelize.define('LoadRequest', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        load_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'loads',
                key: 'id'
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'),
            defaultValue: 'PENDING'
        },
        proposed_rate: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        available_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        equipment_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        capacity: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        tableName: 'load_requests',
        timestamps: true,
        underscored: true
    });

    LoadRequest.associate = (models) => {
        LoadRequest.belongsTo(models.Load, {
            foreignKey: 'load_id',
            as: 'load'
        });
        LoadRequest.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    return LoadRequest;
}; 