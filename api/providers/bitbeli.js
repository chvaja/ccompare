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

  return {

    async resolve (query) {
      if (query.source !== 'czk') {
        return {}
      }
      const pp = await engine.fetch({
        url: `https://www.bitbeli.cz/api/client/exchange/currency-crypto-rate-czk/buy`,
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiI3MzU1YzMwMy03NGZhLTRlNmUtYmM0OS0yMDlmNjVlMWUxMDkiLCJzdWIiOiJBbm9ueW1vdXNfQml0YmVsaV9kODUxY2NlMS0wNTJkLTQ2ZjItOWFiMS0yOTA0OTJiMGMwOTR6RWlDNkNFNjgzUW50MDJTd2VqMEZ6ZTJrd1ZlSEZibSIsImlhdCI6MTU4NDI1NzM3OCwiZXhwIjoxNTg0MjY0NTc4fQ.mgnr9zrKrrrivD4eMT5IplyqnzywAmZhrbVHMR05GTR4GhnS7d9eadGYl2SX0Zayam4XuN6MUgmNVcDveTNyLA'
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
