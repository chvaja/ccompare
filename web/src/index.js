
const m = require('mithril')
const numeral = require('numeral')

const sellers = require('./sellers')

const symbols = {
  czk: { type: 'fiat', name: 'CZK' },
  eur: { type: 'fiat', name: 'EUR' },
  eth: { type: 'crypto', name: 'ETH' },
  btc: { type: 'crypto', name: 'BTC' },
  dai: { type: 'crypto', name: 'DAI' },
  usdc: { type: 'crypto', name: 'USDC' },
  ltc: { type: 'crypto', name: 'LTC' },
  zec: { type: 'crypto', name: 'ZEC' },
  xlm: { type: 'crypto', name: 'XLM' },
  dash: { type: 'crypto', name: 'DASH' },
  bat: { type: 'crypto', name: 'BAT' }
}

const apiUrl = 'https://api.kurzy.gwei.cz'

const state = {
  dir: 'buy',
  source: 'czk',
  target: 'btc',
  value: '0.1'
}

const params = {
  oracleDiff: true,
  advanced: false,
  debug: false
}

let loading = false
let result = null

function stateSetter (key) {
  return function (e) {
    state[key] = e.target.value
  }
}

function paramCheckbox (key) {
  return function (e) {
    params[key] = e.target.checked
  }
}

function getSymbols (type) {
  return Object.keys(symbols).filter(s => symbols[s].type === type).map(symbol => Object.assign(symbols[symbol], { symbol }))
}
function relDiff (a, b) {
  return 100 * ((a - b) / ((a + b) / 2))
}
function getRoute () {
  return `/${state.dir === 'sell' ? 'prodej' : 'nakup'}/${state.source}/${state.target}/${state.value}`
}
function offsetClass (dir, offset) {
  const n = Number(offset)
  if (n === 0) {
    return ''
  }
  if ((dir !== 'sell' && n > 6) || (dir === 'sell' && n < -6)) {
    return 'is-red'
  }
  if ((dir !== 'sell' && n >= 3) || (dir === 'sell' && n <= -3)) {
    return 'is-yellow'
  }
  if ((dir !== 'sell' && n < 3) || (dir === 'sell' && n > -3)) {
    return 'is-green'
  }
  return 'is-none'
}

const defaultRoute = getRoute()

function doSearch () {
  if (Number(state.value) === 0) {
    return null
  }
  loading = true
  const r = getRoute()
  if (r === defaultRoute) {
    m.route.set('/')
  } else {
    m.route.set(r)
  }
  m.request(`${apiUrl}/exchange?${m.buildQueryString(state)}`).then(res => {
    loading = false
    result = res
  }).catch(err => {
    loading = false
    console.error(JSON.stringify(err, null, 2))
  })
  return false
}

const Table = {
  view (vnode) {
    if (loading) {
      return m('div', { style: 'text-align: center; margin-top: 5em; margin-bottom: 10em;' }, m('.loading'))
    }
    if (!result) {
      return m('div', '')
    }
    let best = null
    if (vnode.attrs.oracleDiff) {
      best = result.items.filter(i => i.price && i.oracle)[0]
    } else {
      best = result.items.filter(i => i.price && !i.oracle)[0]
    }
    return m('table.table.is-fullwidth.cc-table', { style: 'margin-bottom: 1em; margin-top: 0.5em;' }, [
      m('thead', [
        m('th', ''),
        m('th', { align: 'center' }, 'Kurz'),
        m('th', { align: 'center' }, 'Rozdíl'),
        m('th', { align: 'right' }, 'Cena')
      ]),
      m('tbody', result.items.map(r => {
        const offset = best ? relDiff(Number(r.price), Number(best.price)) : null
        const seller = sellers[r.seller] || { name: r.seller }
        const cl = offsetClass(result.dir, offset)
        const sellerTd = [
          m(`.seller-ico.seller-${seller.ico || r.seller}`),
          r.oracle ? m.trust(`Referenční cena [<a href="${r.url}" target="_blank">${seller.name}</a>]`) : m('a', { href: seller.url, target: '_blank' }, seller.name + (r.origSymbol ? ` [${r.origSymbol.toUpperCase()}]` : ''))
        ]

        if (!r.price) {
          return m('tr.is-inactive', [
            m('td', sellerTd),
            m('td', { colspan: 3, align: 'center' }, `-- ${r.error ? r.error : 'žádné data'} --`)
          ])
        }
        const showPrice = () => {
          const primary = `${r.orig ? '~ ' : ''}${numeral(Math.round(r.price * 100) / 100).format('0,0.00')} ${symbols[result.source].name}`
          const secondary = r.orig ? `<small>${numeral(Math.round(r.orig * 100) / 100).format('0,0.00')} ${(r.origSymbol || '').toUpperCase()}</small>` : ''
          return m.trust([!r.oracle ? `<b>${primary}</b>` : primary, secondary].join('<br>'))
        }

        return m('tr', { class: `${r.oracle ? 'is-oracle' : ''}` }, [
          m('td', sellerTd),
          m('td', { align: 'center', style: 'font-size: 0.8em; line-height: 1.2em;' }, r.price ? m.trust(numeral(Number(r.price) / Number(result.value)).format('0,0.00') + ` ${symbols[result.source].name}` + `<br>$${numeral(Number(r.alt) / Number(result.value)).format('0,0.00')}`) : ''),
          m('td', { align: 'center', class: cl }, r.price ? (offset ? `${offset > 0 ? '+' : ''}${Math.round(offset * 100) / 100}%` : (r.oracle ? '0%' : 'nejlepší nabídka')) : ''),
          m('td', { align: 'right', style: `${r.orig ? 'line-height: 1.1em; padding-top: 0.4em; padding-bottom: 0.3em;' : ''}` }, r.price ? showPrice() : '')
        ])
      }))
    ])
  }
}

const Form = {
  view () {
    return [
      m('.columns.is-centered', { style: 'margin-top: 0;' }, [
        m('.column.is-two-thirds', [
          m('form', { onsubmit: doSearch }, [
            m('.level', { style: '' }, [
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('dir'), value: state.dir }, [
                    m('option', { value: 'buy' }, 'Koupit'),
                    m('option', { value: 'sell' }, 'Prodat')
                  ])
                ])
              ]),
              m('.level-item', [
                m('input.input', { type: 'text', placeholder: 'Částka', oninput: stateSetter('value'), value: state.value })
              ]),
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('target'), value: state.target }, getSymbols('crypto').map(s => {
                    return m('option', { value: s.symbol }, s.name)
                  }))
                ])
              ]),
              m('.level-item', 'za'),
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('source'), value: state.source }, getSymbols('fiat').map(s => {
                    return m('option', { value: s.symbol }, s.name)
                  }))
                ])
              ]),
              m('.level-item', [
                m('button.button.is-primary', { onclick: doSearch }, 'Hledat')
              ])
            ])
          ])
        ])
      ]),
      !params.advanced ? '' : m('.columns.is-centered', [
        m('.column.is-two-thirds', [
          m('.level', [
            m('.level-left', [
              m('.level-item', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: paramCheckbox('oracleDiff'), checked: params.oracleDiff }),
                  m('span', { style: 'margin-left: 0.5em;' }, 'Rozdíl ceny vůči referenčnímu kurzu')
                ])
              ]),
              m('.level-item', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: paramCheckbox('debug'), checked: params.debug }),
                  m('span', { style: 'margin-left: 0.5em;' }, 'Debug')
                ])
              ])
            ])
          ])
        ])
      ])
    ]
  }
}

const Debug = {
  view () {
    return !params.debug ? '' : m('div', [
      m('div', { style: 'margin-top: 5em;' }, [
        m('.title.is-5', 'Debug (input)'),
        m('pre.code', '// state\n' + JSON.stringify(state, null, 2)),
        m('pre.code', '// params\n' + JSON.stringify(params, null, 2))
      ]),
      m('div', { style: 'margin-top: 5em;' }, [
        m('.title.is-5', 'Debug (result)'),
        m('pre.code', JSON.stringify(result, null, 2))
      ])
    ])
  }
}

const Page = {
  oninit (vnode) {
    if (!vnode.attrs) {
      return null
    }
    if (vnode.attrs) {
      for (const k of Object.keys(vnode.attrs)) {
        if (state[k]) {
          if (k === 'dir') {
            state[k] = vnode.attrs[k] === 'nakup' ? 'buy' : 'sell'
          } else {
            state[k] = vnode.attrs[k]
          }
        }
      }
    }
    console.log(state)
    doSearch()
  },
  view () {
    return m('.section', [
      m('.container', [
        m('.columns.is-centered', [
          m('.column.is-three-quarters', [
            m('.figure', { style: 'text-align: center; margin-bottom: 1em;' }, [
              // m('.title.is-1', m.trust('Czech Crypto Index')),
              m('.title.is-2', 'Nejvýhodnější kurzy kryptoměn v CZK/EUR')
            ])
          ])
        ]),
        m(Form),
        m('.columns.is-centered', [
          m('.column.is-three-quarters', [
            m(Table, params),
            m(Debug)
          ])
        ]),
        m('div', { align: 'center', style: 'margin-top: 5em;' }, [
          m('a', { href: 'https://gwei.cz', target: '_blank' }, m('.gwei-logo')),
          m('div', m.trust('Vytvořeno <a href="https://gwei.cz">Gwei.cz</a> komunitou&nbsp;&nbsp; ❤️  &nbsp;pro Vás s láskou')),
          m('div', { style: 'margin-top: 0.5em; font-size: 1.2em;' }, m.trust('<a href="https://discord.gg/FpxwbnM" target="_blank">Připojte se na náš Discord</a>'))
        ])
      ])
    ])
  }
}

const root = document.getElementById('app')
m.mount(root, Page)

m.route(root, '/', {
  '/': Page,
  '/:dir/:source/:target/:value': Page
})
