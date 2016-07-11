/* global define, it, beforeEach */
var expect = require('chai').expect;
var nock = require('nock');

var webmention = require('..');

var mockSourceUrl = 'https://example-source.com/notes/source';
var mockTargetUrl = 'https://example-target.com/notes/target';

describe('connect-webmention', function () {

  describe('receiving a valid webmention', function() {

    var middleware = webmention.receive();
    var request = {
      method: 'post',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      url: 'https://example-source.com/',
      body: {
        source: mockSourceUrl,
        target: mockTargetUrl,
      },
    };
    var result;

    before('mock the source', function() {
      nock(mockSourceUrl)
        .get('')
        .replyWithFile(200, __dirname + '/mocks/valid-source.html');

      middleware(request, {}, function() {});

      result = request.webmention;
    });

    it('should create a webmention property', function() {
      expect(result).to.be.ok;
    });

    it('should populate source and target', function() {
      expect(result.source).to.equal(mockSourceUrl);
      expect(result.target).to.equal(mockTargetUrl);
    });

    it('should get the source page', function() {
      expect(nock.isDone()).to.be.true;
    });

    it('should verify the webmention', function() {
      expect(result.verified).to.be.true;
    });

    it('should include the list of matched properties', function() {
      expect(result.matches).to.contain('in-reply-to');
    });

    it('should include the parsed data', function() {
      expect(result.data).to.be.ok;
    });
    
  }); // receiving a valid webmention

  describe('receiving an invalid webmention', function() {

    var middleware = webmention.receive();
    var request = {
      method: 'post',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      url: 'https://example-source.com/',
      body: {
        source: mockSourceUrl,
        target: mockTargetUrl,
      },
    };

    it('should fail on 404', function() {
      nock(mockSourceUrl)
        .get('')
        .reply(404);

      middleware(request, {}, function(err, req) {
        expect(err).to.be.null;
        expect(req.webmention.error.statusCode).to.equal(404);
      });
    });
    
  }); // receiving an invalid webmention
  
}); // connect-webmention
