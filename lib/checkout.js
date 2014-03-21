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
    return URL.format(urlobj);
  }

  function payHandler(req, res, next) {

    var input = req.body;
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
        res.redirect(urlappend(failUrl, 'refno', input.refno));
        return;
      }

      var transaction = out.transaction;

      var completeCallbackUrl = urlappend(hostUrl + endpoints.completeCallback, 'refno', transaction.refno);
      var cancelCallbackUrl = urlappend(hostUrl + endpoints.cancelCallback, 'refno', transaction.refno);

      // Do worldpay XML redirect to get redirect URL
      var order = {
        id: input.refno,
        description: input.itemDescription,
        currencyCode: input.currencyCode,
        amount: input.amount
      };
      seneca.act({role:'pay', cmd:'worldpay-checkout', order: order}, function(err,out) {
        if (err) {
          res.redirect(urlappend(failUrl, 'refno', input.refno));
          return;
        }

        seneca.log.debug('beginPayment: init transaction', out.redirect);

        // transaction.expressCheckout = data;
        transaction.status = 'started';

        seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
          if (err) {
            res.redirect(urlappend(failUrl, 'refno', input.refno));
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

    // need a stripe token?
    // var stripeToken = req.query['stripeToken'] || req.body['stripeToken'];
    // if (typeof stripeToken ==='undefined' || stripeToken===null || stripeToken.length===0) {
    //     seneca.log.error('complete', 'transaction', 'error', new Error('No token'), {refno:refno})
    //     res.redirect(urlappend(failUrl, 'refno', refno));
    //     return
    // }

    // lookup transaction by refno
    seneca.act({role:'transaction', cmd:'find', q:{'refno':refno}}, function(err, out) {
      if (err) {
        seneca.log.error('find', 'transaction', 'error', err, {refno:refno})
        res.redirect(urlappend(failUrl, 'refno', refno));
        return;
      }

      var transaction = out.transaction;
      transaction.status = 'completed';

      seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
        res.redirect(urlappend(successUrl, 'refno', transaction.refno));
      });

    });

  }

  function cancelCallbackHandler(req, res, next) {
    var refno = req.query['refno'];

    seneca.act({role:'transaction', cmd:'find', q:{'refno':refno}}, function(err, out) {
      if (err) {
        seneca.log.error('find', 'transaction', 'error', err, {token:token})
        res.redirect(urlappend(failUrl, 'refno', refno));
        return;
      }

      var transaction = out.transaction;
      transaction.status = 'cancelled';

      seneca.act({role:'transaction', cmd:'update', id:transaction.id, data:transaction}, function(err) {
        res.redirect(urlappend(failUrl, 'refno', refno));
      });
    });
  }

  return {
    name: name
  };

};
