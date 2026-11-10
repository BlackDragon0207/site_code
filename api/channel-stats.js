require('dotenv').config();
const { getChannelStats } = require('../lib/stats');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
  res.status(200).json(await getChannelStats());
};
