const moment = require('moment');

const parsers = {
  Teltonika: (data) => {
    if (typeof data === 'string') {
      const parts = data.split(',');
      if (parts.length >= 10) {
        return {
          lat: parseFloat(parts[2]),
          lng: parseFloat(parts[3]),
          speed: parseFloat(parts[5]) || 0,
          heading: parseFloat(parts[6]) || 0,
          altitude: parseFloat(parts[7]) || 0,
          ignition: parts[8] === '1',
          timestamp: moment.utc(parts[1], 'YYYY-MM-DD HH:mm:ss').toDate()
        };
      }
    }
    throw new Error('Invalid Teltonika format');
  },

  Concox: (data) => {
    if (typeof data === 'string') {
      const parts = data.split(',');
      if (parts.length >= 15) {
        const lat = parseFloat(parts[2]);
        const lng = parseFloat(parts[4]);
        const latDir = parts[3];
        const lngDir = parts[5];
        
        return {
          lat: latDir === 'S' ? -lat : lat,
          lng: lngDir === 'W' ? -lng : lng,
          speed: parseFloat(parts[6]) || 0,
          heading: parseFloat(parts[7]) || 0,
          ignition: parts[11] === '1',
          timestamp: moment.utc(`${parts[0]} ${parts[1]}`, 'YYMMDD HHmmss').toDate()
        };
      }
    }
    throw new Error('Invalid Concox format');
  },

  Queclink: (data) => {
    if (typeof data === 'string') {
      const match = data.match(/GPRMC,(\d{6}\.\d{3}),A,(\d{4}\.\d{4}),([NS]),(\d{5}\.\d{4}),([EW]),(\d+\.?\d*),(\d+\.?\d*),(\d{6})/);
      if (match) {
        const lat = parseFloat(match[2]);
        const lng = parseFloat(match[4]);
        
        return {
          lat: match[3] === 'S' ? -lat/100 : lat/100,
          lng: match[5] === 'W' ? -lng/100 : lng/100,
          speed: parseFloat(match[6]) * 1.852 || 0,
          heading: parseFloat(match[7]) || 0,
          timestamp: moment.utc(match[8], 'DDMMYY').toDate()
        };
      }
    }
    throw new Error('Invalid Queclink format');
  },

  Custom: (data) => {
    try {
      const parsed = JSON.parse(data);
      return {
        lat: parseFloat(parsed.latitude || parsed.lat),
        lng: parseFloat(parsed.longitude || parsed.lng || parsed.lon),
        speed: parseFloat(parsed.speed) || 0,
        heading: parseFloat(parsed.heading) || 0,
        altitude: parseFloat(parsed.altitude) || 0,
        ignition: Boolean(parsed.ignition),
        fuelLevel: parseFloat(parsed.fuel) || undefined,
        batteryLevel: parseFloat(parsed.battery) || undefined,
        odometer: parseFloat(parsed.odometer) || undefined,
        timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date()
      };
    } catch (e) {
      throw new Error('Invalid Custom JSON format');
    }
  }
};

exports.parseData = (data, brand) => {
  const parser = parsers[brand] || parsers.Custom;
  return parser(data);
};

exports.supportedBrands = () => {
  return Object.keys(parsers);
};