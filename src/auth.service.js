(function() {
  'use strict';

  var ngModule = angular
  .module('eha.couchdb-auth.auth.service', [
    'restangular',
    'LocalForageModule'
  ]);

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
      var sessionUrl = options.url + '/' + options.sessionEndpoint;
      return $q.when(Restangular
                      .oneUrl('session', sessionUrl)
                      .get())
                      .then(function(session) {
                        if (session.userCtx) {
                          return session;
                        } else {
                          $q.reject('Session not found');
                        }
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
      user.hasRole = function(role) {
        var self = this;
        if (angular.isArray(role)) {
          var matches = role.filter(function(r) {
            return self.roles.indexOf(r) > -1;
          });
          return !!matches.length;
        } else if (angular.isString(role)) {
          return this.roles.indexOf(role) > -1;
        }
      };

      user.isAdmin = function() {
        return this.hasRole(options.adminRoles);
      };
      return user;
    }

    function getCurrentUser() {

      if (currentUser) {
        return $q.when(currentUser);
      } else {
        return getSession()
          .then(function(user) {
            currentUser = decorateUser(user);
          })
          .catch(function(err) {
            $log.debug(err);
            return $q.reject(err);
          });
      }
    }

    function goToExternal(route) {
      return function() {
        $window.location = route;
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
      return ehaCouchDbAuthService.getCurrentUser()
                .then(function(user) {
                  return user;
                })
                .catch(function(err) {
                  ehaCouchDbAuthService.trigger('unauthenticated');
                  return $q.reject('unauthenticated');
                });
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaCouchDbAuthService, $q) {
        return requireUserWithRoles(ehaCouchDbAuthService, $q, roles);
      };
    };

    this.$get = function(Restangular, $log, $q, $localForage, $rootScope) {

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
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
