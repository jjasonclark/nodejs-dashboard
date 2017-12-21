"use strict";

var _ = require("lodash");
var blessed = require("blessed");
var HelpView = require("./views/help");
var generateLayouts = require("./generate-layouts");
var LogProvider = require("./providers/log-provider");
var MetricsProvider = require("./providers/metrics-provider");
var GotoTimeView = require("./views/goto-time-view");
var FilterEnvDialogView = require("./filter-env-dialog-view");
var views = require("./views");

var THROTTLE_TIMEOUT = 150;

var Dashboard = function Dashboard(options) {
  this.options = options || {};
  this.settings = this.options.settings;

  this.screen = blessed.screen({
    smartCSR: true,
    title: options.appName
  });

  this.logProvider = new LogProvider(this.screen);
  this.metricsProvider = new MetricsProvider(this.screen);

  this._createViews();
  this._configureKeys();
  this.screen.render();
};

Dashboard.prototype._createViews = function () {
  this.layouts = generateLayouts(this.options.layoutsFile);

  // container prevents stream view scrolling from interfering with side views
  this.container = blessed.box();
  this.screen.append(this.container);
  this.viewOptions = {
    screen: this.screen,
    parent: this.container,
    logProvider: this.logProvider,
    metricsProvider: this.metricsProvider
  };

  this.helpView = new HelpView(this.viewOptions);
  this.gotoTimeView = new GotoTimeView(this.viewOptions);
  this.filterEnvDialogView = new FilterEnvDialogView(this.viewOptions);

  this.filterEnvDialogView.on("validated", function (text) {
    this.setEnvironmentVariablesFilter(text);
  }.bind(this));
  this.filterEnvDialogView.on("textChanged", function (ch, key, text) {
    this.setEnvironmentVariablesFilter(text);
  }.bind(this));

  this._showLayout(0);
};

Dashboard.prototype.setEnvironmentVariablesFilter = function (value) {
  if (value !== this._filter) {
    this.onEnvironmentVariablesFilterChange(this._filter, value);
    this._filter = value;
  }
};

Dashboard.prototype._configureKeys = function () {
  // ignore locked works like a global key handler regardless of input
  // this key will be watched on the global screen
  this.screen.ignoreLocked = ["C-c"];
  this.screen.key("C-c", function () {
    process.exit(0); // eslint-disable-line no-process-exit
  });

  // watch for key events on the main container; not the screen
  // this allows for more granular key bindings in other views
  this.screen.key(["left", "right"], _.throttle(function (ch, key) {
    var delta = key.name === "left" ? -1 : 1;
    var target = (this.currentLayout + delta + this.layouts.length) % this.layouts.length;
    this._showLayout(target);
  }.bind(this), THROTTLE_TIMEOUT));

  this.screen.key(["?", "h", "S-h"], function () {
    this.helpView.toggle();
    this.gotoTimeView.hide();
    this.filterEnvDialogView.hide();
    this.screen.render();
  }.bind(this));

  this.container.key(["g", "S-g"], function () {
    this.helpView.hide();
    this.filterEnvDialogView.hide();
    this.gotoTimeView.toggle();
    this.screen.render();
  }.bind(this));

  this.container.key(["f", "S-f", "C-f"], function () {
    this.helpView.hide();
    this.gotoTimeView.hide();
    this.filterEnvDialogView.toggle();
    this.filterEnvDialogView.setValue(this._filter);
    this.screen.render();
  }.bind(this));

  this.screen.key("escape", function () {
    if (this.helpView.isVisible() || this.gotoTimeView.isVisible()) {
      this.helpView.hide();
      this.gotoTimeView.hide();
      this.screen.render();
    } else {
      this.screen.emit("resetGraphs");
      this._showLayout(0);
    }
  }.bind(this));

  this.screen.key(["q", "S-q"], function () {
    process.exit(0); // eslint-disable-line no-process-exit
  });

  this.container.key(["w", "S-w", "s", "S-s"], function (ch, key) {
    var zoom = key.name === "s" ? -1 : 1;
    this.screen.emit("zoomGraphs", zoom);
    this.screen.render();
  }.bind(this));

  this.container.key(["a", "S-a", "d", "S-d"], function (ch, key) {
    var scroll = key.name === "a" ? -1 : 1;
    this.screen.emit("scrollGraphs", scroll);
    this.screen.render();
  }.bind(this));

  this.container.key(["z", "S-z", "x", "S-x"], function (ch, key) {
    var goto = key.name === "z" ? -1 : 1;
    this.screen.emit("startGraphs", goto);
    this.screen.render();
  }.bind(this));
};

Dashboard.prototype.onEvent = function (event) {
  this.screen.emit(event.type, event.data);
  // avoid double screen render for stream events (Element calls screen.render on scroll)
  // TODO dashboard shouldn't know which events are used by which widgets
  if (event.type === "metrics") {
    this.screen.render();
  }
};

Dashboard.prototype._showLayout = function (id) {
  if (this.currentLayout === id) {
    return;
  }

  // Remove current layout
  if (this.panel) {
    this.panel.destroy();
    delete this.panel;
  }

  // create new layout
  this.panel = views.create(this.layouts[id], this.viewOptions, this.settings);

  this.currentLayout = id;
  this.helpView.node.setFront();
  this.screen.render();
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
Dashboard.prototype.onEnvironmentVariablesFilterChange = function (before, after) {
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

module.exports = Dashboard;
