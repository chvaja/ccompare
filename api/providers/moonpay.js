module.exports = function (engine) {

  const limits = {
    min: 20,
    max: 2000
  }

  const fees = {
    wire: 0.01,
    card: 0.045
  }

  const gql = {
    operationName: "cryptoCurrencies",
    variables: { apiKey: "pk_live_R5Lf25uBfNZyKwccAZpzcxuL3ZdJ3Hc" },
    query: `
      query cryptoCurrencies($apiKey: String!) {
        cryptoCurrencies(apiKey: $apiKey) { id name code icon precision supportsAddressTag supportsLiveMode supportsTestMode isSuspended addressRegex testnetAddressRegex addressTagRegex isSupportedInUS audRate cadRate eurRate gbpRate usdRate zarRate __typename 
        }
      }`
  }

  return {
    async resolve (query) {
      if (query.dir === 'sell') {
        return {}
      }
      const rr = await engine.fetch({
        url: 'https://api.moonpay.io/graphql',
        method: 'post',
        data: JSON.stringify(gql),
        headers: {
          'Content-type': 'application/json'
        }
      }).catch(err => {
        console.error(err, JSON.stringify(err.response.data.errors))
      })
      const symbols = rr.data.data.cryptoCurrencies
      const symbol = symbols.find(s => s.code === query.target)
      if (!symbol) {
        return {}
      }
      let divider = 1
      let origSymbol = query.source
      let suffix = null
      let rateCol = `${query.source}Rate`
      if (query.source === 'czk') {
        divider = 0.037857
        rateCol = 'eurRate'
        suffix = ' -- platba EUR'
        origSymbol = 'eur'
      } else if (!symbol[rateCol]) {
        return {}
      }
      const orig = (symbol[rateCol] * query.value)
      const price = orig / divider
      const out = Object.keys(fees).map(fk => {
        let error = null
        const porig = String(orig + (fees[fk]*orig))
        if (Number(porig) < limits.min) {
          error = `minimální objednávka je ${limits.min} ${origSymbol.toUpperCase()}`
        }
        if (Number(porig) > limits.max) {
          error = `maximální objednávka je ${limits.max} ${origSymbol.toUpperCase()}`
        }
        const pr = String(price + (fees[fk]*price))
        return { seller: `moonpay_${fk}`, price: error ? null : pr, orig: porig, origSymbol, error }
      })
      return out
    }
  }
}
