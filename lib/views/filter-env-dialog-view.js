"use strict";

var BaseInputDialogView = require("./base-input-dialog-view");

/**
 * This is the constructor for the FilterEnvDialogView.
 *
 * @param {Object} options
 * Options that may be specified.
 *
 * @returns {void}
 */
var FilterEnvDialogView = function FilterEnvDialogView(options) {
  // super()
  BaseInputDialogView.call(this, options);
};

// inheritance
FilterEnvDialogView.prototype = Object.create(BaseInputDialogView.prototype);

/**
 * Get the instructions label for the view.
 *
 * @returns {String}
 * The instructions label is returned.
 */
FilterEnvDialogView.prototype.getInstructionsLabel = function () {
  return "Enter text to filter env variables (empty for all)";
};

module.exports = FilterEnvDialogView;
