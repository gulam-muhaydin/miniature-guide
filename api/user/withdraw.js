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
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = getToken(req);
    const uid = getUid(req);
    const bodyUserId = req.body?.userId;
    const headerUserId = req.headers['x-user-id'];

    let userId = bodyUserId || headerUserId || uid;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        if (!userId) {
          return res.status(401).json({ message: 'Invalid session' });
        }
      }
    }
    if (!userId) return res.status(401).json({ message: 'No session' });

    const { amount, accountNumber, accountTitle, method } = req.body || {};

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < 500) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is Rs. 500' });
    }
    if (!accountNumber || !accountTitle || !method) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const balance = user.balance || 0;
    const dbUserId = user._id || user.id;
    let referrals = user.referralCount || 0;
    try {
      const referredUsers = await User.find({ referredBy: dbUserId });
      if (Array.isArray(referredUsers)) {
        referrals = referredUsers.length;
      }
    } catch (e) {}
    if (referrals < 1) {
      return res.status(400).json({ message: 'At least 1 referral required' });
    }
    if (balance < numericAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const newBalance = balance - numericAmount;
    const withdrawalRequests = Array.isArray(user.withdrawalRequests) ? user.withdrawalRequests : [];
    const updatedRequests = [
      ...withdrawalRequests,
      {
        amount: numericAmount,
        method,
        accountNumber,
        accountTitle,
        status: 'pending',
        createdAt: new Date()
      }
    ];

    await User.findByIdAndUpdate(user.id || user._id, {
      balance: newBalance,
      withdrawalRequests: updatedRequests,
      referralCount: referrals
    });

    res.status(200).json({
      message: 'Withdrawal request submitted',
      balance: newBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
