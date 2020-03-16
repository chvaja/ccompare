module.exports = function (engine) {
  const symbols = {
    czk: '4',
    eur: '2',
    btc: '6',
    eth: '13'
  }
  const apiUrl = 'https://server.simplecoin.eu/v1/exchange/price'

  return {
    name: 'SimpleCoin',

    async resolve (query) {
      const params = {
        from: symbols[query.source],
        to: symbols[query.target],
        amount: query.value,
        direction: query.dir === 'buy' ? 1 : 0
      }
      if (!params.from || !params.to) {
        return {}
      }
      if (query.dir === 'sell') {
        const pcopy = JSON.parse(JSON.stringify(params))
        params.to = pcopy.from
        params.from = pcopy.to
      }
      const out = await engine.fetch({ url: apiUrl + '?' + engine.qs.stringify(params) })
      if (!out.data || !out.data.status) {
        return {
          error: true
        }
      }
      if (out.data.status === 'fail') {
        return {}
      }
      const resp = out.data.response
      return {
        price: resp.price
      }
    }
  }
}
