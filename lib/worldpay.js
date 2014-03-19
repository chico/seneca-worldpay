
"use strict";

var _ = require('underscore')

var name = "worldpay"

module.exports = function( options ){

  var seneca = this;

  options = this.util.deepextend({
    config: {}
  },options);

  seneca.add({role:name,cmd:'purchase'},function( args, done ){
    done(null,{ok:true,redirect:''});
  });

  return {
    name:name
  }
}

