const { DEFAULT_CONFIG } = require('../config');
const { fetchAllQuotas } = require('./index');

(async () => {
  const res = await fetchAllQuotas(DEFAULT_CONFIG, {});
  console.log(JSON.stringify(res, null, 2));
})();
