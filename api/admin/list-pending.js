const connectDB = require('../../lib/db');
const { User } = require('../../lib/models');
const jwt = require('jsonwebtoken');

const getToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const tokenCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
  if (!tokenCookie) return null;
  return decodeURIComponent(tokenCookie.split('=').slice(1).join('='));
};

module.exports = async (req, res) => {
  try {
    await connectDB();
    const paymentRequests = await User.find({ 'paymentProof.status': { $ne: 'none' } });

    res.status(200).json(paymentRequests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
