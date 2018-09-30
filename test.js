// Copyright (c) 2018 Brannon Dorsey <brannon@brannondorsey.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const assert         = require('assert')
const request        = require('request')
const express        = require('express')
const hostValidation = require('./index.js')

// ASSERTIONS

assert.throws(() => hostValidation(), (err) => {
	return err.message === 'a config object must be provided as the first argument to this function.'
})

assert.throws(() => hostValidation({}), (err) => {
	return err.message === 'either config.hosts or config.referers must included in the config object.'
})

assert.throws(() => hostValidation({ hosts: [] }), (err) => {
	return err.message === 'config.hosts must be an array with at least one element.'
})

assert.throws(() => hostValidation({ referers: [] }), (err) => {
	return err.message === 'config.referers must be an array with at least one element.'
})

assert.throws(() => hostValidation({ referrers: [] }), (err) => {
	return err.message === 'config.referers must be an array with at least one element.'
})

assert.throws(() => hostValidation({ hosts: [5] }), (err) => {
	return err.message === '5 is not an allowed Host/Referer type. Host/Referer values must be either strings or regular expression objects.'
})

assert.throws(() => hostValidation({ hosts: ['test.com'], mode: 'fakemode' }), (err) => {
	return err.message === 'fakemode is an unsupported config.mode. Value must be exactly "either" or "both".'
})

assert.throws(() => hostValidation({ hosts: ['test.com'], fail: 5 }), (err) => {
	return err.message === 'config.fail must be a function if it is defined.'
})

// SERVER --------------------------------------------------------------------------------
const app = express()

app.use('/dev-host-test', hostValidation({ hosts: ['127.0.0.1:4322', 'localhost:4322'] }))
app.get('/dev-host-test', (req, res) => allowed(res))

app.use('/host-test', hostValidation({ hosts: ['mydomain.com', 
	                                           'myseconddomain.com',
	                                           'subdomain.mydomain.com',
	                                           'subdomain.mythirddomain.com',
	                                           /^.*.regexdomain\.com$/] }))
app.get('/host-test', (req, res) => allowed(res))


app.use('/referers-test', hostValidation({ referers: ['https://camefromhere.com',
	                                                  'https://camefromhere.com/specific-page',
	                                                  /https:\/\/camefromhere.com\/allowed\/.*/ ]}))
app.get('/referers-test', (req, res) => allowed(res))


app.use('/host-and-referers-test', hostValidation({ 
	hosts: ['trusted-host.com'], 
	referers: ['http://trusted-host.com/login.php'] 
}))

app.get('/host-and-referers-test', (req, res) => allowed(res))

app.use('/host-or-referers-test', hostValidation({ 
	hosts: ['trusted-host.com'], 
	referrers: ['http://trusted-host.com/login.php'], // account for correct spelling of referers
	mode: 'either' 
}))
app.get('/host-or-referers-test', (req, res) => allowed(res))

// regex to match '192.168.1.1-255' (actually matches '192.168.1.001-255' too, but w/e...)
const lanHostRegex = /^192\.168\.1\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
app.use('/lan-host-regex-test', hostValidation({ hosts: [lanHostRegex] }))
app.get('/lan-host-regex-test', (req, res) => allowed(res))


const lanRefererRegex = /^http:\/\/192\.168\.1\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])(\/.*){0,1}$/
app.use('/lan-referer-regex-test', hostValidation({ referers: [lanRefererRegex] }))
app.get('/lan-referer-regex-test', (req, res) => allowed(res))

app.use('/https-referer', hostValidation({ referers: [/^https:\/\//] }))
app.get('/https-referer', (req, res) => allowed(res))


app.use('/custom-fail-test', hostValidation({ 
	referers: [/^https:\/\//], 
	fail: (req, res, next) => {
		// using 401 instead of 403 for testing purposes only
		res.status(401).send('Forbidden: Referer must be an HTTPS site.')
	}
}))
app.get('/custom-fail-test', (req, res) => allowed(res))

app.use('/custom-fail-teapot-test', hostValidation({ 
	hosts: ['office-teapot'],
	fail: (req, res, next) => {
        // send a 418 "I'm a Teapot" Error
		res.status(418).send('I\'m the office teapot. Refer to me only as such.')
	}
}))
app.get('/custom-fail-teapot-test', (req, res) => allowed(res))

const server = app.listen(4322, () => {
	console.log('server allowing HTTP requests from 127.0.0.1 on port 4322')
	runClientTests()
})

// this is a terrible hack, but it's the simplest way to have the tests finish
// please, nobody stone me for this...
setTimeout(() => server.close(() => process.exit(0)), 2000)

function allowed(res) {
	res.send('Hello trusted client, thanks for sending the right Host/Referer headers.')
} 

// CLIENT --------------------------------------------------------------------------------

function runClientTests() {

	var options = {
		url: null,
		headers: {
		}
	}

	const server = 'http://127.0.0.1:4322'
	options.url = `${server}/dev-host-test`

	options.headers.Host = '127.0.0.1:4322'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'localhost:4322'
	request(options, expect(clone(options), 200))

	options.headers['Host'] = 'DNSRebind-attack.com'
	request(options, expect(clone(options), 403))

	options.url = `${server}/host-test`
	options.headers.Host = 'mydomain.com'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'subdomain.mydomain.com'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'myseconddomain.com'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'mythirddomain.com'
	request(options, expect(clone(options), 403))

	options.headers.Host = 'subdomain.mythirddomain.com'
	request(options, expect(clone(options), 200))


	options.url = `${server}/referers-test`
	options.headers.Host = null
	options.headers.Referer = 'https://camefromhere.com'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://camefromhere.com' //non-HTTP
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'https://camefromhere.com/specific-page'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'https://camefromhere.com/different-page'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'https://camefromhere.com/allowed/page'
	request(options, expect(clone(options), 200))

	// not this shouldn't be allowed given the regex
	options.headers.Referer = 'https://camefromhere.com/allowed'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://shouldnt-be-allowed-to-come-from-here.com'
	request(options, expect(clone(options), 403))


	options.url = `${server}/host-and-referers-test`
	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))

	options.headers.Host = null
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 403))

	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/index.php'
	request(options, expect(clone(options), 403))

	options.headers.Host = 'untrusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 403))


	options.url = `${server}/host-or-referers-test`
	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = null
	request(options, expect(clone(options), 200))

	options.headers.Host = null
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'trusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/index.php'
	request(options, expect(clone(options), 200))

	options.headers.Host = 'untrusted-host.com'
	options.headers.Referer = 'http://trusted-host.com/login.php'
	request(options, expect(clone(options), 200))

	options.headers.Host = null
	options.headers.Referer = 'http://trusted-host.com/index.php'
	request(options, expect(clone(options), 403))

	options.headers.Host = 'untrusted-host.com'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))


	options.url = `${server}/lan-host-regex-test`
	options.headers.Host = '192.168.1.83'
	options.headers.Referer = null
	request(options, expect(clone(options), 200))

	options.headers.Host = '192.168.1.1'
	options.headers.Referer = null
	request(options, expect(clone(options), 200))

	options.headers.Host = '192.168.1.255'
	options.headers.Referer = null
	request(options, expect(clone(options), 200))

	options.headers.Host = '192.168.2.1'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))

	options.headers.Host = '10.0.0.1'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))

	options.headers.Host = '192.168.1.256'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))

	options.headers.Host = '192.168.1.2556'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))

	options.headers.Host = 'mydomain.com'
	options.headers.Referer = null
	request(options, expect(clone(options), 403))


	options.url = `${server}/lan-referer-regex-test`
	options.headers.Host = null
	options.headers.Referer = 'http://192.168.1.83'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://192.168.1.83/'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://192.168.1.1/router_login.html'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://192.168.1.1/login'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://192.168.2.1'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://10.0.0.1'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://10.0.0.1/login'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://192.168.1.2556'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://mydomain.com'
	request(options, expect(clone(options), 403))


	options.url = `${server}/https-referer`
	options.headers.Host = null
	options.headers.Referer = 'https://google.com'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'https://localhost'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'https://github.com/login'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://google.com'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://localhost'
	request(options, expect(clone(options), 403))

	options.headers.Referer = 'http://github.com/login'
	request(options, expect(clone(options), 403))


	options.url = `${server}/custom-fail-test`
	options.headers.Host = null
	options.headers.Referer = 'https://google.com'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'https://github.com/login'
	request(options, expect(clone(options), 200))

	options.headers.Referer = 'http://localhost'
	request(options, expect(clone(options), 401))

	options.headers.Referer = 'http://google.com'
	request(options, expect(clone(options), 401))

	options.url = `${server}/custom-fail-teapot-test`
	options.headers.Host = 'office-teapot'
	options.headers.Referer = null
	request(options, expect(clone(options), 200))

	options.headers.Host = 'office-coffeepot'
	request(options, expect(clone(options), 418))
}

function expect(options, status) {
	// console.log(`testing with ${options.url}`)
	return function(error, response, body){
		// console.log(`in here with ${options.url}`)
		if (error) throw error
		
		let print = `URL: ${options.url} Status: ${response.statusCode} `
		if (options.headers.Host) print += `Host: ${options.headers.Host} `
		if (options.headers.Referer) print += `Referer: ${options.headers.Referer} `
		console.log(print)

		if (response.statusCode != status) {
			throw new Error(`Expected status ${status} but received ${response.statusCode}`)
		}
	}
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj))
}
