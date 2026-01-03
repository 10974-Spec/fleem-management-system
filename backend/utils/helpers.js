const moment = require('moment');
const crypto = require('crypto');

class Helpers {
  static generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    
    return result;
  }

  static generateUniqueId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${randomStr}`.toUpperCase();
  }

  static formatPhoneNumber(phone) {
    if (!phone) return null;
    
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }

  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static validatePhone(phone) {
    const cleaned = this.formatPhoneNumber(phone);
    return cleaned && cleaned.length === 12 && cleaned.startsWith('254');
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  static calculateSpeed(distanceKm, timeSeconds) {
    if (timeSeconds === 0) return 0;
    return (distanceKm / timeSeconds) * 3600;
  }

  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    return moment(date).format(format);
  }

  static parseDate(dateString, format = 'YYYY-MM-DD') {
    return moment(dateString, format).toDate();
  }

  static isDateInPast(date) {
    return moment(date).isBefore(moment());
  }

  static isDateInFuture(date) {
    return moment(date).isAfter(moment());
  }

  static getDaysDifference(startDate, endDate) {
    return moment(endDate).diff(moment(startDate), 'days');
  }

  static formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  static mergeObjects(target, source) {
    const output = Object.assign({}, target);
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeObjects(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      
      await this.sleep(delay);
      return this.retry(fn, retries - 1, delay * 2);
    }
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '')
      .trim();
  }

  static generatePasswordHash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  static maskString(str, visibleChars = 4) {
    if (!str || str.length <= visibleChars) return str;
    
    const maskedLength = str.length - visibleChars;
    return '*'.repeat(maskedLength) + str.slice(-visibleChars);
  }

  static maskEmail(email) {
    if (!this.validateEmail(email)) return email;
    
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : local;
    
    return `${maskedLocal}@${domain}`;
  }

  static generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  static getCurrentTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  static convertTimezone(date, fromZone, toZone) {
    return moment.tz(date, fromZone).tz(toZone).toDate();
  }
}

module.exports = Helpers;