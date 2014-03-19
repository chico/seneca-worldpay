# seneca-worldpay

## A worldpay plugin for the [Seneca](http://senecajs.org) toolkit

This module is a plugin for the Seneca framework. It provides worldpay payment integration capability for actions.

With this module you can:

   * Implement WorldPay XML Redirect payments

## Quick example

```JavaScript
var seneca = require('seneca')()

seneca.use('worldpay',{
  config:{

  }
})

seneca.ready(function(err){
  if( err ) return console.log(err);

  seneca.act({
    role:'worldpay',
    cmd:'purchase'
  })
})
```

## Test

```sh
cd test
mocha worldpay.test.js --seneca.log.print
```
