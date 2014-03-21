/* Copyright (c) 2014 Chico Charlesworth, MIT License */
'use strict';

var _ = require('underscore');
var worldpay = require('./worldpay');
var checkout = require('./checkout');

var name = "seneca-worldpay";

module.exports = function( options ) {

  var seneca = this;

  seneca.use(worldpay, options);
  seneca.use(checkout, options);

  seneca.add({role:'pay', hook:'init', sub:'gateway'}, function (args, done) {
    this.parent( args, function() {
      seneca.log.debug('worldpay: init gateway')

      var actargs = {role:'pay-worldpay-checkout', cmd:'init-gateway', options:args.options.worldpay};
      seneca.act(actargs, function(err) {
        done(err)
      });
    });
  });

  seneca.add({role:'pay', hook:'init', sub:'routes'}, function (args, done) {
    this.parent( args, function() {
      seneca.log.debug('worldpay: init routes')

      var actargs = {role:'pay-worldpay-checkout', cmd:'init-routes', options:args.options, routes:args.routes, redirect:args.options.redirect};
      seneca.act(actargs, function(err, routes) {
        done(err, routes)
      });
    });
  });

  return {
    name:name
  };

};
