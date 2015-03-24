;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name EhaCouchDbAuthHttpInterceptor
   * @module eha.couchdb-auth.http-interceptor
   */
  var ngModule = angular.module('eha.couchdb-auth.http-interceptor', []);

  function EhaCouchDbAuthHttpInterceptor(options, $injector) {

    function hostMatch(url) {
      var hostMatches = options.hosts.filter(function(host) {
        return url.indexOf(host) > -1;
      });
      return !!hostMatches.length;
    }

    var $q = $injector.get('$q');
    var $log = $injector.get('$log');

    return {
      request: function(request) {
        if (hostMatch(request.url)) {
          // Grab the service this way to avoid a circular dependency
          var auth = $injector.get('ehaCouchDbAuthService');
          // Try to get current user
          return auth.getCurrentUser()
            .then(function(user) {
              if (user && user.bearerToken) {
                // If user and user.bearerToken are found configure the
                // Authorization header for this call appropriately
                request.headers.Authorization = 'Bearer ' + user.bearerToken;
              }
              return request;
            })
            .catch(function(err) {
              $log.error(err);
              // If we don't find a user then just allow the request to pass
              // through un modified
              return request;
            });
        }
        return $q.when(request);
      },
      responseError: function(rejection) {
        // Check for 401 and hostMatch
        if (rejection.status === 401 && hostMatch(rejection.config.url)) {
          var auth = $injector.get('ehaCouchDbAuthService');
          auth.trigger('unauthorized');
        }
        return $q.reject(rejection);
      }
    };
  }

  ngModule.provider('ehaCouchDbAuthHttpInterceptor', function() {
    var options = {};
    this.config = function(config) {
      options = config;
    };

    this.$get = function($injector) {
      return new EhaCouchDbAuthHttpInterceptor(options, $injector);
    };
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
