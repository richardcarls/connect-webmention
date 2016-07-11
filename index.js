var util = require('util');
var throwjs = require('throw.js');
var bodyParser = require('body-parser');
var _ = require('lodash');
var isValidUrl = require('valid-url').isUri;
var request = require('request');
var Microformats = require('microformat-node');
var jpath = require('jsonpath');


/**
 * Handles receiving of webmentions.
 *
 * @param {Object} [options] - The options object.
 * @param {Number} [options.maxRedirects=5] - Maximum amount of redirects to follow
 * when attempting to verify a mention source.
 */
module.exports.receive = function(options) {

  options = options || {};

  options.maxRedirects = options.maxRedirects || 5;

  // TODO: Enable salmention extension

  return function compose(req, res, next) {
    return bodyParser.urlencoded({
      extended: false,
    })(req, res, function composeCB(err) {
      if (err) { return next(err); }

      return receive(req, res, next);
    });
  };

  /**
   * middleware
   */
  function receive(req, res, next) {
    if (req.webmention) { return next(); }

    req.webmention = {};

    if (_.isEmpty(req.body)) { return next(); }

    var source = req.webmention.source = req.body.source;
    var target = req.webmention.target = req.body.target;

    verify(source, target, function(err, matches, data) {
      if (err) {
        req.webmention.error = err;

        return next();
      }

      if (!matches.length) { return next(); }

      req.webmention.verified = true;
      req.webmention.matches = matches;
      req.webmention.data = data;

      return next();
    });
  }


  /**
   * @private
   */
  function verify(source, target, callback) {

    /**
     * @callback verifyCallback
     * @param {Error|null} err - The Error object
     * @param {[String]} matches - List of matched properties
     * @param {Object} data - Parsed Microformats2 data
     */

    // Must be valid URIs
    if (!isValidUrl(source) || !isValidUrl(target)) {
      return callback(new throwjs.badRequest('`source` and `target` must be valid URIs'));
    }

    // Must not be self-referential
    if (source === target) {
      return callback(new throwjs.badRequest('`source` and `target` cannot be equal'));
    }

    // Must not be loopback address
    if (/^localhost|^(?:http:\/\/|https:\/\/)?(?:127|192|10)\./i.test(source)) {
      return callback(new throwjs.badRequest('`source` cannot be loopback or local address'));
    }

    // TODO: Use configured trust option for source URL
    // TODO: Use vouch protocol here

    request.get(source, {
      maxRedirects: options.maxRedirects,
    }, function(err, response, body) {
      if (err) { return callback(err); }

      if (response.statusCode !== 200) {
        return callback(new throwjs.badRequest('`source` is not found'));
      }

      Microformats.get({
        html: body,
      }, function(err, mfData) {
        if (err) { return callback(err); }

        var query = "$.items[*].properties[*][?(@.value ? "
            + "@.value == '" + target + "' : "
            + "@.indexOf('" + target + "') != -1"
            + ")]";
        var matches = jpath.nodes(mfData, query);

        if (!matches.length) {
          return callback(new throwjs.badRequest('`source` does not mention `target`'));
        }

        // TODO: Only return items containing matches

        var props = matches.map(function(match) {
          return match.path[match.path.indexOf('properties') + 1];
        });

        return callback(null, props, mfData);
      });
    });
  }

};
