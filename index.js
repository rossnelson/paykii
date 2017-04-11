const fs = require('fs');
const path = require('path');
const q = require('q');
const axios = require('axios');
const _ = require('lodash');
const Mustache = require('mustache');
const parseString = require('xml2js').parseString;
const Item = require('./item')();

global.PAYKII_BASE_PATH = __dirname;

class Paykii {

  constructor() {
    this.config = {};
    loadTemplates.call(this);
  }

  configure(config) {
    _.merge(this.config, config);
  }

  wsdl() {
    const adapter = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8' ,
      }
    });

    return adapter.get(`${this.config.path}?wsdl`);
  }

  allFunctions() {
    const defer = q.defer();

    this.wsdl()
    .then(res => {
      parseString(res.data, function (err, result) {
        const types = result['wsdl:definitions']['wsdl:types'][0]['s:schema'][0]['s:element'];
        const allNames = _.map(types, type => type['$']['name']);
        const names = _.filter(allNames, name => !name.match(/Response/));
        defer.resolve(names);
      });
    })
    .catch(err => defer.reject(err));

    return defer.promise;
  }

  simpleCall(method) {
    const xml = buildXML.call(this, method, this.config);
    return request.call(this, method, xml);
  }

  amountDueCall(BillerID, SKU, Inputs) {
    const xml = buildXML.call(this, 'AmountDue', { BillerID, SKU, Inputs });
    return request.call(this, 'AmountDue', xml);
  }

  checkPaymentCall(EntityTransactionID) {
    const xml = buildXML.call(this, 'VerifyPaymentStatus', {
      EntityTransactionID,
      EntityTransactionIDVerify: EntityTransactionID
    });
    return request.call(this, 'VerifyPaymentStatus', xml);
  }

  paymentCall(BillerID, SKU, {
    EntityTransactionID,
    Input1,
    Amount,
    SenderName,
    SenderDateOfBirth,
    SenderLocation,
    SenderEmail,
    SenderMobileNumber,
    BeneficiaryName,
    BeneficiaryMobileNumber
  }) {
    const xml = buildXML.call(this, 'ProcessPayment', {
      EntityTransactionID,
      BillerID,
      SKU,
      Input1,
      Amount,
      SenderName,
      SenderDateOfBirth,
      SenderLocation,
      SenderEmail,
      SenderMobileNumber,
      BeneficiaryName,
      BeneficiaryMobileNumber
    });
    return request.call(this, 'ProcessPayment', xml);
  }

}

function buildXML(method, data) {
  const template = this._templates[method]
  const view = _.merge(_.clone(this.config), data || {});
  return Mustache.render(template, view)
}

function loadTemplates() {
  if (!_.isEmpty(this._templates)) { return this._templates; }

  this._templates = [];
  const templatePath = path.join(PAYKII_BASE_PATH, 'templates');
  const files = fs.readdirSync(templatePath);

  _.forEach(files, (file) => {
    const filePath = path.join(templatePath, file);
    const fileProperties = path.parse(file);

    if (fileProperties.ext === '.mustache') {
      console.log('Loading Paykii Template: "' + file + '".');
      fs.readFile(filePath, (err, data) => {
        this._templates[fileProperties.name] = data.toString('utf8');
      });
    }
  });
}

function request(method, data) {
  const adapter = axios.create({
    baseURL: this.config.baseUrl,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8' ,
      'SOAPAction': `http://tempuri.org/${method}`
    }
  });

  const defer = q.defer();

  adapter.post(this.config.path, data)
  .then(res => {
    parseString(res.data, function (err, result) {
      const body = resolveData(result['soap:Envelope']['soap:Body'][0]);
      defer.resolve(body);
    });
  })
  .catch(err => defer.reject(err));

  return defer.promise;
}

function resolveData(data, identifier) {
  let check = typeof data[identifier] === 'undefined' ?
    data :
    data[identifier];


  if (Array.isArray(check) === false) {
    return resolveData(check, Object.keys(check)[0]);
  }

  if (Object.keys(check[0])[0] === '$') {
    const key = Object.keys(check[0])[1]

    if (Object.keys(check[0][key][0]).length > 1) {
      check = check[0][key][0];
      return new Item(check).serialize();
    } else {
      return resolveData(check[0][key], Object.keys(check[0][key])[0]);
    }
  }

  return Item.setAll(check).map(item => item.serialize());
}

module.exports = new Paykii();
