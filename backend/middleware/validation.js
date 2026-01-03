const Joi = require('joi');

const schemas = {
  register: Joi.object({
    name: Joi.string().required().min(2),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Manager', 'Driver').required(),
    companyName: Joi.string().required(),
    companyEmail: Joi.string().email().required(),
    companyPhone: Joi.string().required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  vehicle: Joi.object({
    name: Joi.string().required(),
    plateNumber: Joi.string().required(),
    vehicleType: Joi.string().valid('Truck', 'Van', 'Car', 'Bus', 'Motorcycle', 'Other'),
    fuelType: Joi.string().valid('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear()),
    make: Joi.string(),
    model: Joi.string(),
    currentDriver: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  device: Joi.object({
    imei: Joi.string().length(15).required(),
    name: Joi.string(),
    brand: Joi.string().valid('Teltonika', 'Concox', 'Queclink', 'Meitrack', 'Custom', 'Other').required(),
    protocol: Joi.string(),
    phoneNumber: Joi.string(),
    vehicleId: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  maintenance: Joi.object({
    vehicleId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    type: Joi.string().valid('OilChange', 'TireRotation', 'BrakeService', 'EngineRepair', 'BatteryReplacement', 'General', 'Other').required(),
    description: Joi.string().required(),
    date: Joi.date().required(),
    nextDueDate: Joi.date(),
    odometerAtService: Joi.number().min(0),
    cost: Joi.number().min(0),
    serviceProvider: Joi.string(),
    notes: Joi.string()
  }),

  payment: Joi.object({
    phoneNumber: Joi.string().regex(/^\+?[1-9]\d{1,14}$/).required(),
    subscriptionPlan: Joi.string().valid('Free', 'Premium').required()
  })
};

exports.validate = (schema) => {
  return (req, res, next) => {
    const { error } = schemas[schema].validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    next();
  };
};