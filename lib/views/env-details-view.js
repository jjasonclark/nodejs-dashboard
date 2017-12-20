"use strict";

var _ = require("lodash");
var BaseDetailsView = require("./base-details-view");

var EnvDetailsView = function EnvDetailsView(options) {
  BaseDetailsView.call(this, options);
};

EnvDetailsView.prototype = Object.create(BaseDetailsView.prototype);

EnvDetailsView.prototype.getDefaultLayoutConfig = function () {
  return {
    label: " Environment Variables ",
    border: "line",
    style: {
      border: {
        fg: "white"
      }
    },
    tags: true,
    scrollable: true,
    keys: true,
    input: true,
    scrollbar: {
      style: {
        fg: "white",
        inverse: true
      },
      track: {
        ch: ":",
        fg: "cyan"
      }
    }
  };
};

EnvDetailsView.prototype.getDetails = function (filters) {
  var envValues = _.map(process.env, function (value, key) {
    return {
      label: key,
      data: value
    };
  });
  return _.filter(envValues, function (details) {
    return _.every(filters || [], function (filter) {
      var pattern;

      if (!filter) {
        return true;
      }

      pattern = new RegExp(_.escapeRegExp(filter || ""), "i");
      return !filter || pattern.test(details.label) || pattern.test(details.data);
    });
  });
};

EnvDetailsView.prototype._getBoxContent = function (data, filters) {
  var longestLabel = _.maxBy(data, "label.length");

  var applyHighlights = function (value, normalAttributes) {
    var pattern;
    var split;

    if (!filters) {
      return normalAttributes + value;
    }

    pattern = _
      .chain(filters)
      .filter(function (filter) {
        return /\S/.test(filter);
      })
      .reduce(function (prev, filter) {
        if (prev !== "") {
          prev += "|";
        }
        prev += _.escapeRegExp(filter);
        return prev;
      }, "")
      .value();

    pattern = new RegExp(pattern, "gi");
    split = value.split(pattern);

    return normalAttributes
      + _.reduce(split, function (prev, curr) {
        var original = pattern.exec(value);
        return prev + "{inverse}" + original[0] + "{/}" + normalAttributes + curr;
      });
  };

  var getFormattedContent = function (prev, details) {
    prev += applyHighlights(details.label, "{cyan-fg}{bold}")
      + "{/}"
      + _.repeat(" ", longestLabel - details.label.length + 1)
      + applyHighlights(details.data, "{green-fg}")
      + "{/}\n";
    return prev;
  };

  return _.trimEnd(_.reduce(data, getFormattedContent, ""), "\n");
};

module.exports = EnvDetailsView;
