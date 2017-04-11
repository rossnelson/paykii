const _ = require('lodash');

module.exports = function () {

  class ItemBase {

    static setAll(collection) {
      return collection.map(item => new this(item));
    }

    constructor(fields) {
      this.delegate = {}
      Object.assign(this.delegate, fields);
    }

    get(field) {
      try {
        let val;

        val = _.get(this, field);
        if (!val) { val = _.get(this.delegate, field); }

        return this._resolveVal(val);

      } catch (error) {
        console.error(error.message)
        return undefined;
      }
    }

    set(data) {
      _.merge(this.delegate, data);
      return this;
    }

    serialize() {
      return this.delegate;
    }

    _resolveVal(val) {
      if (typeof val === 'function') { return val.bind(this)(); }
      return val;
    }

  }

  return ItemBase;
}


