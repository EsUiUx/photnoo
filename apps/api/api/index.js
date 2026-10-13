// Vercel Function entry: every request is rewritten here (vercel.json) and handed to the Nest app,
// compiled by `turbo run build` into dist/ before Vercel bundles this file.
const { getHandler } = require('../dist/serverless.js');

module.exports = async (req, res) => {
  const handle = await getHandler();
  handle(req, res);
};
