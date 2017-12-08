"use strict";

var blessed = require("blessed");
var os = require("os");
var prettyBytes = require("pretty-bytes");
var utils = require("../utils");
var _ = require("lodash");

var BaseView = require("./base-view");
var FilterEnvDialogView = require("./filter-env-dialog-view");

var MILLISECONDS_PER_SECOND = require("../constants").MILLISECONDS_PER_SECOND;

// keys used locally to this view
var localKeys = [
  "w", "S-w", "s", "S-s",
  "f", "S-f", "C-f",
  "pageup", "pagedown",
  "home", "end"
];

var UPTIME_INTERVAL_MS = MILLISECONDS_PER_SECOND;
var BOX_PADDING = 2;

// these objects define the various portions of the screen
var NODE_DETAILS_BOX = {
  label: " Node ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var SYSTEM_DETAILS_BOX = {
  label: " System ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var USER_DETAILS_BOX = {
  label: " User ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%",
  left: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var CPU_DETAILS_BOX = {
  label: " CPU(s) ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%",
  left: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var ENV_DETAILS_BOX = {
  label: " Environment Variables ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  tags: true,
  padding: {
    left: 1,
    right: 1
  },
  scrollable: true,
  scrollbar: {
    style: {
      fg: "white",
      inverse: true
    },
    track: {
      ch: ":",
      fg: "cyan"
    }
  },
  keys: true,
  input: true
};

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
 * Provide details for the Node box.
 *
 * @returns {Object[]}
 * The array of label/data datapoints is returned.
 */
var getNodeDetails = function () {
  return [
    {
      label: "Version",
      data: process.version
    }, {
      label: "LTS",
      data: process.release.lts
    }, {
      label: "Uptime",
      data: utils.getTimeIndexLabel(
        utils.convertElapsedTimeToTimeIndex(
          process.uptime() * MILLISECONDS_PER_SECOND))
    }
  ];
};

/**
 * Provide details for the System box.
 *
 * @returns {Object[]}
 * The array of label/data datapoints is returned.
 */
var getSystemDetails = function () {
  return [
    {
      label: "Architecture",
      data: os.arch()
    }, {
      label: "Endianness",
      data: os.endianness() === "BE" ? "Big Endian" : "Little Endian"
    }, {
      label: "Host Name",
      data: os.hostname()
    }, {
      label: "Total Memory",
      data: prettyBytes(os.totalmem())
    }, {
      label: "Platform",
      data: os.platform()
    }, {
      label: "Release",
      data: os.release()
    }, {
      label: "Type",
      data: os.type()
    }
  ];
};

/**
 * Provide details for the User box.
 *
 * @returns {Object[]}
 * The array of label/data datapoints is returned.
 */
var getUserDetails = function () {
  var userInfo = os.userInfo({ encoding: "utf8" });

  return [
    {
      label: "User Name",
      data: userInfo.username
    }, {
      label: "Home",
      data: userInfo.homedir
    }, {
      label: "User ID",
      data: userInfo.uid
    }, {
      label: "Group ID",
      data: userInfo.gid
    }, {
      label: "Shell",
      data: userInfo.shell
    }
  ];
};

/**
 * Provide details for the CPU box.
 *
 * @returns {Object[]}
 * The array of label/data datapoints is returned.
 */
var getCpuDetails = function () {
  var cpuInfo = os.cpus();

  return _.map(cpuInfo, function (info, index) {
    return {
      label: "[" + index + "]",
      data: info.model + " " + info.speed
    };
  });
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
    var top = 0;
    var maxTop = 0;

    var createBox = function (contentProvider, box, varyHeight) {
      var detailData = contentProvider();
      box.content = getBoxContent(detailData);

      box.top = top;
      box.parent = this.node;

      if (!varyHeight) {
        box.height = detailData.length + BOX_PADDING;
      }

      top += detailData.length + BOX_PADDING;

      return blessed.box(box);
    }.bind(this);

    var alignBottom = function (box, y) {
      if (box.position.top + box.position.height !== y) {
        box.height = y - box.position.top;
      }
    };

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

    this.nodeDetails = createBox(getNodeDetails, NODE_DETAILS_BOX);
    this.systemDetails = createBox(getSystemDetails, SYSTEM_DETAILS_BOX);
    maxTop = top;

    top = 0;
    this.userDetails = createBox(getUserDetails, USER_DETAILS_BOX);
    this.cpuDetails = createBox(getCpuDetails, CPU_DETAILS_BOX);

    top = Math.max(maxTop, top);

    alignBottom(this.systemDetails, top);
    alignBottom(this.cpuDetails, top);

    this.envDetails = createBox(getEnvDetails, ENV_DETAILS_BOX, true);
  }.bind(this);

  var constructView = function () {
    this.screen.saveFocus();

    options.parent.append(this.node);

    this.node.append(this.nodeDetails);
    this.node.append(this.systemDetails);
    this.node.append(this.userDetails);
    this.node.append(this.cpuDetails);
    this.node.append(this.envDetails);

    this.envDetails.focus();

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
        scroll = -this.envDetails.height;
        break;
      case "pagedown":
        scroll = +this.envDetails.height;
        break;
      case "home":
        this.envDetails.resetScroll();
        scroll = 0;
        break;
      case "end":
        this.envDetails.resetScroll();
        scroll = this.envDetails.getScrollHeight();
        break;
      }

      this.envDetails.scroll(scroll);
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

    this.envDetails.on("attach", function () {
      this.envDetails.key(
        ["w", "S-w", "s", "S-s", "pageup", "pagedown", "home", "end"],
        scrollDetails
      );
      this.envDetails.key(["f", "S-f", "C-f"], displayFilterEnvWindow);

      this.filterEnvDialogView.on("validated", filterEnvValidated);
      this.filterEnvDialogView.on("textChanged", filterEnvChanged);
    }.bind(this));

    this.envDetails.on("detach", function () {
      // stop listening to keys
      this.envDetails.unkey(
        ["w", "S-w", "s", "S-s", "pageup", "pagedown", "home", "end", "f", "S-f", "C-f"],
        scrollDetails
      );

      // and events
      this.filterEnvDialogView.removeAllListeners("validated");
      this.filterEnvDialogView.removeAllListeners("textChanged");
    }.bind(this));

    this.nodeDetails.on("attach", function () {
      // refresh the Node uptime metric periodically
      this.uptimeInterval = setInterval(function () {
        this.nodeDetails.setContent(getBoxContent(getNodeDetails()));
        this.screen.render();
      }.bind(this), UPTIME_INTERVAL_MS);
    }.bind(this));

    this.nodeDetails.on("detach", function () {
      if (this.uptimeInterval) {
        clearInterval(this.uptimeInterval);
        delete this.uptimeInterval;
      }
    }.bind(this));

    this.listenGlobalKeys([this.envDetails]);
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
  this.envDetails.removeLabel();
  if (after) {
    this.envDetails.setLabel(" Environment Variables (subsetted) ");
  } else {
    this.envDetails.setLabel(" Environment Variables ");
  }

  // the scroll must be reset or it can get out of sync with unequal content
  this.envDetails.resetScroll();
  this.envDetails.setContent(content);
};

module.exports = PlatformDetailsView;
