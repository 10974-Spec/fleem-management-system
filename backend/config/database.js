module.exports = {
  url: process.env.MONGODB_URI || 'mongodb://localhost:27017/fleet_management',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};