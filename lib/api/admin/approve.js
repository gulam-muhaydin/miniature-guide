const connectDB = require('../../db');
const { User } = require('../../models');
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
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    await connectDB();

    const { userId, status } = req.body;
    if (!userId || !status) return res.status(400).json({ message: 'Missing data' });
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const existingUser = await User.findById(userId);
    if (!existingUser) return res.status(404).json({ message: 'User not found' });

    const nextPaymentProof = {
      ...(existingUser.paymentProof || {}),
      status
    };

    const user = await User.findByIdAndUpdate(userId, {
      $set: {
        isApproved: status === 'approved',
        paymentProof: nextPaymentProof
      }
    });

    if (status === 'approved' && user && user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        await User.findByIdAndUpdate(user.referredBy, {
          $inc: { referralCount: 1 }
        });
      }
    }

    res.status(200).json({ message: `User ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
