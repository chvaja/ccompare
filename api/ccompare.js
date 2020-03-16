const fs = require('fs')
const path = require('path')
const axios = require('axios')
const qs = require('querystring')
const crypto = require('crypto')

const symbols = require('./symbols')

const oracles = {
  'coinbase-pro': {
    name: 'Coinbase Pro'
  },
  kraken: {
    name: 'Kraken'
  }
}

class CCompare {
  constructor ({ server }) {
    this.server = server
    this.axios = axios
    this.oracleRates = {}
    this.cacheDir = path.join(__dirname, 'cache')
    this.cacheTimeout = 15 * 1000
    this.qs = qs
  }

  async start () {
    await this.initRoutes()
    this.providers = await this.loadProviders()
    console.log(`Providers: ${this.providers.map(p => p.id).join(', ')}`)
    this.rates = await this.fiatRates()
    console.log(`Fiat rates: ${JSON.stringify(this.rates)}`)
    console.log('CCompare engine started')
  }

  hash (obj) {
    return String(crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex'))
  }

  saveCache (key, obj) {
    const fn = path.join(this.cacheDir, key)
    fs.writeFileSync(fn, JSON.stringify({ data: obj, time: new Date() }))
  }

  loadCache (key) {
    const fn = path.join(this.cacheDir, key)
    if (fs.existsSync(fn)) {
      const res = JSON.parse(fs.readFileSync(fn).toString())
      const offset = (Number(new Date()) - Number(new Date(res.time)))
      if (offset > (this.cacheTimeout - (Math.random(1) * 1000))) {
        return null
      }
      return res.data
    }
    return null
  }

  async index () {
    return {
      welcome: 'ccompare-czsk-api',
      exampleUrl: 'https://api.kurzy.gwei.cz/exchange?value=1&source=czk&target=eth'
    }
  }

  async initRoutes () {
    this.server.route({
      method: 'GET',
      path: '/',
      handler: req => this.index()
    })
    this.server.route({
      method: 'GET',
      path: '/exchange',
      handler: req => this.search(req.query)
    })
  }

  async fiatRates () {
    const pairs = ['EUR_USD', 'CZK_USD', 'CZK_EUR']
    const url = `https://free.currconv.com/api/v7/convert?q=${pairs.join(',')}&compact=ultra&apiKey=8404d330d1950e8dd69c`
    const res = await axios.get(url)
    return res.data
  }

  oracleRateUrl (seller, base, symbol, web = false) {
    if (web) {
      return `https://cryptowat.ch/markets/${seller}/${[symbol, base].join('/').toLowerCase()}`
    }
    return `https://api.cryptowat.ch/markets/${seller}/${(symbol + base).toLowerCase()}/price`
  }

  async oracleRate (market, base, symbol) {
    const key = [market, base, symbol].join(':')
    if (!this.oracleRates[key] || (Number(new Date()) - Number(this.oracleRates[key].time)) > (1000 * 30)) {
      const res = await this.fetch({ url: this.oracleRateUrl(market, base, symbol) })
      // console.log(base, symbol, res)
      this.oracleRates[key] = {
        rate: res.data.result.price,
        time: new Date()
      }
    }
    return this.oracleRates[key].rate
  }

  async search (query) {
    const startTime = new Date()
    if (!query.value || !query.source || !query.target) {
      throw new Error('Bad params')
    }
    query.alt = query.alt || 'usd'
    const out = []
    const sym = symbols[query.target] || {}
    const oracleRef = sym.ref ? [sym.ref[0], sym.ref[2], sym.ref[1]] : ['coinbase-pro', query.alt, query.target]
    const oracleRate = this.oracleRate(...oracleRef)
    await Promise.all(this.providers.map(async p => {
      const obj = { seller: p.id, price: undefined }
      if (!p.resolve) {
        return obj
      }
      // console.log(`-> ${p.id} started`)
      let res
      try {
        res = await p.resolve(query)
      } catch (e) {
        console.error(p.id, e.message)
        return null
      }
      // console.log(`-> ${p.id} done`)
      if (Array.isArray(res)) {
        out.push(...res)
      } else {
        out.push(Object.assign(obj, res))
      }
    }))
    // add oracle rate
    out.push({
      oracle: true,
      seller: `${oracles[oracleRef[0]] ? oracles[oracleRef[0]].name : oracleRef[0]} ${([oracleRef[2], oracleRef[1]].join('/')).toUpperCase()}`,
      price: String((Number(await oracleRate) * Number(query.value)) / Number(this.rates[`${query.source.toUpperCase()}_${query.alt.toUpperCase()}`])),
      url: this.oracleRateUrl(...oracleRef, true),
      sourceUrl: this.oracleRateUrl(...oracleRef)
    })

    // sort
    let sorted = out.filter(i => i.price).sort((a, b) => {
      return a.price > b.price ? 1 : -1
    })
    if (query.dir === 'sell') {
      sorted = sorted.reverse()
    }
    const altRate = this.rates[query.source.toUpperCase() + '_' + query.alt.toUpperCase()]
    for (const i of sorted) {
      i.alt = String(Number(altRate) * Number(i.price))
    }
    return {
      dir: query.dir,
      source: query.source,
      target: query.target,
      value: query.value,
      alt: query.alt,
      items: [].concat(sorted, out.filter(i => !i.price).sort((a, b) => {
        return !a.error ? 1 : -1
      })),
      time: Number(new Date()) - Number(startTime),
      date: new Date()
    }
  }

  async fetch (opts) {
    let out

    const hash = this.hash(opts)
    const cached = this.loadCache(hash)

    if (cached) {
      return cached
    }

    console.log(`==> ${opts.url}`)

    try {
      out = await axios(Object.assign(opts, { timeout: 2000 }))
      this.saveCache(hash, { data: out.data })
    } catch (e) {
      console.error(e.message)
      this.saveCache(hash, { error: e.message })
      return { data: {} }
    }
    return out
  }

  async loadProviders () {
    const provs = []
    const dir = path.join(__dirname, 'providers')
    for (const fn of fs.readdirSync(dir)) {
      const p = require(path.join(dir, fn))(this)
      p.id = fn.split('.')[0]
      provs.push(p)
    }
    return provs
  }
}

module.exports = CCompare
