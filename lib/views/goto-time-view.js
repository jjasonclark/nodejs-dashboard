"use strict";

var BaseInputDialogView = require("./base-input-dialog-view");

/**
 * This is the constructor for the Goto Time View.
 *
 * @param {Object} options
 * Options that may be specified.
 *
 * @returns {void}
 */
var GotoTimeView = function GotoTimeView(options) {
  // capture options
  this.metricsProvider = options.metricsProvider;

  // super()
  BaseInputDialogView.call(this, options);

  this.screen.on("metrics", function () {
    if (this.isVisible()) {
      // dynamically change the range as the underlying data grows
      this.instructionsLabel.setContent(this.getInstructionsLabel());
    }
  }.bind(this));

  this.node.on("show", function () {
    // when shown, ensure instructions are up-to-date
    this.instructionsLabel.setContent(this.getInstructionsLabel());
  }.bind(this));
};

// inheritancs
GotoTimeView.prototype = Object.create(BaseInputDialogView.prototype);

/**
 * Get the time range for the view.
 *
 * @returns {Object}
 * The time range is returned.
 */
GotoTimeView.prototype.getTimeRange = function () {
  var timeRange = this.metricsProvider.getAvailableTimeRange();

  return {
    min: timeRange.minTime.label,
    max: timeRange.maxTime.label
  };
};

/**
 * Get the time range label for the view.
 *
 * @returns {String}
 * The time range label is returned.
 */
GotoTimeView.prototype.getInstructionsLabel = function () {
  var timeRange = this.getTimeRange();

  return "Enter a time value between "
    + timeRange.min
    + " and "
    + timeRange.max;
};

/**
 * Validate the view input.
 *
 * @param {Object} data
 * The data entered in the view.
 *
 * @throws {Error}
 * Will throw if there is an error.
 *
 * @returns {Number}
 * The validated view input is returned.
 */
GotoTimeView.prototype.validate = function () {
  var timeValue = this.metricsProvider.validateTimeLabel(this.textBox.getContent());
  this.metricsProvider.gotoTimeValue(timeValue);

  // base()
  BaseInputDialogView.prototype.validate.call(this);
};

/**
 * Intercept the toggle action and see if it is appropriate to display.
 *
 * @returns {void}
 */
GotoTimeView.prototype.toggle = function () {
  var timeRange = this.getTimeRange();
  if (!timeRange.max || this.isVisible()) {
    return undefined;
  }

  // base()
  return BaseInputDialogView.prototype.toggle.call(this);
};

module.exports = GotoTimeView;
