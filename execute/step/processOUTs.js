'use strict';

var self = processOUTs;
module.exports = self;

var handleDependency = require('./handlers/handleDependency.js');

function processOUTs(externalBag, callback) {
  var bag = {
    stepData: externalBag.stepData,
    stepOutDir: externalBag.stepOutDir,
    builderApiAdapter: externalBag.builderApiAdapter,
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _processOutSteps.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who,
          util.format('Failed to process OUT dependencies'));
      else
        logger.info(bag.who, 'Successfully processed OUT dependencies');

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'stepData',
    'stepOutDir',
    'builderApiAdapter',
    'stepConsoleAdapter'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors)
    logger.error(paramErrors.join('\n'));

  return next(hasErrors);
}

function _processOutSteps(bag, next) {
  var who = bag.who + '|' + _processOutSteps.name;
  logger.verbose(who, 'Inside');

  async.eachSeries(bag.stepData.resources,
    function (resource, nextResource) {
      var outDependency = {};
      if (resource.operation === 'OUT') {
        outDependency.name = resource.resourceName;
        outDependency.type =
          global.systemCodesByCode[resource.resourceTypeCode].name;
        outDependency.operation = resource.operation;
      }
      if (_.isEmpty(outDependency)) {
        return nextResource();
      }
      async.series([
          handleDependency.bind(null, bag, outDependency),
        ],
        function (err) {
          if (err)
            bag.stepConsoleAdapter.closeCmd(false);
          return nextResource(err);
        }
      );
    },
    function (err) {
      return next(err);
    }
  );
}
