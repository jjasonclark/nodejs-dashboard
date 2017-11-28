/* eslint-disable no-magic-numbers */

"use strict";

var expect = require("chai").expect;
var sinon = require("sinon");

var SocketIO = require("socket.io");
var config = require("../../lib/config");
var dashboardAgent = require("../../lib/dashboard-agent");
var pusage = require("pidusage");
var tryCatch = require("../utils").tryCatch;

describe("dashboard-agent", function () {

  var sandbox;
  var server;
  var agent;
  var options = {
    port: 12345,
    refreshInterval: 10,
    blockedThreshold: 1
  };

  describe("initialization", function () {

    before(function () {
      sandbox = sinon.sandbox.create();
    });

    beforeEach(function () {
      server = new SocketIO(options.port);
    });

    afterEach(function (done) {
      agent.destroy();
      sandbox.restore();
      server.close(done);
    });

    it("should use environment variables for configuration", function (done) {
      process.env[config.PORT_KEY] = options.port;
      process.env[config.BLOCKED_THRESHOLD_KEY] = options.blockedThreshold;
      process.env[config.REFRESH_INTERVAL_KEY] = options.refreshInterval;
      agent = dashboardAgent();

      var checkMetrics = function (metrics) {
        expect(metrics).to.be.an("object");
        expect(metrics.eventLoop.delay).to.be.a("number");
      };

      server.on("connection", function (socket) {
        try {
          expect(socket).to.be.an("object");
          socket.on("error", done);
        } catch (err) {
          done(err);
        }
        socket.on("metrics", function (data) {
          tryCatch(done, function () {
            socket.removeAllListeners("metrics");
            checkMetrics(JSON.parse(data));
          });
        });
      });
    });

    it("should use options for configuration", function (done) {
      agent = dashboardAgent(options);

      var checkMetrics = function (metrics) {
        expect(metrics).to.be.an("object");
        expect(metrics.eventLoop.delay).to.be.a("number");
      };

      server.on("connection", function (socket) {
        try {
          expect(socket).to.be.an("object");
          socket.on("error", done);
        } catch (err) {
          done(err);
        }
        socket.on("metrics", function (data) {
          tryCatch(done, function () {
            socket.removeAllListeners("metrics");
            checkMetrics(JSON.parse(data));
          });
        });
      });
    });

    it("should prefer options over environment for configuration", function (done) {
      process.env[config.PORT_KEY] = options.port + 1;
      process.env[config.BLOCKED_THRESHOLD_KEY] = options.blockedThreshold + 10;
      process.env[config.REFRESH_INTERVAL_KEY] = options.refreshInterval + 10;
      agent = dashboardAgent(options);

      var checkMetrics = function (metrics) {
        expect(metrics).to.be.an("object");
        expect(metrics.eventLoop.delay).to.be.a("number");
      };

      // will not connect if port from env is used
      server.on("connection", function (socket) {
        try {
          expect(socket).to.be.an("object");
          socket.on("error", done);
        } catch (err) {
          done(err);
        }
        socket.on("metrics", function (data) {
          tryCatch(done, function () {
            socket.removeAllListeners("metrics");
            checkMetrics(JSON.parse(data));
          });
        });
      });
    });
  });

  describe("reporting", function () {

    before(function () {
      sandbox = sinon.sandbox.create();
    });

    beforeEach(function () {
      agent = dashboardAgent(options);
      server = new SocketIO(options.port);
    });

    afterEach(function (done) {
      agent.destroy();
      sandbox.restore();
      server.close(done);
    });

    it("should provide basic metrics", function (done) {

      var checkMetrics = function (metrics) {
        expect(metrics).to.be.an("object");
        expect(metrics.eventLoop.delay).to.be.a("number");
        expect(metrics.eventLoop.high).to.be.a("number");
        expect(metrics.mem.systemTotal).to.equal(20);
        expect(metrics.mem.rss).to.equal(30);
        expect(metrics.mem.heapTotal).to.equal(40);
        expect(metrics.mem.heapUsed).to.equal(50);
        expect(metrics.cpu.utilization).to.equal(60);
      };

      sandbox.stub(process, "memoryUsage", function () {
        return {
          systemTotal: 20,
          rss: 30,
          heapTotal: 40,
          heapUsed: 50
        };
      });

      sandbox.stub(pusage, "stat", function (processId, callback) {
        expect(processId).to.equal(process.pid);
        expect(callback).to.be.a("function");

        callback(null, { cpu: 60 });
      });

      agent._getStats(function (err, metrics) {
        tryCatch(done, function () {
          expect(err).to.be.null;
          checkMetrics(metrics);
        });
      });
    });

    it("should report an event loop delay and cpu stats", function (done) {
      var delay = { current: 100, max: 150 };
      var pusageResults = { cpu: 50 };
      sandbox.stub(pusage, "stat").yields(null, pusageResults);

      agent._delayed(delay.max);
      agent._delayed(delay.current);

      var checkMetrics = function (metrics) {
        expect(metrics.eventLoop.delay).to.equal(delay.current);
        expect(metrics.eventLoop.high).to.equal(delay.max);
        expect(metrics.cpu.utilization).to.equal(pusageResults.cpu);
      };

      agent._getStats(function (err, metrics) {
        tryCatch(done, function () {
          expect(err).to.be.null;
          checkMetrics(metrics);
        });
      });
    });

    it("should return an error when pusage fails", function (done) {
      sandbox.stub(pusage, "stat").yields(new Error("bad error"));

      agent._getStats(function (err, metrics) {
        tryCatch(done, function () {
          expect(err).to.exist;
          expect(metrics).to.be.undefined;
          expect(err.message).to.equal("bad error");
        });
      });
    });
  });
});
