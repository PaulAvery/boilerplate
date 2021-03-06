var marked = require('marked');
var hbs = require('handlebars');
var highlight = require('highlight.js');

//Set highlighting options
marked.setOptions({
	highlight: function(code) {
		return highlight.highlightAuto(code).value;
	}
});

//Export our helper function
module.exports = function(context) {
	var data;
	if(arguments.length === 1) {
		data = context.fn(context.data.root);
	} else {
		data = context;
	}
	//Split at newlines, so we can detect the indentation level of the first line and set it to 0.
	var arr = data.split('\n');
	var moved = /^([ \t]*)/.exec(arr[0])[1].length;
	arr[0] = arr[0].substr(moved);

	return new hbs.SafeString(marked(arr.join('\n')));
};