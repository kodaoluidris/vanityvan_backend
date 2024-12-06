const { Load, Sequelize } = require('../models');
const Op = Sequelize.Op;

class LoadService {
  async createLoad(data) {
    const { loadType, userId, ...loadData } = data;
    switch (loadType) {
      case 'RFP':
        return await Load.create({
          ...loadData,
          userId,
          loadType,
          status: 'ACTIVE',
          details: {
            commodityType: data.commodityType,
            specialInstructions: data.specialInstructions,
            contactInfo: data.contactInfo
          }
        });

      case 'RFD':
        return await Load.create({
          ...loadData,
          userId,
          loadType,
          status: 'ACTIVE',
          details: {
            loadType: data.loadType,
            notes: data.notes
          }
        });

      case 'TRUCK':
        return await Load.create({
          ...loadData,
          userId,
          loadType,
          status: 'ACTIVE',
          details: {
            dimensions: data.dimensions,
            equipmentDetails: data.equipmentDetails,
            driverInfo: data.driverInfo,
            preferredRoutes: data.preferredRoutes,
            certifications: data.certifications,
            additionalEquipment: data.additionalEquipment,
            additionalInfo: data.additionalInfo
          }
        });

      default:
        throw new Error('Invalid load type');
    }
  }

  async getAllLoads() {
    return await Load.findAll();
  }

  async getLoadById(id) {
    return await Load.findByPk(id);
  }

  async updateLoad(id, loadData) {
    const load = await Load.findByPk(id);
    if (!load) return null;
    return await load.update(loadData);
  }

  async deleteLoad(id) {
    const load = await Load.findByPk(id);
    if (!load) return false;
    await load.destroy();
    return true;
  }

  async searchLoads(searchParams) {
    const where = {};
    
    if (searchParams.loadType) {
      where.loadType = searchParams.loadType;
    }
    
    if (searchParams.pickupLocation) {
      where.pickupLocation = {
        [Op.iLike]: `%${searchParams.pickupLocation}%`
      };
    }
    
    if (searchParams.deliveryLocation) {
      where.deliveryLocation = {
        [Op.iLike]: `%${searchParams.deliveryLocation}%`
      };
    }
    
    if (searchParams.status) {
      where.status = searchParams.status;
    }

    return await Load.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = new LoadService(); 