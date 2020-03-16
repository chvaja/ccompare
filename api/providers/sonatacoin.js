
module.exports = function (engine) {
  return {

    async resolve (query) {
      const pg = await engine.fetch({ url: 'https://sonatacoin.cz/' })
      const m = pg.data.match(/var orderFormSettings = (\{.+\});\n/)
      if (!m) {
        return {}
      }
      const res = JSON.parse(m[1])
      const symbol = res.currencies.find(s => s.code === query.target.toUpperCase())
      if (!symbol) {
        return {}
      }
      const rate = query.dir === 'sell' ? symbol.finalSaleRate : symbol.finalPurchaseRate
      const price = rate * query.value
      return { price }
    }
  }
}
