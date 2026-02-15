module.exports = async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const tokenCookie = `token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
  const uidCookie = `uid=; Path=/; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [tokenCookie, uidCookie]);
  res.status(200).json({ message: 'Logged out' });
};
