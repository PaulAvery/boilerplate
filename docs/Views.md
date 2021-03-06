Views
=====
Your new application provides you with a view system. On the most basic level, these views are defined as handlebars templates, but it provides you with some other nice features. These include:

* Server and Client Side rendering
	* No need to manually fetch templates, helpers or data on the client
* DOM-Diffing for incremental view updates on the client
	* CSS-Transitions are supported
* Layout Support

Some of these features are a little complex, so if you run into any problems understanding them, you should check out the code in this application to get a better understanding.

Helpers
-------
Handlebars helpers can be defined in `views/helpers`. Each file should export a single function, which will be registered as a handlebars helper. The name of the helper is derived from the file name. These helpers can be included on the client side by including the `/js/helpers` path.

Server-Side
-----------
###Layout/Frame
#### Frame
The first thing we have to do is define those parts which should not be touched by our client-side rendering (Everything outside of our `body` tag). For this you have a file named `frame.hbs` located in your `views` folder. Its contents should at its most minimal look something like this:
``` handlebars
<!DOCTYPE html>
<html>
	<head>
		<title>Boilerplate</title>
		<script src="{{basepath}}/js/deps/polyfills"></script>
		<script src="{{basepath}}/js/deps"></script>
		<script src="{{basepath}}/js/helpers"></script>
		<script src="{{basepath}}/js"></script>
		<link rel="stylesheet" href="{{basepath}}/css/deps">
		<link rel="stylesheet" href="{{basepath}}/css">
	</head>
	<body>
		{{{body}}}
	</body>
</html>
```
Your layout and your templates will later be rendered into the `body` tag by means of the `{{{body}}}` variable.

#### Layout
In addition to this frame, you also have a Layout, which should consist of those parts of your html, which are view-independent. This could be a headerbar or some centered div blocks to then contain the actual view or something similar. The layout itself can also provide its own data. This data can be accessed from within the views and should therefore be things which are global to all views (e.g. information about the current user). The layout is defined in the two files `layout.hbs` and `layout.js`, both located in the `views` folder.

The `layout.hbs` file may look something like this:
``` html
<ul class='navbar'>
	<li><a href='/'>Home</a></li>
	{{#unless user}}<li><a href='/login'>Login</a></li>{{/unless}}
	{{#if user}}<li><a href='/logout'>Logout</a></li>{{/if}}
</ul>
{{{body}}}
```
The `{{{body}}}` variable will be replaced with the actual view upon rendering.
Now you may be wondering "Where is the `user` data coming from?". This is where the `layout.js` file comes into effect. It should export a generator function, which (when run like any normal koa middleware) returns the data to be rendered into the layout. This allows for you to define your data retrieval once and leave the serving and handling of that data to the application.

This might look like the following:
```
module.exports = function *() {
	return {
		user: this.passport.user || false
	};
};
```

### Views
Views are defined similarly to your layout. Each view should have its own directory within the `views` folder, which then contains a `data.js` and a `template.hbs` file. The `data.js` should provide the views data in the same way as the `layout.js`. When the `template.hbs` file is rendered, it is provided with the data from `data.js` as well as a top-level property named `layout` which contanis the layouts data.

#### Rendering
To render a view, you can call `yield this.view("name")` within any koa middleware. This will render the template located at `view/name/template.hbs` into your layout and your frame and serve it as a static HTML page. If a `format` URL parameter is set, it may respond differently (with the raw template or the data in JSON format) which is used by our client-side rendering. If you want more information on this, check our custom `view` middleware at `middleware/view.js`.

Client-Side
-----------
You can find the client side rendering code in the `assets/js/view` folder. The files `view.js` and `page.js` export constructors for views and a router respectively. The basic concept is, to instantiated views as needed and then attach them to the router. As the `assets/js/index.js` is the entry point for your javascript bundle, you should declare your views there.

### View-Object
A view contains information about the routes it needs to attach to. In addition it caches the views template, so the site only needs to load the data on subsequent requests. In addition, the view emits events on load etc. If you have no need for events on a specific view, and the view is static (no dynamic parts etc.), you may omit declaring it explicitly. The router will create a new view for an unknown url on the fly.

#### Instantiation
The constructor takes as its first argument either a string or a RegExp object. This will be used to match the routes. Strings may be in the same format as those for your koa-router, allowing you to use the exact same routes as on your server. If you have parameterized routes (or use a regex), you *may* run into problems fetching the view template. If you do, you may provide a valid url for your view as the second argument.

**Examples:**
	var view = new View('/route/:param?');
	var view2 = new View(/^\/route/, '/route');

#### Instance-Methods
##### render()
Renders and inserts the view without fetching data. Also takes care of the layout and its data.

##### load()
Loads new data and then calls `render()`

##### onDetached(type, selector, handler, bubbling)
Attach EventListeners to the DOM. See below at DOM-Events for usage.

#### Events
Your `View` objects act as node EventEmitters and provide the following events:
* load: Called after new data is received from the server
* loaded: Called after the view with the new data was rendered
* open: Called before the view is rendered by our router
* opened: Called after the view was inserted by our router

#### DOM-Events
Due to fact, that we do not insert the entirety of each view on each render, but use our own diffing algorithm, directly working with DOM-events becomes a little more tricky. If you attach new handlers on render you might attach them twice. Providing events to disattach them seemed needlessly complicated and inefficient, so instead each view provides you with an `attach(type, selector, handler)` function. You should provide the type of event (e.g. `click`) you want to bind to, a selector which matches all elements to handle, and a handler function. This handler function will then be called as you would expect, with `this` set to the emitting event and the event object passed as the first argument.
Internally this works by attaching a handler to the `body` element and then letting events bubble, filtering out those matched by the selector and calling your handlers with the corresponding arguments.
The bubbling parameter decides if an event should be triggered even if the matching element is between the source and the document. This defaults to true, and helps if you e.g. want to trigger click events on child elements as well.

#### Example (`assets/js/index.js`)

	var Page = require('./view/page');
	var View = require('./view/view');

	var page = new Page();
	var view = new View('/route');

	page.attach(view);
	page.init();

### Diffing
As stated above, rendered views are not simply inserted but run through a diffing algorithm against the current document. Normally you should not need to worry about this, but the code can be found in `assets/js/view/diff.js` in case you want (or need) to take a look.

In addition, the basic algorithm is provided as its own documentation in `Diffing.md`
