/*global module, require*/
'use strict';

const Handlebars = require('handlebars');
module.exports = function HandlebarsTemplateRepository(config, components) {
	const fileRepository = components.fileRepository,
		self = this,
		templates = {};

	self.get = function (name) {
		if (templates[name]) {
			return Promise.resolve(templates[name]);
		} else {
			return fileRepository.readText(fileRepository.referencePath('templates', name + '.hbs'))
				.then(Handlebars.compile)
				.then(t => templates[name] = t);
		}
	};
};
