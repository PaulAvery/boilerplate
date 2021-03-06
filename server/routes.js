var R = require('koa-route');

//Allow us to simply tie a view to a route
function view(name) {
	return function* () {
		yield this.view.call(this, name, Array.prototype.slice.call(arguments));
	};
}

//We need to export a function which takes a koa instance, so we can attach our route middleware to it
module.exports = function(app) {
	app.use(R.get('/', view('home')));
	app.use(R.get('/docs/written/:doc?', view('docs')));
	app.use(R.get('/docs/generated/:doc*', view('docs-gen')));
	app.use(R.get('/login', view('login')));
	
	//Our login/logout routes
	app.use(R.post('/login',
		services.passport.authenticate('local', {
			successRedirect: '/',
			failureRedirect: '/login#fail'
		})
	));
	app.use(R.get('/logout', function *() {
		this.logout();
		this.redirect('/');
	}));
};