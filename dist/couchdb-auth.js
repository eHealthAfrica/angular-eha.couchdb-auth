;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name ehaCouchDbService
   * @module eha.couchdb-auth
   */
  var ngModule = angular
  .module('eha.couchdb-auth.auth.service', [
    'restangular',
    'LocalForageModule',
    'ngCookies'
  ]);

  function CouchDbAuthService(options,
                              Restangular,
                              $log,
                              $q,
                              $localForage,
                              $rootScope) {

    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

    function getSession() {
      return $q.when(Restangular
                      .all('_session')
                      .customGET());
    }

    function signIn(user) {
      return $q.when(Restangular
        .all('_session')
        .customPOST({
          name: user.username,
          password: user.password
        }))
        .then(setCurrentUser)
        .then(function(user) {
          console.log('GOT USER');
          return getSession()
                  .then(function() {
                    return user;
                  });
        })
        .then(function(user) {
          if (!user || !user.ok) {
            $log.log('couchdb:login:failure:unknown');
            return $q.reject(new Error());
          }
          eventBus.$broadcast('authenticationStateChange');
          $log.log('couchdb:login:success', user);
          return user;
        })
        .catch(function(err) {
          if (err.status === 401) {
            $log.log('couchdb:login:failure:invalid-credentials', err);
            return $q.reject(new Error('Invalid Credentials'));
          } else {
            $log.log('couchdb:login:failure:unknown', err);
            return $q.reject(new Error(err));
          }
        });
    }

    function clearLocalUser() {
      currentUser = null;
      return $localForage.removeItem('user');
    }

    function setLocalUser(user) {
      return $localForage.setItem('user', user);
    }

    function getLocalUser() {
      return $localForage.getItem('user');
    }

    function signOut() {
      return $q.when(Restangular
        .all('_session')
        .remove())
        .then(clearLocalUser)
        .finally(function() {
          eventBus.$broadcast('authenticationStateChange');
        });
    }

    function resetPassword(config) {
      if (config.token && config.password) {
        return $q.when(Restangular
                       .all('reset-password')
                       .customPOST({
                         token: config.token,
                         password: config.password
                       }));
      }

      if (config.email) {
        return $q.when(Restangular
                       .all('reset-password')
                       .customPOST({
                         email: config.email,
                         callbackUrl: 'http://localhost:5000/#/reset-password'
                       }));
      }

    }

    function addAccount() {
      return $q.reject('NOT_IMPLEMENTED');
    }

    function updateAccount() {
      return $q.reject('NOT_IMPLEMENTED');
    }

    function removeAccount() {
      return $q.reject('NOT_IMPLEMENTED');
    }

    function decorateUser(user) {
      user.hasRole = function(role) {
        return this.roles.indexOf(role) > -1;
      };

      user.isAdmin = function() {
        return this.hasRole('_admin');
      };
      return user;
    }

    function getCurrentUser() {
      if (currentUser) {
        return $q.when(decorateUser(currentUser));
      }

      return getLocalUser()
        .then(function(user) {
          if (user) {
            currentUser = user;
            return decorateUser(user);
          } else {
            return $q.reject('User not found');
          }
        })
        .then(function(user) {
          return getSession()
            .then(function() {
              return user;
            });
        })
        .catch(function(err) {
          console.log(err);
          return $q.reject(err);
        });
    }

    function setCurrentUser(user) {
      if (user) {
        user = user.plain();
        currentUser = {
          name: user.name,
          roles: user.roles,
          bearerToken: user.bearerToken
        };
        return setLocalUser(user);
      }

      $q.reject('No user found');
    }

    eventBus.$on('unauthorized', function() {
      clearLocalUser();
    });

    return {
      signIn: signIn,
      signOut: signOut,
      resetPassword: resetPassword,
      accounts: {
        add: addAccount,
        update: updateAccount,
        remove: removeAccount
      },
      getSession: getSession,
      getCurrentUser: getCurrentUser,
      on: eventBus.$on.bind(eventBus),
      trigger: eventBus.$broadcast.bind(eventBus)
    };
  }

  ngModule.provider('ehaCouchDbAuthService',
  ['$localForageProvider', 'ehaCouchDbAuthHttpInterceptorProvider', '$httpProvider', function ehaCouchDbAuthService($localForageProvider,
                                 ehaCouchDbAuthHttpInterceptorProvider,
                                 $httpProvider) {

    var options = {
      localStorageNamespace: 'eha',
      localStorageStoreName: 'auth'
    };

    this.config = function(config) {
      options = angular.extend(options, config);
      $localForageProvider.config({
        name: options.localStorageNamespace,
        storeName: options.localStorageStoreName
      });

      if (config.interceptor) {
        ehaCouchDbAuthHttpInterceptorProvider.config({
          url: config.url,
          hosts: config.interceptor.hosts
        });
        $httpProvider.interceptors.push('ehaCouchDbAuthHttpInterceptor');
      }
    };

    this.requireAdminUser = function(ehaCouchDbAuthService, $q) {
      return ehaCouchDbAuthService.getCurrentUser()
        .then(function(user) {
          if (user && !user.isAdmin()) {
            ehaCouchDbAuthService.trigger('unauthorized');
            return $q.reject('unauthorized');
          }
          return user;
        })
        .catch(function(err) {
          ehaCouchDbAuthService.trigger('unauthenticated');
          return $q.reject('unauthenticated');
        });
    };

    this.requireAuthenticatedUser = function(ehaCouchDbAuthService, $q) {
      return ehaCouchDbAuthService.getCurrentUser()
                .then(function(user) {
                  return user;
                })
                .catch(function(err) {
                  ehaCouchDbAuthService.trigger('unauthenticated');
                  return $q.reject('unauthenticated');
                });
    };

    this.$get = ['Restangular', '$log', '$q', '$localForage', '$rootScope', function(Restangular, $log, $q, $localForage, $rootScope) {

      var restangular = Restangular.withConfig(
        function(RestangularConfigurer) {
          RestangularConfigurer.setBaseUrl(options.url);
          if (options.defaultHttpFields) {
            RestangularConfigurer
              .setDefaultHttpFields(options.defaultHttpFields);
          }
        }
      );

      return new CouchDbAuthService(options,
                                    restangular,
                                    $log,
                                    $q,
                                    $localForage,
                                    $rootScope);
    }];

  }]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

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

    this.$get = ['$injector', function($injector) {
      return new EhaCouchDbAuthHttpInterceptor(options, $injector);
    }];
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

;(function() {
  'use strict';
  var ngModule = angular.module('eha.couchdb-auth', [
    'eha.couchdb-auth.http-interceptor',
    'eha.couchdb-auth.auth.service',
    'eha.couchdb-auth.show-authenticated.directive'
  ]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

angular.module('eha.couchdb-auth.show-authenticated.directive', [])
  .directive('ehaShowAuthenticated', ['ehaCouchDbAuthService', '$animate', function(ehaCouchDbAuthService, $animate) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';
    return {
      restrict: 'A',
      link: function(scope, element) {
        // Hide by default
        element.addClass('ng-hide');

        function checkStatus() {
          ehaCouchDbAuthService.getCurrentUser()
            .then(function() {
              $animate.removeClass(element, NG_HIDE_CLASS, {
                tempClasses: NG_HIDE_IN_PROGRESS_CLASS
              });
            })
            .catch(function() {
              $animate.addClass(element, NG_HIDE_CLASS, {
                tempClasses: NG_HIDE_IN_PROGRESS_CLASS
              });
            });
        }

        checkStatus();

        ehaCouchDbAuthService.on('authenticationStateChange', checkStatus);
      }
    };
  }]);
