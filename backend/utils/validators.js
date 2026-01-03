const Joi = require('joi');
const moment = require('moment');
const Helpers = require('./helpers');

class Validators {
  static validateEmail(email) {
    const schema = Joi.string().email().required();
    const { error } = schema.validate(email);
    return { isValid: !error, error: error?.message };
  }

  static validatePhone(phone) {
    const schema = Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required();
    const { error } = schema.validate(phone);
    return { isValid: !error, error: error?.message };
  }

  static validatePassword(password) {
    const schema = Joi.string()
      .min(6)
      .max(50)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password cannot exceed 50 characters'
      });
    
    const { error } = schema.validate(password);
    return { isValid: !error, error: error?.message };
  }

  static validateIMEI(imei) {
    const schema = Joi.string()
      .length(15)
      .pattern(/^\d+$/)
      .required();
    
    const { error } = schema.validate(imei);
    return { isValid: !error, error: error?.message };
  }

  static validatePlateNumber(plateNumber) {
    const schema = Joi.string()
      .min(3)
      .max(20)
      .pattern(/^[A-Z0-9\s-]+$/i)
      .required();
    
    const { error } = schema.validate(plateNumber);
    return { isValid: !error, error: error?.message };
  }

  static validateCoordinates(lat, lng) {
    const latSchema = Joi.number().min(-90).max(90).required();
    const lngSchema = Joi.number().min(-180).max(180).required();
    
    const latResult = latSchema.validate(lat);
    const lngResult = lngSchema.validate(lng);
    
    return {
      isValid: !latResult.error && !lngResult.error,
      errors: {
        lat: latResult.error?.message,
        lng: lngResult.error?.message
      }
    };
  }

  static validateDate(date, format = 'YYYY-MM-DD') {
    const schema = Joi.date().iso().required();
    const { error } = schema.validate(date);
    
    if (error) {
      if (moment(date, format, true).isValid()) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Invalid date format' };
    }
    
    return { isValid: true };
  }

  static validateDateTime(dateTime) {
    const schema = Joi.date().iso().required();
    const { error } = schema.validate(dateTime);
    return { isValid: !error, error: error?.message };
  }

  static validateSpeed(speed) {
    const schema = Joi.number().min(0).max(300).required();
    const { error } = schema.validate(speed);
    return { isValid: !error, error: error?.message };
  }

  static validateOdometer(odometer) {
    const schema = Joi.number().min(0).max(1000000).required();
    const { error } = schema.validate(odometer);
    return { isValid: !error, error: error?.message };
  }

  static validateFuelLevel(fuelLevel) {
    const schema = Joi.number().min(0).max(100).required();
    const { error } = schema.validate(fuelLevel);
    return { isValid: !error, error: error?.message };
  }

  static validateVehicleType(vehicleType) {
    const allowedTypes = ['Truck', 'Van', 'Car', 'Bus', 'Motorcycle', 'Other'];
    const schema = Joi.string().valid(...allowedTypes).required();
    const { error } = schema.validate(vehicleType);
    return { isValid: !error, error: error?.message };
  }

  static validateFuelType(fuelType) {
    const allowedTypes = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];
    const schema = Joi.string().valid(...allowedTypes).required();
    const { error } = schema.validate(fuelType);
    return { isValid: !error, error: error?.message };
  }

  static validateDeviceBrand(brand) {
    const allowedBrands = ['Teltonika', 'Concox', 'Queclink', 'Meitrack', 'Custom', 'Other'];
    const schema = Joi.string().valid(...allowedBrands).required();
    const { error } = schema.validate(brand);
    return { isValid: !error, error: error?.message };
  }

  static validateAlertType(alertType) {
    const allowedTypes = [
      'Speeding', 'GeofenceEnter', 'GeofenceExit', 'FuelDrop',
      'IgnitionOn', 'IgnitionOff', 'MaintenanceDue', 'DeviceOffline', 'Tampering'
    ];
    const schema = Joi.string().valid(...allowedTypes).required();
    const { error } = schema.validate(alertType);
    return { isValid: !error, error: error?.message };
  }

  static validateAlertSeverity(severity) {
    const allowedSeverities = ['Low', 'Medium', 'High', 'Critical'];
    const schema = Joi.string().valid(...allowedSeverities).required();
    const { error } = schema.validate(severity);
    return { isValid: !error, error: error?.message };
  }

  static validateMaintenanceType(type) {
    const allowedTypes = [
      'OilChange', 'TireRotation', 'BrakeService', 'EngineRepair',
      'BatteryReplacement', 'General', 'Other'
    ];
    const schema = Joi.string().valid(...allowedTypes).required();
    const { error } = schema.validate(type);
    return { isValid: !error, error: error?.message };
  }

  static validateUserRole(role) {
    const allowedRoles = ['Admin', 'Manager', 'Driver'];
    const schema = Joi.string().valid(...allowedRoles).required();
    const { error } = schema.validate(role);
    return { isValid: !error, error: error?.message };
  }

  static validateSubscriptionPlan(plan) {
    const allowedPlans = ['Free', 'Premium'];
    const schema = Joi.string().valid(...allowedPlans).required();
    const { error } = schema.validate(plan);
    return { isValid: !error, error: error?.message };
  }

  static validatePaymentMethod(method) {
    const allowedMethods = ['Mpesa', 'Card', 'BankTransfer'];
    const schema = Joi.string().valid(...allowedMethods).required();
    const { error } = schema.validate(method);
    return { isValid: !error, error: error?.message };
  }

  static validateAmount(amount) {
    const schema = Joi.number().positive().precision(2).required();
    const { error } = schema.validate(amount);
    return { isValid: !error, error: error?.message };
  }

  static validateURL(url) {
    try {
      new URL(url);
      return { isValid: true };
    } catch (_) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  static validateFileType(file, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) {
    if (!file || !file.mimetype) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
      };
    }

    return { isValid: true };
  }

  static validateFileSize(file, maxSizeMB = 5) {
    if (!file || !file.size) {
      return { isValid: false, error: 'No file provided' };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      return { 
        isValid: false, 
        error: `File size exceeds ${maxSizeMB}MB limit` 
      };
    }

    return { isValid: true };
  }

  static validateJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid JSON format' };
    }
  }

  static validateUUID(uuid) {
    const schema = Joi.string().uuid({ version: 'uuidv4' }).required();
    const { error } = schema.validate(uuid);
    return { isValid: !error, error: error?.message };
  }

  static validateObjectId(id) {
    const schema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();
    const { error } = schema.validate(id);
    return { isValid: !error, error: error?.message };
  }

  static validateTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid timezone' };
    }
  }

  static validateGeofencePoints(points) {
    if (!Array.isArray(points) || points.length < 3) {
      return { isValid: false, error: 'Geofence must have at least 3 points' };
    }

    for (const point of points) {
      const coordResult = this.validateCoordinates(point.lat, point.lng);
      if (!coordResult.isValid) {
        return { 
          isValid: false, 
          error: `Invalid coordinate: ${JSON.stringify(point)}` 
        };
      }
    }

    return { isValid: true };
  }

  static validateVehicleData(data) {
    const schema = Joi.object({
      name: Joi.string().min(2).max(100).required(),
      plateNumber: Joi.string().min(3).max(20).required(),
      vehicleType: Joi.string().valid('Truck', 'Van', 'Car', 'Bus', 'Motorcycle', 'Other'),
      fuelType: Joi.string().valid('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
      year: Joi.number().integer().min(1900).max(new Date().getFullYear()),
      make: Joi.string().max(50),
      model: Joi.string().max(50),
      currentDriver: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    
    return {
      isValid: !error,
      errors: error?.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      validatedData: value
    };
  }

  static validateDeviceData(data) {
    const schema = Joi.object({
      imei: Joi.string().length(15).pattern(/^\d+$/).required(),
      name: Joi.string().max(100),
      brand: Joi.string().valid('Teltonika', 'Concox', 'Queclink', 'Meitrack', 'Custom', 'Other').required(),
      protocol: Joi.string(),
      phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
      vehicleId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    
    return {
      isValid: !error,
      errors: error?.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      validatedData: value
    };
  }

  static validateMaintenanceData(data) {
    const schema = Joi.object({
      vehicleId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
      type: Joi.string().valid(
        'OilChange', 'TireRotation', 'BrakeService', 'EngineRepair',
        'BatteryReplacement', 'General', 'Other'
      ).required(),
      description: Joi.string().min(5).max(500).required(),
      date: Joi.date().iso().required(),
      nextDueDate: Joi.date().iso(),
      odometerAtService: Joi.number().min(0),
      cost: Joi.number().min(0),
      serviceProvider: Joi.string().max(100),
      notes: Joi.string().max(1000)
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    
    return {
      isValid: !error,
      errors: error?.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      validatedData: value
    };
  }

  static validatePaymentData(data) {
    const schema = Joi.object({
      provider: Joi.string().valid('mpesa', 'card', 'bank').required(),
      amount: Joi.number().positive().precision(2).required(),
      currency: Joi.string().default('USD'),
      phoneNumber: Joi.when('provider', {
        is: 'mpesa',
        then: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        otherwise: Joi.forbidden()
      }),
      cardNumber: Joi.when('provider', {
        is: 'card',
        then: Joi.string().creditCard().required(),
        otherwise: Joi.forbidden()
      }),
      expiryMonth: Joi.when('provider', {
        is: 'card',
        then: Joi.number().integer().min(1).max(12).required(),
        otherwise: Joi.forbidden()
      }),
      expiryYear: Joi.when('provider', {
        is: 'card',
        then: Joi.number().integer().min(new Date().getFullYear()).required(),
        otherwise: Joi.forbidden()
      }),
      cvv: Joi.when('provider', {
        is: 'card',
        then: Joi.string().pattern(/^\d{3,4}$/).required(),
        otherwise: Joi.forbidden()
      }),
      accountNumber: Joi.when('provider', {
        is: 'bank',
        then: Joi.string().pattern(/^\d+$/).required(),
        otherwise: Joi.forbidden()
      }),
      bankCode: Joi.when('provider', {
        is: 'bank',
        then: Joi.string().required(),
        otherwise: Joi.forbidden()
      }),
      subscriptionPlan: Joi.string().valid('Free', 'Premium'),
      metadata: Joi.object()
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    
    return {
      isValid: !error,
      errors: error?.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      validatedData: value
    };
  }

  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/[<>]/g, '')
        .trim();
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const key in input) {
        sanitized[key] = this.sanitizeInput(input[key]);
      }
      return sanitized;
    }
    
    return input;
  }

  static validateAll(fields) {
    const errors = [];
    
    for (const field of fields) {
      const { name, value, type, options = {} } = field;
      let result;
      
      switch (type) {
        case 'email':
          result = this.validateEmail(value);
          break;
        case 'phone':
          result = this.validatePhone(value);
          break;
        case 'password':
          result = this.validatePassword(value);
          break;
        case 'imei':
          result = this.validateIMEI(value);
          break;
        case 'plateNumber':
          result = this.validatePlateNumber(value);
          break;
        case 'coordinates':
          result = this.validateCoordinates(value.lat, value.lng);
          break;
        case 'date':
          result = this.validateDate(value, options.format);
          break;
        case 'amount':
          result = this.validateAmount(value);
          break;
        case 'url':
          result = this.validateURL(value);
          break;
        case 'json':
          result = this.validateJSON(value);
          break;
        case 'objectId':
          result = this.validateObjectId(value);
          break;
        case 'uuid':
          result = this.validateUUID(value);
          break;
        default:
          result = { isValid: true };
      }
      
      if (!result.isValid) {
        errors.push({
          field: name,
          message: result.error || 'Validation failed'
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Validators;