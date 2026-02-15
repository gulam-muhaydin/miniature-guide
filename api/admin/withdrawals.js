const connectDB = require('../../lib/db');
const { User } = require('../../lib/models');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    await connectDB();
    const users = await User.find({});
    const withdrawals = [];

    users.forEach((user) => {
      const requests = Array.isArray(user.withdrawalRequests) ? user.withdrawalRequests : [];
      requests.forEach((request) => {
        withdrawals.push({
          userId: user._id || user.id,
          username: user.username,
          amount: request.amount,
          method: request.method,
          accountNumber: request.accountNumber,
          accountTitle: request.accountTitle,
          status: request.status || 'pending',
          createdAt: request.createdAt
        });
      });
    });

    withdrawals.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
