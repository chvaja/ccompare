module.exports = function (engine) {
  const globalLimits = {
    day: 100000
  }

  const fees = {
    btc: 0.0004,
    ltc: 0.006,
    bch: 0.003,
    eth: 0.003,
    xrp: 3
  }

  let token = null

  return {

    async resolve (query) {
      if (query.source !== 'czk') {
        return {}
      }
      if (token && (Number(new Date()) - Number(token.time)) > 1000 * 60 * 60) {
        token = null
      }
      if (!token) {
        const login = await engine.fetch({
          url: 'https://www.bitbeli.cz/api/client/auth/login',
          method: 'post',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        token = {
          token: login.data.token,
          time: new Date()
        }
      }
      if (!token) {
        return {}
      }
      const pp = await engine.fetch({
        url: 'https://www.bitbeli.cz/api/client/exchange/currency-crypto-rate-czk/buy',
        headers: {
          authorization: `Bearer ${token.token}`
        }
      })
      if (!pp.data) {
        return {}
      }
      const rate = pp.data[query.target.toUpperCase()]
      if (!rate) {
        return {}
      }
      const fee = fees[query.target] || 0
      const price = (Number(query.value) + Number(fee)) * Number(rate)
      if (price > globalLimits.day) {
        return { error: `maximalní objednávka je ${globalLimits.day} ${query.source.toUpperCase()}` }
      }

      return { price: String(price) }
    }
  }
}
