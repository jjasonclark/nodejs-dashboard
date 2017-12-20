"use strict";

var blessed = require("blessed");
var _ = require("lodash");

var BaseView = require("./base-view");
var FilterEnvDialogView = require("./filter-env-dialog-view");
var CpuDetailsView = require("./cpu-details-view");
var EnvDetailsView = require("./env-details-view");
var NodeDetailsView = require("./node-details-view");
var SystemDetailsView = require("./system-details-view");
var UserDetailsView = require("./user-details-view");

// keys used locally to this view
var localKeys = [
  "w", "S-w", "s", "S-s",
  "f", "S-f", "C-f",
  "pageup", "pagedown",
  "home", "end"
];

/**
 * The constructor for PlatformDetailsView.
 *
 * @param {Object} options
 * Any options that may be specified.
 *
 * @returns {void}
 */
var PlatformDetailsView = function PlatformDetailsView(options) {
  // super()
  BaseView.call(this, options);

  this.screen = options.parent.screen;
  this.globalKeys = options.globalKeys || [];
  this.localKeys = localKeys;
  this.filterEnvDialogView =
    new FilterEnvDialogView(Object.assign({ top: 2 }, options));

  this._createViews(options);
};

// inheritance
PlatformDetailsView.prototype = Object.create(BaseView.prototype);

/**
 * Provide the default layout configuration.
 *
 * @returns {Object}
 * The default layout configuration is returned.
 */
PlatformDetailsView.prototype.getDefaultLayoutConfig = function () {
  return {
    borderColor: "green",
    title: " Platform Details "
  };
};

/**
 * Given data and optional filters, return the content for a box.
 *
 * @param {Object[]} data
 * This is the array of label/data objects that define each data
 * point for the box.
 *
 * @param {String[]} filters
 * An optional array of words to filter both labels and data.
 *
 * @returns {String}
 * The content string for the box is returned.
 */
var getBoxContent = function (data, filters) {
  var longestLabel = _.reduce(data, function (prev, detail) {
    return Math.max(prev, detail.label.length);
  }, 0);

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

/**
 * Provide details for the Environment Variables box.
 *
 * @param {String[]} filters
 * An optional array of words to filter.
 *
 * @returns {Object[]}
 * The array of label/data datapoints is returned.
 */
var getEnvDetails = function (filters) {
  return _.filter(_.map(process.env, function (value, key) {
    return {
      label: key,
      data: value
    };
  }), function (details) {
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

/**
 * Create the view.
 *
 * @param {Object} options
 * Any options that may be specified.
 *
 * @returns {void}
 */
PlatformDetailsView.prototype._createViews = function (options) {
  var createViewElements = function () {
    this.node = blessed.box({
      label: this.layoutConfig.title,
      border: "line",
      style: {
        border: {
          fg: this.layoutConfig.borderColor
        }
      },
      scrollable: true,
      keys: true
    });

    var viewOptions = {
      parent: this.node,
      layoutConfig: options.layoutConfig
    };
    this.nodeDetails = new NodeDetailsView(viewOptions);
    this.nodeDetails.node.top = 0;
    this.systemDetails = new SystemDetailsView(viewOptions);
    this.systemDetails.node.top = 5;

    this.userDetails = new UserDetailsView(viewOptions);
    this.userDetails.node.top = 0;
    this.cpuDetails = new CpuDetailsView(viewOptions);
    this.cpuDetails.node.top = 5;

    // alignBottom(this.systemDetails, 13);
    // alignBottom(this.cpuDetails, 13);

    this.envDetails = new EnvDetailsView(viewOptions);
    this.envDetails.node.top = 15;
  }.bind(this);

  var constructView = function () {
    this.screen.saveFocus();

    options.parent.append(this.node);

    this.envDetails.node.focus();

    this.recalculatePosition();
  }.bind(this);

  var setupEventHandlers = function () {
    var scrollDetails = function (ch, key) {
      var scroll;

      switch (key.full) {
      case "w":
      case "S-w":
        scroll = -1;
        break;
      case "s":
      case "S-s":
        scroll = +1;
        break;
      case "pageup":
        scroll = -this.envDetails.node.height;
        break;
      case "pagedown":
        scroll = +this.envDetails.node.height;
        break;
      case "home":
        this.envDetails.node.resetScroll();
        scroll = 0;
        break;
      case "end":
        this.envDetails.node.resetScroll();
        scroll = this.envDetails.node.getScrollHeight();
        break;
      }

      this.envDetails.node.scroll(scroll);
      this.screen.render();
    }.bind(this);

    var displayFilterEnvWindow = function () {
      this.filterEnvDialogView.toggle();
      this.filterEnvDialogView.setValue(this._filter);
    }.bind(this);

    var filterEnvValidated = function (text) {
      this.setEnvironmentVariablesFilter(text);
    }.bind(this);

    var filterEnvChanged = function (ch, key, text) {
      this.setEnvironmentVariablesFilter(text);
    }.bind(this);

    this.envDetails.node.on("attach", function () {
      this.envDetails.node.key(
        ["w", "S-w", "s", "S-s", "pageup", "pagedown", "home", "end"],
        scrollDetails
      );
      this.envDetails.node.key(["f", "S-f", "C-f"], displayFilterEnvWindow);

      this.filterEnvDialogView.on("validated", filterEnvValidated);
      this.filterEnvDialogView.on("textChanged", filterEnvChanged);
    }.bind(this));

    this.envDetails.node.on("detach", function () {
      // stop listening to keys
      this.envDetails.node.unkey(
        ["w", "S-w", "s", "S-s", "pageup", "pagedown", "home", "end", "f", "S-f", "C-f"],
        scrollDetails
      );

      // and events
      this.filterEnvDialogView.removeAllListeners("validated");
      this.filterEnvDialogView.removeAllListeners("textChanged");
    }.bind(this));
  }.bind(this);

  this._filter = "";

  createViewElements();
  setupEventHandlers();
  constructView();
};

/**
 * Set the Environment Variables filter value.
 *
 * @param {String} value
 * The value to set.
 *
 * @returns {void}
 */
PlatformDetailsView.prototype.setEnvironmentVariablesFilter = function (value) {
  if (value !== this._filter) {
    this.onEnvironmentVariablesFilterChange(this._filter, value);
    this._filter = value;
  }
};

/**
 * Respond when the Environment Variables filter changes
 *
 * @param {String} before
 * The value before the change.
 *
 * @param {String} after
 * The value after the change.
 *
 * @returns {void}
 */
PlatformDetailsView.prototype.onEnvironmentVariablesFilterChange = function (before, after) {
  // break up filters on white space
  var filters = after.split(/\s/gm) || [after];
  var content = getBoxContent(getEnvDetails(filters), filters);

  if (!content) {
    content = "{red-fg}{bold}No env variables found matching filter criteria{/}";
  }

  // without removeLabel(), setLabel() messes up the border before the label
  this.envDetails.node.removeLabel();
  if (after) {
    this.envDetails.node.setLabel(" Environment Variables (subsetted) ");
  } else {
    this.envDetails.node.setLabel(" Environment Variables ");
  }

  // the scroll must be reset or it can get out of sync with unequal content
  this.envDetails.node.resetScroll();
  this.envDetails.node.setContent(content);
};

module.exports = PlatformDetailsView;
