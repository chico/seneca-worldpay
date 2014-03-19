
"use strict";

// mocha worldpay.test.js

var seneca  = require('seneca')

describe('worldpay', function() {

  it('happy', function( done ){
    seneca()
      .use('..')
      .ready( function(err,si){
        assert.isNull(err);
      })
  })

})
