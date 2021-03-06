//Require our router so we can use it later
var Page = require('./view/page');
var page = new Page();

//Attach our views.
//We only need to attach views with parameterized routes, the other ones are caught and created at runtime
page.attach('/docs/written/:doc');
page.attach('/docs/generated/:doc*');

//Run our router
page.init();