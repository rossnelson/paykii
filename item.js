const _ = require('lodash');
const inflected = require('inflected');

module.exports = function () {
  const ItemBase = require(`./item_base`)();

  class Item extends ItemBase {

    constructor(fields) {
      const data = Item.convertFields(fields);
      super(data);
    }

    static convertFields(fields) {
      const properties = Object.keys(fields);

      const data = {};
      properties.forEach(property => {
        const value = fields[property][0];
        const name = inflected.underscore(property);

        data[name] = value;
      });

      return data;
    }

  }

  return Item;

}


