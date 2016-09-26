(function() {
  'use strict';

  // i had to debug this code while a minified version was served. I
  // could not use the debugger so i had to use extensive
  // logging. It's probably a good idea to eventually remove most of
  // the logging commands on the happy path, while log messages could
  // be kept in the error branches
  var log = console.log;

  var ngModule = angular
  .module('eha.couchdb-auth.auth.service', [
    'restangular',
    'LocalForageModule',
    'ng' // for `$window`
  ]);

  var weAreRunningUnitTests = false;

  // this way of passing dependencies twice is tedious and
  // error prone, and i am not sure about the advantages of doing
  // so. I would say that it would be better to refactor and eliminate
  // this duplication -- 2016-09-27 francesco
  function CouchDbAuthService(options,
                              Restangular,
                              $log,
                              $q,
                              $localForage,
                              $rootScope,
                              $window) {

    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

    function getSession() {
      log('getSession');
      var sessionUrl = options.sessionEndpoint;
      return $q
        .when(Restangular.oneUrl('session', sessionUrl).get())
        .then(function(response) {
          log('getSession then');
          var context = response.userCtx;
          if (context) {
            return decorateUser(context);
          } else {
            $q.reject('User context not found in the session response');
          }
        })
        .catch(function(e) {
          $log.log('error in getSession:', e);
          return $q.reject(e);
        });
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
      log('decorating user', user);
      user.hasRole = function(role) {
        if (angular.isArray(role)) {
          var matches = role.filter(function(r) {
            return user.roles.indexOf(r) > -1;
          });
          return !!matches.length;
        } else if (angular.isString(role)) {
          return user.roles.indexOf(role) > -1;
        }
      };
      user.isAdmin = function() {
        return user.hasRole(options.adminRoles);
      };
      return user;
    }

    function getCurrentUser() {
      log('getCurrentUser');
      if (currentUser) {
        log('available');
        return $q.when(currentUser);
      } else {
        log('getting session');
        return getSession()
          .then(function(user) {
            currentUser = user;
            return currentUser;
          })
          .catch(function(e) {
            log('error in `getCurrentUser` in the Couch auth service:', e);
            ehaCouchDbAuthService.trigger('unauthenticated');
            return $q.reject(e);
          });
      }
    }

    function goToExternal(route) {
      return function() {
        if (weAreRunningUnitTests) {
          return;
        } else {
          $window.location.assign(route);
        }
      };
    }

    return {
      accounts: {
        add: addAccount,
        update: updateAccount,
        remove: removeAccount
      },
      getSession: getSession,
      getCurrentUser: getCurrentUser,
      on: eventBus.$on.bind(eventBus),
      trigger: eventBus.$broadcast.bind(eventBus),
      isAuthenticated: function() {
        if (!currentUser) {
          return $q.reject();
        }

        return getSession();
      },
      logIn: goToExternal('/login'),
      logOut: goToExternal('/logout')
    };
  }

  ngModule.provider('ehaCouchDbAuthService',
  function ehaCouchDbAuthService($localForageProvider,
                                 ehaCouchDbAuthHttpInterceptorProvider,
                                 $httpProvider) {

    var options = {
      localStorageNamespace: 'eha',
      localStorageStoreName: 'auth',
      adminRoles: ['_admin'],
      sessionEndpoint: '_session'
    };

    function capitalizeFirstLetter(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function camelCase(string) {
      var words = [string];
      if (string.indexOf('-') > -1) {
        words = string.split('-');
      } else if (string.indexOf('_') > -1) {
        words = string.split('_');
      }
      words = words.map(capitalizeFirstLetter);
      return words.join('');
    }

    function requireUserWithRoles(ehaCouchDbAuthService, $q, roles) {
      return ehaCouchDbAuthService.getCurrentUser()
        .then(function(user) {
          if (user && !user.isAdmin() && !user.hasRole(roles)) {
            ehaCouchDbAuthService.trigger('unauthorized');
            return $q.reject('unauthorized');
          }
          return user;
        })
        .catch(function(err) {
          if (err === 'unauthorized') {
            throw err;
          }
          ehaCouchDbAuthService.trigger('unauthenticated');
          return $q.reject('unauthenticated');
        });
    }

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

      if (config.userRoles) {
        config.userRoles.forEach(function(role) {
          var functionName = 'require' + camelCase(role) + 'User';
          this[functionName] = function(ehaCouchDbAuthService, $q) {
            return requireUserWithRoles(ehaCouchDbAuthService, $q, [role]);
          };
        }.bind(this));
      }
    };

    this.requireAdminUser = function(ehaCouchDbAuthService, $q) {
      return requireUserWithRoles(
        ehaCouchDbAuthService, $q, options.adminRoles);
    };

    this.requireAuthenticatedUser = function(ehaCouchDbAuthService, $q) {
      console.log('requireAuthenticatedUser');
      return ehaCouchDbAuthService.getCurrentUser()
                .then(function(user) {
                  console.log('requireAuthenticatedUser returns successfully');
                  return user;
                })
                .catch(function(err) {
                  console.log('requireAuthenticatedUser unauthenticated');
                  ehaCouchDbAuthService.trigger('unauthenticated');
                  return $q.reject('unauthenticated');
                });
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaCouchDbAuthService, $q) {
        return requireUserWithRoles(ehaCouchDbAuthService, $q, roles);
      };
    };

    this.weAreRunningUnitTests = function() {
      weAreRunningUnitTests = true;
    };

    this.$get = function(
      Restangular,
      $log,
      $q,
      $localForage,
      $rootScope,
      $window
    ) {

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
                                    $rootScope,
                                    $window);
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
