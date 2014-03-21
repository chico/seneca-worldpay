/* Copyright (c) 2014 Chico Charlesworth, MIT License */
'use strict';

var argv       = require('optimist').argv;
var request    = require('request');
var url        = require('url');
var xmlbuilder = require('xmlbuilder');
var nid        = require('nid');
var parseXml   = require('xml2js').parseString;

var name = "worldpay"

module.exports = function( options ){

  var seneca = this;

  var env = argv.env || process.env.NODE_ENV;

  var worldpayURL = ( 'production' === env ) ?
    'https://secure.worldpay.com:443/jsp/merchant/xml/paymentService.jsp' :
    'https://secure-test.worldpay.com:443/jsp/merchant/xml/paymentService.jsp';

  options = this.util.deepextend({
    // Add any default config here
  },options);

  var client = new Client();

  function Client() {

    this.buildxml = function(args) {
      var merchantCode = args.merchantCode;
      var order = args.order;
      if (!order.id) {
        order.id = nid(10);
      }
      if (!order.description) {
        order.description = "Your Order";
      }

      seneca.log.info('order', 'merchant: ' + merchantCode, order);

      var xml = xmlbuilder.create('paymentService', {version: '1.0', encoding: 'UTF-8'})
        .att('version', '1.4')
        .att('merchantCode', merchantCode)
        .ele('submit')
          .ele('order', {'orderCode': order.id})
            .ele('description', {}, order.description)
            .up()
            .ele('amount', {'currencyCode':order.currencyCode, 'value':'' + (Number(order.amount) * 100), 'exponent':'2'})
            .up()
            .ele('orderContent', {}, order.content || '')
            .up()
            .ele('paymentMethodMask')
              .ele('include', {'code': 'ALL'})
        .end();

      // TODO Hack to include doctype
      var doctype = '<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN" "http://dtd.worldpay.com/paymentService_v1.dtd">';
      xml = xml.substring(0, 38) + doctype + xml.substring(38, xml.length);

      return xml;
    };

    this.buildRequestOptions = function(args) {
      if (!args.merchantCode) {
        args.merchantCode = options.worldpay.merchantCode;
      }
      if (!args.password) {
        args.password = options.worldpay.password;
      }
      var xml = client.buildxml(args);
      return {
        url: worldpayURL,
        body : xml,
        headers: {'Content-Type': 'text/xml'},
        auth: {
          username: args.merchantCode,
          password: args.password
        }
      };
    };

    this.handleResponse = function(args, err, response, out, done) {
      if(err) {return done(err);}

      if(response.statusCode < 200 || response.statusCode >= 300) {return done('Failed request [response status: ' + response.statusCode + ']');}

      if (!args.redirect) {
        args.redirect = options.redirect;
      }

      parseXml(out, function (err, result) {
        if(err) {return done(err);}

        if(result.paymentService.reply[0].error) {
          var errorMsg = result.paymentService.reply[0].error[0]['_'];
          return done(errorMsg);
        }

        var redirect = result.paymentService.reply[0].orderStatus[0].reference[0]['_'];

        if (args.redirect) {
          var redirectURL = url.parse(redirect, true, false);
          redirectURL.query['successURL'] = args.redirect.hostUrl + args.redirect.success;
          redirectURL.query['failureURL'] = args.redirect.hostUrl + args.redirect.fail;
          redirectURL.query['cancelURL'] = args.redirect.hostUrl + args.redirect.fail;
          delete redirectURL.search; // this makes format compose the search string out of the query object
          redirect = url.format(redirectURL);
        }

        return done(null,{ok:true,redirect:redirect});
      });
    };

    this.checkout = function(args, done) {
      request.post(
        client.buildRequestOptions(args),
        function (err, response, out) {
          client.handleResponse(args, err, response, out, done);
        }
      );
    };

    this.checkoutCompleted = function(args, done) {
      return done(null,{ok:true,orderKey:args.orderKey,paymentStatus:args.paymentStatus,mac:args.mac});
    };

    this.checkoutCancelled = function(args, done) {
      return done(null,{ok:true});
    };

    return this;
  }

  seneca.add({role:'pay',cmd:'worldpay-checkout'}, client.checkout);
  seneca.add({role:'pay',cmd:'worldpay-checkout-completed'}, client.checkoutCompleted);
  seneca.add({role:'pay',cmd:'worldpay-checkout-cancelled'}, client.checkoutCancelled);

  return {
    name:name,
    exportmap:{
      'client': client
    }
  };
};

