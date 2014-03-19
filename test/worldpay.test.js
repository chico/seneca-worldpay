
"use strict";

// mocha worldpay.test.js

var seneca  = require('seneca');
var assert  = require('chai').assert;

describe('worldpay', function() {

  it('happy', function( done ){
    seneca()
      .use('..')
      .ready( function(err,si){
        assert.isNull(err);

        seneca.act({role:'worldpay', cmd:'purchase', merchantCode:'ABC', password:'pwd'}, function(err,out) {
		      assert.isNull(err);
		      console.log(out);
		    });
      })
  })

})
