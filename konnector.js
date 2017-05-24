'use strict'

const request = require('request')
const requestJSON = require('request-json')
const moment = require('moment')

const {
    log,
    baseKonnector,
    filterExisting,
    linkBankOperation,
    saveDataAndFile,
    models
} = require('cozy-konnector-libs')
const Bill = models.bill

const baseURL = 'https://espaceclient.virginmobile.fr/'

module.exports = baseKonnector.createNew({
  name: 'Virgin mobile',
  description: 'konnector description virginmobile',
  vendorLink: 'https://www.virginmobile.fr/',

  category: 'telecom',
  color: {
    hex: '#D72938',
    css: '#D72938'
  },

  dataType: ['bill'],

  models: [Bill],

  fetchOperations: [
    login,
    parsePage,
    customFilterExisting,
    customSaveDataAndFile,
    linkBankOperation({
      log: log,
      minDateDelta: 1,
      maxDateDelta: 1,
      model: Bill,
      amountDelta: 0.1,
      identifier: ['virgin mobile']
    })
  ]
})

const fileOptions = {
  vendor: 'Virgin mobile',
  dateFormat: 'YYYYMMDD'
}

// Login layer
function login (requiredFields, billInfos, data, next) {
  const signInOptions = {
    method: 'POST',
    jar: true,
    url: `${baseURL}login_check`,
    form: {
      login: requiredFields.login,
      password: requiredFields.password,
      _target_path: 'factures-echeances'
    }
  }

  const client = requestJSON.createClient(baseURL)

  log('info', 'Signing in')
  request(signInOptions, (err, res) => {
    if (err) {
      log('error', 'Signin failed')
      return next('LOGIN_FAILED')
    }

    client.headers.Cookie = res.headers['set-cookie']

    // Download bill information page.
    log('info', 'Fetching bills list')
    client.get('api/getFacturesData', (err, res, body) => {
      if (err || !body.success) {
        log('error', 'An error occured while fetching bills list')
        return next('UNKNOWN_ERROR')
      }

      data.content = body.data
      next()
    })
  })
}

function parsePage (requiredFields, bills, data, next) {
  bills.fetched = []

  const invoices = data.content.infoFacturation.invoices

  for (const inv of invoices) {
    if (inv.pdfDispo) {
      const bill = {
        date: moment(inv.invoiceDate, 'DD/MM/YYYY'),
        amount: parseFloat(`${inv.amount.unite}.${inv.amount.centimes}`),
        pdfurl: `${baseURL}api/getFacturePdf/${inv.invoiceNumber}`
      }

      if (bill.date && bill.amount && bill.pdfurl) {
        bills.fetched.push(bill)
      }
    }
  }

  log('info', `${bills.fetched.length} bill(s) retrieved`)
  next()
}

function customFilterExisting (requiredFields, entries, data, next) {
  filterExisting(null, Bill)(requiredFields, entries, data, next)
}

function customSaveDataAndFile (requiredFields, entries, data, next) {
  saveDataAndFile(null, Bill, fileOptions, ['bill'])(
    requiredFields,
    entries,
    data,
    next
  )
}
