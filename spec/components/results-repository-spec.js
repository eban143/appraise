/*global describe, it, expect, require, jasmine, beforeEach, afterEach */
'use strict';
const mockFileRepository = require('../support/mock-file-repository'),
	ResultsRepository = require('../../src/components/results-repository');
describe('ResultsRepository', () => {
	let fileRepository, underTest, templateRepository, pendingPromise;
	beforeEach(() => {
		const components = {};
		fileRepository = mockFileRepository({
			'results-dir': 'resultDir',
			'examples-dir': 'exampleDir',
			'templates-dir': 'templatesDir'
		});
		templateRepository = jasmine.createSpyObj('templateRepository', ['get']);
		components.fileRepository = fileRepository;
		components.templateRepository = templateRepository;
		underTest = new ResultsRepository({}, components);
		pendingPromise = new Promise(() => true);
	});
	describe('loadFromResultsDir', () => {
		it('uses the file repository to fetch the JSON contents of the summary', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(fileRepository.readJSON).toHaveBeenCalledWith('resultDir/summary.json'))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({});
		});
		it('rejects if the file read rejects', done => {
			underTest.loadFromResultsDir()
				.then(done.fail)
				.catch(e => expect(e).toEqual('boom'))
				.then(done);
			fileRepository.promises.readJSON.reject('boom');
		});
		it('loads the content so it can be retrived with finder methods', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getPageNames()).toEqual(['first']))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [{pageName: 'first'}]});
		});
	});
	describe('getPageNames', () => {
		it('returns an empty array if no result loaded', () => {
			expect(underTest.getPageNames()).toEqual([]);
		});
		it('returns an empty array if no pages in the results', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getPageNames()).toEqual([]))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({nonpages: [{pageName: 'first'}]});
		});
		it('returns an array of page result names', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getPageNames()).toEqual(['first', 'second']))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [{pageName: 'first'}, {pageName: 'second'}]});

		});
	});
	describe('getResultNames', () => {
		it('returns an empty array if no result loaded', () => {
			expect(underTest.getResultNames('abc')).toEqual([]);
		});
		it('returns an empty array if no pages in the results', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getResultNames('first')).toEqual([]))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({nonpages: [{pageName: 'first'}]});
		});
		it('returns an empty array if the requested page does not exist in the results', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getResultNames('third')).toEqual([]))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [
				{pageName: 'first', results: {a: 1, b: 2}},
				{pageName: 'second', results: {c: 1, d: 2}}
			]});
		});
		it('returns an empty array if the requested page exists but has no results', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getResultNames('third')).toEqual([]))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [
				{pageName: 'first', results: {a: 1, b: 2}},
				{pageName: 'second', results: {c: 1, d: 2}},
				{pageName: 'third'}
			]});
		});
		it('returns an empty array if the requested page exists but has empty results', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getResultNames('third')).toEqual([]))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [
				{pageName: 'first', results: {a: 1, b: 2}},
				{pageName: 'second', results: {c: 1, d: 2}},
				{pageName: 'third', results: {}}
			]});
		});
		it('returns an array of result keys from the page', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getResultNames('second')).toEqual(['c', 'd']))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve({pages: [
				{pageName: 'first', results: {a: 1, b: 2}},
				{pageName: 'second', results: {c: 1, d: 2}},
				{pageName: 'third', results: {}}
			]});
		});
	});
	describe('approveResult', () => {
		let template;
		beforeEach(done => {
			const pageObject = {
					pageName: 'folder1/folder2/pageX',
					results: {
						'with expected': {
							output: {
								screenshot: 'exp-1.png'
							},
							expected: 'images/123/exp-old.png'
						},
						'with no expected': {
							output: {
								screenshot: 'exp-2.png'
							}
						}
					}
				},
				resultsSummary = {
					pages: [pageObject]
				};

			template = jasmine.createSpy('template');
			templateRepository.get.and.returnValue(Promise.resolve(template));
			fileRepository.promises.readJSON.resolve(resultsSummary);
			underTest.loadFromResultsDir().then(done);
		});
		describe('when working with an expected result', () => {
			it('copies the screenshot to the expected path', done => {
				underTest.approveResult('folder1/folder2/pageX', 'with expected')
					.then(() => expect(fileRepository.copyFile).toHaveBeenCalledWith(
						'resultDir/folder1/folder2/pageX/exp-1.png',
						'exampleDir/folder1/folder2/images/123/exp-old.png'
					)).then(done, done.fail);

				fileRepository.promises.copyFile.resolve();
			});
			it('rejects if the copy rejects', done => {
				underTest.approveResult('folder1/folder2/pageX', 'with expected')
					.then(done.fail)
					.catch(e => expect(e).toEqual('boom'))
					.then(done);

				fileRepository.promises.copyFile.reject('boom');
			});
		});
		describe('when working without an expected result', () => {
			it('copies the actual file to a new random location inside the same folder as the page', done => {
				template.and.returnValue('-- from template --');
				fileRepository.newFilePath.and.returnValue('/targetDir/newPath.png');
				underTest.approveResult('folder1/folder2/pageX', 'with no expected')
					.then(() => expect(fileRepository.newFilePath).toHaveBeenCalledWith('exampleDir/folder1/folder2', 'with no expected', 'png'))
					.then(() => expect(fileRepository.copyFile).toHaveBeenCalledWith('resultDir/folder1/folder2/pageX/exp-2.png', '/targetDir/newPath.png'))
					.then(() => expect(templateRepository.get).toHaveBeenCalledWith('generate-outcome'))
					.then(() => expect(template).toHaveBeenCalledWith(jasmine.objectContaining({
						exampleName: 'with no expected',
						imagePath: 'newPath.png'
					})))
					.then(() => expect(fileRepository.appendText).toHaveBeenCalledWith('exampleDir/folder1/folder2/pageX.md', '-- from template --'))
					.then(done, done.fail);

				fileRepository.promises.copyFile.resolve();
				fileRepository.promises.appendText.resolve();

			});
		});
	});
	describe('resetResultsDir', () => {
		let pendingPromise;
		beforeEach(() => {
			pendingPromise = new Promise(() => true);
		});
		it('cleans the result dir before any copying', done => {
			fileRepository.cleanDir.and.callFake(path => {
				expect(path).toEqual('resultDir');
				expect(fileRepository.copyDirContents).not.toHaveBeenCalled();
				done();
				return pendingPromise;
			});
			underTest.resetResultsDir()
				.then(done.fail, done.fail);
		});
		it('rejects if cleaning the directory rejects', done => {
			fileRepository.cleanDir.and.returnValue(Promise.reject('bomb!'));
			underTest.resetResultsDir()
				.then(done.fail)
				.catch(e => expect(e).toEqual('bomb!'))
				.then(done);
		});
		it('copies the example dir into results without markdown paths', done => {
			fileRepository.isSourcePage.and.callFake(t => /src/.test(t));
			fileRepository.copyDirContents.and.callFake((from, to, pred) => {
				expect(from).toEqual('exampleDir');
				expect(to).toEqual('resultDir');
				expect(pred('some non-source')).toBeTruthy();
				expect(pred('src-file')).toBeFalsy();
				done();
				return pendingPromise;
			});
			fileRepository.cleanDir.and.returnValue(Promise.resolve());
			underTest.resetResultsDir()
				.then(done.fail, done.fail);
		});
		it('rejects if the first copy rejects', done => {
			fileRepository.copyDirContents.and.returnValue(Promise.reject('bomb!'));
			fileRepository.cleanDir.and.returnValue(Promise.resolve());
			underTest.resetResultsDir()
				.then(done.fail)
				.catch(e => expect(e).toEqual('bomb!'))
				.then(done);
		});
		it('copies the template assets when the examples dir copy succeeds', done => {
			fileRepository.isSourcePage.and.callFake(t => /src/.test(t));
			fileRepository.copyDirContents.and.callFake((from, to, pred) => {
				if (fileRepository.copyDirContents.calls.count() === 1) {
					return Promise.resolve();
				}
				expect(from).toEqual('templatesDir/assets');
				expect(to).toEqual('resultDir/assets');
				expect(pred).toBeUndefined();
				done();
				return pendingPromise;
			});
			fileRepository.cleanDir.and.returnValue(Promise.resolve());
			underTest.resetResultsDir()
				.then(done.fail, done.fail);
		});
	});
	describe('getRunStatus', () => {
		it ('returns an empty status if no results loaded', () => {
			expect(underTest.getRunStatus()).toEqual({pages: 0, total: 0, status: 'skipped'});
		});
		it ('returns the summary aggregate counts', done => {
			underTest.loadFromResultsDir()
				.then(() => expect(underTest.getRunStatus()).toEqual({pages: 2, total: 25, success: 20, failure: 5, status: 'failure'}))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve(
				{
					pages: [
						{pageName: 'first', summary: {success: 10, total: 10}},
						{pageName: 'second', summary: {success: 10, failure: 5, total: 15}}
					]
				}
			);
		});
	});
	describe('createNewRun', () => {
		it('empties out any previously loaded results', done => {

			underTest.loadFromResultsDir()
				.then(() => underTest.createNewRun())
				.then(() => expect(underTest.getRunStatus()).toEqual({pages: 0, total: 0, status: 'skipped'}))
				.then(done, done.fail);
			fileRepository.promises.readJSON.resolve(
				{
					pages: [
						{pageName: 'first', summary: {success: 10, total: 10}},
						{pageName: 'second', summary: {success: 10, failure: 5, total: 15}}
					]
				}
			);
		});
		it('has no effect if nothing loaded', () => {
			underTest.createNewRun();
			expect(underTest.getRunStatus()).toEqual({pages: 0, total: 0, status: 'skipped'});
		});
	});
	describe('writeSummary', () => {
		beforeEach(() => {
			jasmine.clock().install();
			jasmine.clock().mockDate(new Date(1000));
			underTest.createNewRun();
			jasmine.clock().tick(1000);
			underTest.closeRun();
		});
		afterEach(() => {
			jasmine.clock().uninstall();
		});
		it('stores the current result summary in the results dir', done => {


			fileRepository.writeJSON.and.callFake((filePath, data) => {
				expect(filePath).toEqual('resultDir/summary.json');
				expect(data).toEqual({
					startedAt: 1000,
					finishedAt: 2000,
					pages: [],
					summary: {total: 0, pages: 0, status: 'skipped'}
				});
				done();
				return pendingPromise;
			});
			underTest.writeSummary()
				.then(done.fail, done.fail);
		});
		it('rejects if the summary write rejects', done => {
			fileRepository.promises.writeJSON.reject('bomb!');
			underTest.writeSummary()
				.then(done.fail)
				.catch(e => expect(e).toEqual('bomb!'))
				.then(done);
		});
		it('formats the summary using the summary template and writes to summary.html', done => {
			const formatter = jasmine.createSpy('formatter').and.returnValue('from formatter');
			templateRepository.get.and.returnValue(formatter);
			underTest.writeSummary()
				.then(() => expect(templateRepository.get).toHaveBeenCalledWith('summary'))
				.then(() => expect(formatter).toHaveBeenCalledWith({
					startedAt: 1000,
					finishedAt: 2000,
					pages: [],
					summary: {total: 0, pages: 0, status: 'skipped'}
				}))
				.then(() => expect(fileRepository.writeText).toHaveBeenCalledWith('resultDir/summary.html', 'from formatter'))
				.then(done, done.fail);
			fileRepository.promises.writeJSON.resolve();
			fileRepository.promises.writeText.resolve();
		});
		it('rejects if there is no summary template', done => {
			templateRepository.get.and.throwError('no template');
			underTest.writeSummary()
				.then(done.fail)
				.catch(e => expect(e.message).toEqual('no template'))
				.then(() => expect(fileRepository.writeText).not.toHaveBeenCalled())
				.then(done);
			fileRepository.promises.writeJSON.resolve();
		});
		it('rejects if the formatter fails', done => {
			const formatter = jasmine.createSpy('formatter').and.throwError('formatter failed');
			templateRepository.get.and.returnValue(formatter);
			underTest.writeSummary()
				.then(done.fail)
				.catch(e => expect(e.message).toEqual('formatter failed'))
				.then(() => expect(fileRepository.writeText).not.toHaveBeenCalled())
				.then(done);
			fileRepository.promises.writeJSON.resolve();
		});
		it('rejects if the html output write fails', done => {
			const formatter = jasmine.createSpy('formatter').and.returnValue('from formatter');
			templateRepository.get.and.returnValue(formatter);
			underTest.writeSummary()
				.then(done.fail)
				.catch(e => expect(e).toEqual('boom!'))
				.then(done);
			fileRepository.promises.writeJSON.resolve();
			fileRepository.promises.writeText.reject('boom!');
		});
	});
	describe('close run', () => {
		beforeEach(() => {
			jasmine.clock().install();
		});
		afterEach(() => {
			jasmine.clock().uninstall();
		});

		it('appends a summary and a timestamp to the current run results', done => {
			fileRepository.writeJSON.and.callFake((filePath, contents) => {
				expect(contents.finishedAt).toEqual(5000);
				expect(contents.summary).toEqual({
					pages: 2,
					total: 25,
					success: 20,
					failure: 5,
					status: 'failure'
				});
				done();
				return pendingPromise;
			});
			jasmine.clock().mockDate(new Date(5000));
			underTest.loadFromResultsDir()
				.then(underTest.closeRun)
				.then(underTest.writeSummary)
				.then(done.fail, done.fail);

			fileRepository.promises.readJSON.resolve(
				{
					pages: [
						{pageName: 'first', summary: {success: 10, total: 10}},
						{pageName: 'second', summary: {success: 10, failure: 5, total: 15}}
					]
				}
			);

		});
	});
});