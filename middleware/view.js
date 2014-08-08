var Promise = require('bluebird');
var hbs = require('handlebars');
var thunkify = require('thunkify');
var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var es = require('event-stream');
var _ = require('lodash');
var logger = global.logger.child({module: 'views'});

module.exports = function(pth, url) {
	assignHelpers(pth);
	var compiledHelpers = compileHelpers(pth);
	var cache = {};
	var layoutCache = {};

	function* getTemplate(name) {
		cache[name] = cache[name] || {time: 0};

		/* Load the data function if available */
		if(!cache[name].fn) {
			try {
				cache[name].fn = require(path.join(process.cwd(), pth, name, 'data.js'));
			} catch(e) {
				cache[name].fn = function(cb) {cb();};
			}
		}

		/* Check the timestamp if we need to reload the template */
		var stats = yield thunkify(fs.lstat)(path.join(process.cwd(), pth, name, 'template.hbs'));
		if(new Date(stats.mtime) > new Date(cache[name].time)) {
			var template = yield thunkify(fs.readFile)(path.join(process.cwd(), pth, name, 'template.hbs'), 'utf8');
			cache[name].compiled = hbs.compile(template);
			cache[name].string = template;
			cache[name].time = stats.mtime;
		}

		return cache[name];
	}

	function* getLayout() {
		/* Load the data function if available */
		if(!layoutCache.fn) {
			try {
				layoutCache.fn = require(path.join(process.cwd(), pth, 'layout.js'));
			} catch(e) {
				layoutCache.fn = function(cb) {cb();};
			}
		}

		/* Check for timestamps and update if needed */
		var stats = {
			layout: yield thunkify(fs.lstat)(path.join(process.cwd(), pth, 'layout.hbs')),
			frame: yield thunkify(fs.lstat)(path.join(process.cwd(), pth, 'frame.hbs'))
		};

		/* Compare the times */
		layoutCache.times = layoutCache.times || {layout: 0, frame: 0};
		if(new Date(stats.layout.mtime) > new Date(layoutCache.times.layout)) {
			layoutCache.times.layout = stats.layout.mtime;
			layoutCache.string = yield thunkify(fs.readFile)(path.join(process.cwd(), pth, 'layout.hbs'), 'utf8');
			layoutCache.compiled = hbs.compile(layoutCache.string);
		}
		if(new Date(stats.frame.mtime) > new Date(layoutCache.times.frame)) {
			layoutCache.times.frame = stats.frame.mtime;
			layoutCache.frame = hbs.compile(yield thunkify(fs.readFile)(path.join(process.cwd(), pth, 'frame.hbs'), 'utf8'));
		}

		return layoutCache;
	}

	/* Render a specific view */
	function* render(name, params) {
		var layout = yield getLayout();
		var template = yield getTemplate(name);
		var data = {
			layout: yield layout.fn.apply(this),
			template: yield template.fn.apply(this, params)
		};

		/* Assign data based on the request type */
		var result;
		if(this.request.query.format) {
			if(this.request.query.format.indexOf('d') !== -1) {
				result = result || {};
				result.data = data.template;
				result.layoutData = data.layout;
			}

			if(this.request.query.format.indexOf('l') !== -1) {
				result = result || {};
				result.layout = layout.string;
			}

			if(this.request.query.format.indexOf('t') !== -1) {
				result = result || {};
				result.template = template.string;
			}
		}
	
		/* Attach either the data or a rendered view */
		this.body = result || layout.frame({
			body: layout.compiled(_.merge({
				body: template.compiled(_.merge(data.template, {layout: data.layout}))
			}, data.layout))
		});
	}

	/* Our middleware to attach a view */
	return function* (next) {
		this.view = render;
		this.set('Request-Path', this.path);

		if(this.path === url) {
			this.body = yield compiledHelpers;
			this.type = 'text/javascript';
			return;
		}

		yield next;
	};
};

function compileHelpers(pth) {
	return new Promise(function(resolve, reject) {
		var filenames = fs.readdirSync(path.join(pth, 'helpers'));
		
		var contents = filenames.reduce(function(sum, name) {
			return sum + 'hbs.registerHelper("'+name.split('.')[0]+'", require("./'+name+'"));\n';
		}, 'var hbs = require("handlebars");\n');

		var b = browserify(es.readArray([contents]), {basedir: path.join(process.cwd(), pth, 'helpers')});
		b.require('handlebars');
		b.bundle(function(err, src) {
			if(err) {
				reject(err);
			} else {
				resolve(src);
			}
		});
	});
}

function assignHelpers(pth) {
	/* Register our handlebars helpers */
	var helpers = require('require-directory')(module, path.join(pth, 'helpers'));
	_.each(helpers, function(helper, name) {
		name = name.split('.')[0];
		if(!hbs.helpers[name]) {
			hbs.registerHelper(name, helper);
			logger.info('Loaded helper "' + name + '"');
		}
	});
}