var bluebird = require('bluebird');
var util = require('util');
var DetachedEventHandler = require('./detachedevents');
var request = require('superagent');
var page = require('page');
var hbs = require('handlebars');
var ptr = require('path-to-regexp');
var layout = require('./layout');
var diff = require('./diff');

//Our view class. `url` should either be the same as used in the backend (an express-like route, or a RegExp).
//`requesturl` is only required if `url` is a regex, and is used to fetch the views template.
function View(url, requesturl) {
	DetachedEventHandler.call(this);
	this.data = {};
	this.url = BASEPATH + (requesturl || url);
	this.regex = url instanceof RegExp ? url : ptr(url);
	this._template = this._fetchTemplate();
	this._transitions = [];
}

util.inherits(View, DetachedEventHandler);

//Calls the corresponding transition function
View.prototype._transition = function(oldBody, newBody, from) {
	var transition;
	for(var x = 0; x<this._transitions.length; x++) {
		transition = this._transitions[x];
		if(transition.regex.test(from)) {
			return transition.fn(oldBody, newBody);
		}
	}

	return diff(oldBody, newBody);
};

//Attach a new transition from a specific state
View.prototype.transition = function(from, fn) {
	this._transitions.push({
		regex: ptr(from),
		fn: fn.bind(this)
	});
};

//Render the current data to the view
View.prototype.render = function(from) {
	var self = this;
	return layout.then(function(layout) {
		var body = document.createElement('body');

		self.data.layout.body = self.template(self.data);
		body.innerHTML = layout(self.data.layout);
		return self._transition(document.body, body, from);
	});
};

//Load new data and render the view
View.prototype.load = function(path, from) {
	var self = this;
	return bluebird.join(this._template, this._fetchData(path)).then(function() {
		self.emit('load');
		return self.render(from);
	}).then(function() {
		self.emit('loaded');
	}).catch(function(err) {
		if(err && typeof err.redirect === 'string') {
			page.replace(err.redirect);
		} else {
			throw err;
		}
	});
};

//Fetch template and attach it to the view in compiled form
View.prototype._fetchTemplate = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		request
			.get(self.url)
			.query({format: 't'})
			.end(function(err, res) {
				if(err) return reject(err);
				if(!res.ok) return reject(res);
				if(!self.regex.test(res.headers['request-path'])) {
					reject({redirect: res.headers['request-path']});
				} else {
					resolve(res.body.template);
				}
			});
	}).then(function(template) {
		self.template = hbs.compile(template); 
	});
};

//Fetch data and attach it to our view
View.prototype._fetchData = function(path) {
	var self = this;
	return new Promise(function(resolve, reject) {
		request
			.get(path)
			.query({format: 'd'})
			.end(function(err, res) {
				if(err) return reject(err);
				if(!res.ok) return reject(res);
				if(!self.regex.test(res.headers['request-path'])) {
					reject({redirect: res.headers['request-path']});
				} else {
					resolve(res.body);
				}
			});
	}).then(function(data) {
		self.data = data.data || {};
		self.data.layout = data.layoutData || {};
	});
};

module.exports = View;