module.exports = function (engine) {
  const symbols = {
    fiat: ['czk', 'eur']
  }

  const pairs = {
    czk: {
      eth: true,
      btc: true,
      ltc: true
    },
    eur: {
      eth: true,
      btc: true,
      ltc: true,
      dai: 'DAI'
    }
  }

  const fees = {
    ETH_CZK: 0.0015,
    ETH_EUR: 0.0015,
    BTC_CZK: 0.0025,
    BTC_EUR: 0.0025,
    LTC_CZK: 0.0025,
    LTC_EUR: 0.0025
  }

  return {
    name: 'CoinMate',

    async resolve (query) {
      let pair = null
      if (symbols.fiat.indexOf(query.source) !== -1 && pairs[query.source][query.target]) {
        const tg = typeof (pairs[query.source][query.target]) === 'string'
          ? pairs[query.source][query.target]
          : query.target.toUpperCase()
        pair = `${tg}_${query.source.toUpperCase()}`
      }
      if (!pair) {
        return {}
      }
      const url = `https://coinmate.io/api/orderBook?currencyPair=${pair}&groupByPriceLimit=False`
      const bres = await engine.fetch({ url })
      const data = bres.data.data
      // console.log(bres)
      const book = query.dir === 'buy' ? data.asks : data.bids
      let rest = Number(query.value)
      let cost = 0
      for (const i of book) {
        if (rest <= 0) {
          break
        }
        if (i.amount > rest) {
          cost += rest * i.price
          rest = 0
        } else if (i.amount <= rest) {
          cost += i.amount * i.price
          rest -= i.amount
        }
      }
      if (rest > 0) {
        return {
          error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})`
        }
      }
      // fee
      if (fees[pair]) {
        cost += cost * fees[pair]
      }
      return {
        price: String(cost)
      }
    }
  }
}
