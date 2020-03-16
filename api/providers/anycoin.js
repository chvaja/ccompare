module.exports = function (engine) {
  const limits = {
    min: 1,
    max: 250000
  }

  return {

    async resolve (query) {
      const rr = await engine.fetch({ url: 'https://www.anycoin.cz/api/rates' })
      const rates = rr.data.data

      let code = [query.target, query.source]
      if (query.dir === 'sell') {
        code = code.reverse()
      }
      const rate = rates.find(r => r.coin_code === code.join('').toUpperCase())
      if (!rate) {
        return {}
      }
      const price = Number(query.value) * Number(rate.value)
      if (price < limits.min) {
        return { error: `minimální objednávka je ${limits.min} ${query.source.toUpperCase()}` }
      }
      if (price > limits.max) {
        return { error: `maximální objednávka je ${limits.max} ${query.source.toUpperCase()}` }
      }
      return { price }
    }
  }
}
