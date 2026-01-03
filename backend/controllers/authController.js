const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const validator = require('validator');

const generateToken = (userId, tenantId, role) => {
  return jwt.sign(
    { userId, tenantId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, companyName, companyEmail, companyPhone } = req.body;

    if (!name || !email || !password || !role || !companyName || !companyEmail) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validator.isEmail(companyEmail)) {
      return res.status(400).json({ error: 'Invalid company email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const existingTenant = await Tenant.findOne({ email: companyEmail });
    if (existingTenant) {
      return res.status(400).json({ error: 'Company already registered' });
    }

    const tenant = new Tenant({
      name: companyName,
      email: companyEmail,
      phone: companyPhone,
      plan: 'Free',
      status: 'Active'
    });

    await tenant.save();

    const user = new User({
      tenantId: tenant._id,
      name,
      email,
      phone,
      role,
      password
    });

    await user.save();

    user.password = undefined;
    const token = generateToken(user._id, tenant._id, user.role);

    res.status(201).json({
      message: 'Registration successful',
      user,
      tenant,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    user.lastLogin = Date.now();
    await user.save();

    user.password = undefined;
    const token = generateToken(user._id, user.tenantId, user.role);

    res.json({
      message: 'Login successful',
      user,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tenant = await Tenant.findById(user.tenantId);
    
    res.json({
      user,
      tenant
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};