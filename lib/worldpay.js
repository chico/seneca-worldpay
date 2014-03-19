
"use strict";

var xmlbuilder = require('xmlbuilder');

var name = "worldpay"

module.exports = function( options ){

  var seneca = this;

  options = this.util.deepextend({
    config: {}
  },options);

  seneca.add({role:name,cmd:'purchase'},function( args, done ){

    var merchantCode = args.merchantCode;
    var password = args.password;

    var xml = xmlbuilder.create('paymentService')
      .att('version', '1.4')
      .att('merchantCode', merchantCode)
      .ele('submit')
        .ele('order', {'orderCode': '123'})
          .ele('description', {}, 'Your Order')
          .up()
          .ele('amount', {'currencyCode':'EUR', 'value':'100', 'exponent':'2'})
          .up()
          .ele('orderContent', {}, 'Order Content')
          .up()
          .ele('paymentMethodMask')
            .ele('include', {'code': 'ALL'})
      .end({ pretty: true});
    console.log(xml);

    done(null,{ok:true,redirect:''});
  });

  return {
    name:name
  }
}

