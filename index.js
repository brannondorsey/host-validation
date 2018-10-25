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

module.exports = function(config) {

	if (!config) {
		throw Error('a config object must be provided as the first argument to this function.')
	}

	// account for correct referrers spelling
	if (config.referrers && !config.referers) {
		config.referers = config.referrers
	}

	if (!Array.isArray(config.hosts) && !Array.isArray(config.referers)) {
		throw Error('either config.hosts or config.referers must included in the config object.')
	}

	if (config.hosts) {

		if (config.hosts.length < 1) {
			throw Error('config.hosts must be an array with at least one element.')
		}

		// throws an error if hosts contains an element that is not a string or RegExp
		config.hosts.forEach(host => checkAllowedType(host))
	}

	if (config.referers){
		
		if (config.referers.length < 1) {
			throw Error('config.referers must be an array with at least one element.')
		}

		// throws an error if referers contains an element that is not a string or RegExp
		config.referers.forEach(referer => checkAllowedType(referer))
	}

	if (config.mode) {
		if (!['both', 'either'].includes(config.mode)) {
			throw Error(`${config.mode} is an unsupported config.mode. Value must be exactly "either" or "both".`)
		}
	} else {
		config.mode = 'both' // set default mode to both
	}

	if (config.fail != null && typeof config.fail !== 'function') {
		throw Error(`config.fail must be a function if it is defined.`)
	}

	return function(req, res, next) {
		
		let allowed = true

		if (config.mode == 'both') {
			if (config.hosts && config.referers) {
				allowed = (isAllowed(req.headers.host, config.hosts) && 
				           isAllowed(req.headers.referer, config.referers))
			} 
			else if (config.hosts)    allowed = isAllowed(req.headers.host, config.hosts)
			else if (config.referers) allowed = isAllowed(req.headers.referer, config.referers)
		} else { // mode is either 
			allowed = (isAllowed(req.headers.host, config.hosts) ||
				       isAllowed(req.headers.referer, config.referers))
		}

		if (allowed) next()
		else if (typeof config.fail === 'function') config.fail(req, res, next) 
		else fail(req, res, next)
	}

	function isAllowed(headerValue, allowedValues) {
		if (!headerValue || !allowedValues) return false
		return allowedValues.some(candidate => {
			if (typeof candidate === 'string') {
				return candidate === headerValue
			} else if (candidate instanceof RegExp){
				return candidate.test(headerValue)
			}
			return false
		})
	}

	function checkAllowedType(type) {
		if (! (typeof type === 'string' || type instanceof RegExp)) {
			let message = `${type} is not an allowed Host/Referer type. `
			message    += 'Host/Referer values must be either strings or '
			message    += 'regular expression objects.'
			throw Error(message) 
		}
	}

	function fail(req, res, next) {
		res.status(403).send('Forbidden')
	}
}