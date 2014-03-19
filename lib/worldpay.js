
"use strict";

var request    = require('request');
var xmlbuilder = require('xmlbuilder');
var parseXml   = require('xml2js').parseString;

var name = "worldpay"

module.exports = function( options ){

  var seneca = this;

  var worldpayURL = {
    test: 'https://secure-test.worldpay.com:443/jsp/merchant/xml/paymentService.jsp',
    production: 'https://secure.worldpay.com:443/jsp/merchant/xml/paymentService.jsp'
  };

  options = this.util.deepextend({
    config: {}
  },options);

  seneca.add({role:name,cmd:'purchase'},function( args, done ){

    var worldpayURL = (args.production) ? worldpayURL.production : worldpayURL.test;
    var merchantCode = args.merchantCode;
    var password = args.password;
    var order = args.order;

    var xml = xmlbuilder.create('paymentService', {version: '1.0', encoding: 'UTF-8'})
      .att('version', '1.4')
      .att('merchantCode', merchantCode)
      .ele('submit')
        .ele('order', {'orderCode': '123'})
          .ele('description', {}, order.description)
          .up()
          .ele('amount', {'currencyCode':order.currencyCode, 'value':'' + (order.amount * 100), 'exponent':'2'})
          .up()
          .ele('orderContent', {}, 'Order Content')
          .up()
          .ele('paymentMethodMask')
            .ele('include', {'code': 'ALL'})
      .end();

    // TODO Hack to include doctype
    var doctype = '<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN" "http://dtd.worldpay.com/paymentService_v1.dtd">';
    xml = xml.substring(0, 38) + doctype + xml.substring(38, xml.length);

    request.post(
      {
        url: worldpayURL,
        body : xml,
        headers: {'Content-Type': 'text/xml'},
        auth: {
          username: merchantCode,
          password: password
        }
      },
      function (err, response, out) {
        if(err) {return done(err);}

        parseXml(out, function (err, result) {
          if(err) {return done(err);}

          if(result.paymentService.reply[0].error) {
            var errorMsg = result.paymentService.reply[0].error[0]['_'];
            return done(errorMsg);
          }

          var redirect = result.paymentService.reply[0].orderStatus[0].reference[0]['_'];
          return done(null,{ok:true,redirect:redirect});
        });

      });

  });

  return {
    name:name
  }
}

