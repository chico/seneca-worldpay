/* Copyright (c) 2014 Chico Charlesworth, MIT License */
'use strict';

var _    = require('underscore');
var path = require('path');
var URL  = require('url');

var name = "pay-worldpay-checkout";

module.exports = function(options) {

  var seneca = this;

  var endpoints = {
    pay: '/pay/worldpay-checkout/pay',
    completeCallback: '/pay/worldpay-checkout/callback-complete',
    cancelCallback: '/pay/worldpay-checkout/callback-cancel'
  }

  seneca.add({role:name, cmd:'init-gateway'}, function (args, done) {
    var options = args.options;

    done(null);
  })

  var hostUrl;
  var successUrl, failUrl;

  seneca.add({role:name, cmd:'init-routes'}, function (args, done) {
    var routes = args.routes;

    if(args.redirect) {
      //this bit should probably just be removed.
      hostUrl = args.redirect.hostUrl;
      successUrl = args.redirect.success;
      failUrl = args.redirect.fail;
    } else {
      hostUrl    = options.redirect.hostUrl;
      successUrl = options.redirect.success;
      failUrl    = options.redirect.fail;
    }

    seneca.log.info('success url', hostUrl + successUrl);
    seneca.log.info('fail url', hostUrl + failUrl);

    routes[endpoints.pay] = { GET:payHandler, POST:payHandler };
    routes[endpoints.completeCallback] = { GET:completeCallbackHandler, POST:completeCallbackHandler };
    routes[endpoints.cancelCallback] = { GET:cancelCallbackHandler, POST:cancelCallbackHandler };

    done(null, routes);
  })

  function urlappend(url, name, value) {
    var urlobj = URL.parse(url, true);
    if (typeof value !== 'undefined' && value !== null) {
      urlobj.query[name] = value;
    }
    urlobj.search = null;
    return URL.format(urlobj);
  }

  function payHandler(req, res, next) {

    var input = (req.method === 'GET') ? req.query : req.body;
    var transactionData = {
      refno:input.refno,
      status:'created',
      customer: {
        name: input.name,
        company: input.company,
        email: input.email
      },
      description: input.description,
      priceTag: input.priceTag,
      amount: input.amount,
      currencyCode: input.currencyCode,
      plan: input.plan
    };

    seneca.act({role:'transaction', cmd:'create', data:transactionData}, function(err, out) {
      if (err) {
        res.redirect(urlappend((input.redirectHostUrl || hostUrl) + failUrl, 'refno', input.refno));
        return;
      }

      var transaction = out.transaction;

      // Do worldpay XML redirect to get redirect URL
      var order = {
        id: transaction.refno,
        description: transaction.description,
        currencyCode: transaction.currencyCode,
        amount: transaction.amount
      };
      var completeUrl = urlappend(endpoints.completeCallback, 'refno', transaction.refno);
      var cancelUrl = urlappend(endpoints.cancelCallback, 'refno', transaction.refno);
      if (input.redirectHostUrl) {
        completeUrl = urlappend(completeUrl, 'redirectHostUrl', input.redirectHostUrl);
        cancelUrl = urlappend(cancelUrl, 'redirectHostUrl', input.redirectHostUrl);
      }
      var redirect = {
        hostUrl: hostUrl,
        success: completeUrl,
        fail: cancelUrl
      };
      seneca.act({role:'pay', cmd:'worldpay-checkout', order: order, redirect: redirect}, function(err,out) {
        if (err) {
          res.redirect(urlappend((input.redirectHostUrl || hostUrl) + failUrl, 'refno', input.refno));
          return;
        }

        seneca.log.debug('beginPayment: init transaction', out.redirect);

        // transaction.expressCheckout = data;
        transaction.status = 'started';

        seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
          if (err) {
            res.redirect(urlappend((input.redirectHostUrl || hostUrl) + failUrl, 'refno', input.refno));
            return;
          }
          seneca.log.debug('beginPayment: redirecting to', out.redirect);
          res.redirect(out.redirect);
        });

      });
    });

  }

  function completeCallbackHandler(req, res, next) {

    // refno - internal transaction reference number
    var refno = req.query['refno'] || req.body['refno'];
    var redirectHostUrl = req.query['redirectHostUrl'] || req.body['redirectHostUrl'];

    // lookup transaction by refno
    seneca.act({role:'transaction', cmd:'find', q:{'refno':refno}}, function(err, out) {
      if (err) {
        seneca.log.error('find', 'transaction', 'error', err, {refno:refno})
        if (redirectHostUrl) {
          res.redirect(urlappend(redirectHostUrl + failUrl, 'refno', refno));
        }
        else {
          res.redirect(urlappend(failUrl, 'refno', refno));
        }
        return;
      }

      var transaction = out.transaction;
      transaction.status = 'completed';

      seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
        if (redirectHostUrl) {
          res.redirect(urlappend(redirectHostUrl + successUrl, 'refno', refno));
        }
        else {
          res.redirect(urlappend(successUrl, 'refno', refno));
        }
      });

    });

  }

  function cancelCallbackHandler(req, res, next) {

    var refno = req.query['refno'];
    var redirectHostUrl = req.query['redirectHostUrl'] || req.body['redirectHostUrl'];

    seneca.act({role:'transaction', cmd:'find', q:{'refno':refno}}, function(err, out) {
      if (err) {
        seneca.log.error('find', 'transaction', 'error', err, {token:token})
        if (redirectHostUrl) {
          res.redirect(urlappend(redirectHostUrl + failUrl, 'refno', refno));
        }
        else {
          res.redirect(urlappend(failUrl, 'refno', refno));
        }
        return;
      }

      var transaction = out.transaction;
      transaction.status = 'cancelled';

      seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
        if (redirectHostUrl) {
          res.redirect(urlappend(redirectHostUrl + failUrl, 'refno', refno));
        }
        else {
          res.redirect(urlappend(failUrl, 'refno', refno));
        }
      });
    });
  }

  return {
    name: name
  };

};
