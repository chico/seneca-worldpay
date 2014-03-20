
'use strict';

// mocha worldpay.test.js

var seneca  = require('seneca')();
var assert  = require('chai').assert;
var request = require('request');

describe('worldpay', function() {

	var ready = false;
	var client;

	var data = {
		production: false,
		merchantCode: 'ABC',
		password: 'test',
    order: {
      id: '123',
      description: 'test order',
      currencyCode: 'EUR',
      amount: 10
  	}
	};

	function setup(cb) {
		if (ready) {return cb();}
    seneca.use('..');
    seneca.ready(function(err) {
    	assert.isNull(err);
    	client = seneca.export('worldpay/client');
    	ready = true;
      cb();
    });
  }

  it('happy', function( done ){
    setup( function(err){
			done();
    });
  });

  it('buildxml', function( done ){
    setup( function(){

    	var expectedXml = '<?xml version="1.0" encoding="UTF-8"?>';
    	expectedXml += '<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN" "http://dtd.worldpay.com/paymentService_v1.dtd">';
    	expectedXml += '<paymentService version="1.4" merchantCode="' + data.merchantCode + '">';
    	expectedXml += '<submit>';
    	expectedXml += '<order orderCode="' + data.order.id + '">';
    	expectedXml += '<description>' + data.order.description + '</description>';
    	expectedXml += '<amount currencyCode="' + data.order.currencyCode + '" value="' + data.order.amount + '00" exponent="2"/>';
    	expectedXml += '<orderContent></orderContent>';
    	expectedXml += '<paymentMethodMask><include code="ALL"/></paymentMethodMask>';
    	expectedXml += '</order>';
    	expectedXml += '</submit>';
    	expectedXml += '</paymentService>';
    	assert.equal(expectedXml, client.buildxml(data));
    	done();
    });

  });

	it('buildRequestOptions', function( done ){
    setup( function(){
    	var requestOptions = client.buildRequestOptions(data);
    	assert.equal('https://secure-test.worldpay.com:443/jsp/merchant/xml/paymentService.jsp', requestOptions.url);
    	assert.deepEqual({'Content-Type': 'text/xml'}, requestOptions.headers);
    	assert.deepEqual({username: data.merchantCode, password: data.password}, requestOptions.auth);
    	done();
    });
  });

	it('handleResponse', function( done ){
    setup( function(){
    	var expectedRedirect = 'https://secure-test.worldpay.com/wcc/dispatcher?OrderKey=CXTRPECOM%5Errywfubuu6';
    	var responseXml = '<?xml version="1.0" encoding="UTF-8"?>';
    	responseXml += '<!DOCTYPE paymentService PUBLIC "-//WorldPay//DTD WorldPay PaymentService v1//EN" "http://dtd.worldpay.com/paymentService_v1.dtd">';
    	responseXml += '<paymentService version="1.4" merchantCode="ABC">';
    	responseXml += '<reply>';
    	responseXml += '<orderStatus orderCode="rrywfubuu6">';
    	responseXml += '<reference id="3006487468">' + expectedRedirect + '</reference>';
    	responseXml += '</orderStatus>';
    	responseXml += '</reply>';
    	responseXml += '</paymentService>';
    	client.handleResponse(null, {statusCode:200}, responseXml, function(err, result) {
    		assert.isNull(err);
    		assert.deepEqual({ok: true, redirect: expectedRedirect}, result);
    		done();
    	});
    });

  });

})
