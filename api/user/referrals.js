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

const getUid = (req) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const uidCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('uid='));
  if (!uidCookie) return null;
  return decodeURIComponent(uidCookie.split('=').slice(1).join('='));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = getToken(req);
    const headerUserId = req.headers['x-user-id'];
    let sessionUserId = headerUserId || getUid(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        sessionUserId = decoded.userId;
      } catch (e) {
        if (!sessionUserId) {
          return res.status(401).json({ message: 'Invalid session' });
        }
      }
    }
    if (!sessionUserId) return res.status(401).json({ message: 'No session' });

    await connectDB();
    const user = await User.findById(sessionUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const refId = user._id || user.id;
    const referrals = await User.find({ referredBy: refId });

    const safe = Array.isArray(referrals) ? referrals.map((u) => ({
      id: u._id || u.id,
      username: u.username,
      plan: u.plan,
      isApproved: !!u.isApproved,
      paymentStatus: u.paymentProof?.status || 'none'
    })) : [];

    res.status(200).json({
      referrals: safe,
      total: safe.length,
      approved: safe.filter(r => r.isApproved).length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
