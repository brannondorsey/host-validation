# Host Validation

[![Build Status](https://travis-ci.com/brannondorsey/host-validation.svg?branch=master)](https://travis-ci.com/brannondorsey/host-validation) [![Coverage Status](https://coveralls.io/repos/github/brannondorsey/host-validation/badge.svg?branch=master)](https://coveralls.io/github/brannondorsey/host-validation?branch=master)

[![NPM](https://nodei.co/npm/host-validation.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/host-validation/)

Express.js middleware that protects Node.js servers from [DNS Rebinding](https://en.wikipedia.org/wiki/DNS_rebinding) attacks by validating Host and Referer [sic] headers from incoming requests. If a request doesn't contain a whitelisted Host/Referer header, `host-validation` will respond with a 403 Forbidden HTTP error.

DNS Rebinding is a savvy exploit that hasn't gotten the attention it deserves over the years. For this reason tons of services are vulnerable to it because of lack of developer knowledge of the attack or simply negligence and indifference to patch against it. Don't be *that person*.

## Getting Started

```bash
# install using npm
npm install host-validation
```

```javascript
const express        = require('express')
const hostValidation = require('host-validation')

const app = express()

// allow development hosts, a domain name, and a regex for all subdomains.
// any requests that don't supply a whitelisted Host will be rejected
// with a 403 HTTP status code 
// NOTE: custom errors can be returned by a config.fail function. see "custom 
// failure handlers" below.
app.use(hostValidation({ hosts: ['127.0.0.1:3000',
                                 'localhost:3000',
                                 'mydomain.com', 
                                 /.*\.mydomain\.com$/] }))

app.get('/', (req, res) => {
    res.send('Hello trusted client, thanks for including a whitelisted Host header.')
})

app.listen(3000, () => {
    console.log('server accepting requests w/ valid Host headers port 3000')
})
```

## What is DNS Rebinding and why should I care?

DNS Rebinding is a clever technique used to bypass the browser's [Same-Origin Policy](https://en.wikipedia.org/wiki/Same-origin_policy). This policy blocks malicious websites or HTML advertisements from making arbitrary requests to other servers. Imagine a scenario where you are surfing a news website that serves banner ads. One of those ads contains malicious JavaScript that POSTs default router credentials to `http://192.168.1.1/router_login.php`, a common IP address for routers on home networks, in an attempt to open an inbound connections from the Internet. Even if 5% of users don't change there router admin panel login (not their WiFi network login) that attack could still be successful hundreds of thousands of times a day depending on the reach of the malicious ad.

Now, because of Same-Origin Policy, your web browser actually blocks that request to 192.168.1.1 from ever taking place. It notices that `http://malicious-ad.com` is a different host than `192.168.1.1` (which doesn't have Cross Origin Resource Sharing (CORS) headers enabled) and stops the request dead in it's tracks. All, good right?

Not so fast. Enter DNS Rebinding. In the above scenario, your browser won't allow the malicious ad to make a request to `http://192.168.1.1/router_login.php`, but it would allow a request to `http://malicious-ad.com/router_login.php`. That doesn't seem like a problem because there is no way that `http://malicious-ad.com` could be hosting our router login page, right? Technically, yes, that is true, but what if `http://malicious-ad.com` could act as a proxy to your home router. Better yet, what if the domain name `http://malicious-ad.com` actually resolved to `192.168.1.1` so that it could trick your browser into thinking it is making a request to the same host but the request is actually made to your home router. This is exactly what DNS Rebinding does. It uses a malicious DNS server (like [FakeDNS](https://github.com/Crypt0s/FakeDns)) to respond to the same DNS request with different results at different times. A common DNS Rebinding server might be configured to respond to `http://2dfaa01a-59bf-47db-a7cc-ddf4245e68b9.malicious-ad.com` with `157.218.13.52`, the real IP address of the HTTP server serving the malicious ad the first time it is requested, and then `192.168.1.1` every time that same domain name is requested thereafter. 

### Who is vulnerable to DNS Rebinding?

Any HTTP server that 1) doesn't use HTTPS or 2) has no user authentication and 3) doesn't validate the Host header of incoming requests is vulnerable to DNS Rebind attacks.

This package protects you from #2. If you are using HTTPS you don't need to use this package (good job!). But hey... I bet you don't use HTTPS when when you are developing on your local machine/network. Local networks are among the top targets for DNS Rebind attacks, so you should probably validate Host headers in that circumstance too.

The reason that "Host" header validation mitigates against DNS rebinding is that malicious requests sent from web browsers will have "Host" values that don't match the ones you would expect your server to have. For instance, your home router should expect to see "Host" values like `192.168.1.1`, `192.168.0.1`, or maybe `router.asus.com`, but definitely not `http://malicious-ad.com`. Simply checking that the "Host" header contains the value that you expect will prevent DNS rebinding attacks and leave your users protected. 

## Examples and usage

This package is dead simple. Include a few new lines of code and protect yourself from DNS Rebind attacks without ever thinking about it again.

### Simple Host validation

```javascript
// host and referrer headers can accept strings or regular expressions
app.use(hostValidation({ hosts: ['mydomain.com', /.*\.mydomain\.com$/] }))
```

### Simple Referer validation

```javascript
// host and referrer headers can accept strings or regular expressions
app.use(hostValidation({ referers: ['http://trusted-site.com/login.php', 
                                    /^http:\/\/othersite\.com\/login\/.*/] }))
```

```javascript
// only accept POSTs from HTTPS referrers
app.use(hostValidation({ referers: [/^https:\/\//]})
```

### Host and/or Referer validation

```javascript
// you can include both host and referer values in the config
// by default, only requests that match BOTH Host and Referer values will be allowed
app.use(hostValidation({ hosts: ['trusted-host.com'], 
                         referers: ['https://trusted-host.com/login.php'] })
```

```javascript
// you can use the { mode: 'either' } value in the config accept requests that match
// either the hosts or the referers requirements. Accepted values for mode include 
// 'both' and 'either'. The default value is 'both' if none is specified.  
app.use(hostValidation({ hosts: ['trusted-host.com'], 
                         referers: ['https://trusted-host.com/login.php'],
                         mode: 'either' })
```

### Custom rules for custom routes

```javascript
// route-specific rules can be specified like any Express.js middleware
app.use('/login', hostValidation({ hosts: ['trusted-host.com'] }))
app.use('/from-twitter', hostValidation({ referrers: [/^https:\/\/twitter.com\//] }))
```

## Custom failure handlers

Add a custom error handler that's run when host or referer validation fails. This function overwrites the default behavior of responding to failed requests with a `403 Forbidden` error.

```javascript
// 
app.use('/brew-tea', hostValidation({ 
	hosts: ['office-teapot'],
	fail: (req, res, next) => {
        // send a 418 "I'm a Teapot" Error
		res.status(418).send('I\'m the office teapot. Refer to me only as such.')
	}
}))
```

## Testing

For more example usage see [`test.js`](test.js)

```bash
# navigate to the module directory
cd node_modules/host-validation

# install the dev dependencies
npm install --dev

# run the tests in test.js
npm test
```
