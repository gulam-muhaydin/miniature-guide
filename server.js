require('dotenv').config();
const handler = require('./api/index');

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  handler.app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = handler;
