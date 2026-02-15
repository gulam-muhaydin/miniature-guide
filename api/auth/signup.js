const connectDB = require('../../lib/db');
const { User } = require('../../lib/models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`;
};

const getUidCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return `Path=/; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`;
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    await connectDB();
    const { username, email, password, referredBy } = req.body;

    const existingUser = await User.findOne({ email });
    const existingUsername = await User.findOne({ username });
    
    if (existingUser || existingUsername) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      referredBy: referredBy || null
    });

    const userId = user.id || user._id;
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const tokenCookie = `token=${encodeURIComponent(token)}; ${getCookieOptions()}`;
    const uidCookie = `uid=${encodeURIComponent(userId)}; ${getUidCookieOptions()}`;
    res.setHeader('Set-Cookie', [tokenCookie, uidCookie]);
    res.status(201).json({
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        plan: user.plan,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
