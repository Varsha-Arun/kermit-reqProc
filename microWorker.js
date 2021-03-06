'use strict';

var self = microWorker;
module.exports = self;

var Adapter = require('./_common/shippable/Adapter.js');

var exec = require('child_process').exec;

var cleanup = require('./_common/helpers/cleanup.js');
var executeStep = require('./execute/executeStep.js');

function microWorker(message) {
  var bag = {
    rawMessage: message,
    runDir: global.config.runDir,
    execTemplatesDir: global.config.execTemplatesDir,
    execTemplatesRootDir: global.config.execTemplatesRootDir
  };

  bag.who = util.format('%s|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _updateClusterNodeStatus.bind(null, bag),
      _cleanupRunDirectory.bind(null, bag),
      _executeStep.bind(null, bag),
      _cleanupRunDirectory.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to process message'));
      else
        logger.info(bag.who, util.format('Successfully processed message'));

      __restartContainer(bag);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  if (_.isEmpty(bag.rawMessage)) {
    logger.warn(util.format('%s, Message is empty.', who));
    return next(true);
  }

  if (!bag.rawMessage.builderApiToken) {
    logger.warn(util.format('%s, No builderApiToken present' +
      ' in incoming message', who));
    return next(true);
  }

  if (_.isEmpty(bag.rawMessage.stepIds)) {
    logger.warn(util.format('%s, Steps are empty in incoming message', who));
    return next(true);
  }

  bag.builderApiToken = bag.rawMessage.builderApiToken;
  bag.builderApiAdapter = new Adapter(bag.rawMessage.builderApiToken);
  bag.stepIds = bag.rawMessage.stepIds;
  return next();
}

function _updateClusterNodeStatus(bag, next) {
  var who = bag.who + '|' + _updateClusterNodeStatus.name;
  logger.verbose(who, 'Inside');

  var update = {
    statusCode: global.systemCodesByName['PROCESSING'].code,
    stepId: bag.stepIds[0]
  };

  bag.builderApiAdapter.putClusterNodeById(global.config.nodeId, update,
    function (err, clusterNode) {
      if (err) {
        logger.warn(util.format('%s, putClusterNodeById for nodeId %s failed ' +
          'with error: %s', bag.who, global.config.nodeId, err));
        return next(true);
      }

      return next();
    }
  );
}

function _cleanupRunDirectory(bag, next) {
  var who = bag.who + '|' + _cleanupRunDirectory.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    directory: bag.runDir
  };

  cleanup(innerBag,
    function (err) {
      if (err) {
        logger.warn(util.format('%s, run directory cleanup failed ' +
          'with error: %s', bag.who, err));
        return next(true);
      }
      return next();
    }
  );
}

function _executeStep(bag, next) {
  var who = bag.who + '|' + _executeStep.name;
  logger.verbose(who, 'Inside');

  var innerBag = {
    stepId: bag.stepIds[0],
    builderApiAdapter: bag.builderApiAdapter,
    runDir: bag.runDir,
    execTemplatesDir: bag.execTemplatesDir,
    execTemplatesRootDir: bag.execTemplatesRootDir,
    builderApiToken: bag.builderApiToken
  };

  executeStep(innerBag,
    function (err) {
      return next(err);
    }
  );
}

function __restartContainer(bag) {
  var who = bag.who + '|' + __restartContainer.name;
  logger.verbose(who, 'Inside');

  exec(util.format('docker restart -t=0 %s', config.reqProcContainerName),
    function (err) {
      if (err)
        logger.error(util.format('Failed to stop container with ' +
          'err:%s', err)
        );
    }
  );
}
