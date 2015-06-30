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
    'LocalForageModule'
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

    function signIn(user) {
      return $q.when(Restangular
        .all(options.sessionEndpoint)
        .customPOST({
          name: user.username,
          password: user.password
        }))
        .then(function(user) {
          return user.plain();
        })
        .then(setCurrentUser)
        .then(function(user) {
          return getSession()
                  .then(function(userMeta) {
                    return angular.extend(userMeta.plain(), user);
                  });
        })
        .then(setCurrentUser)
        .then(function(user) {
          if (!user || !user.ok) {
            $log.debug('couchdb:login:failure:unknown');
            return $q.reject(new Error());
          }
          eventBus.$broadcast('authenticationStateChange');
          $log.debug('couchdb:login:success', user);
          return decorateUser(user);
        })
        .catch(function(err) {
          if (err.status === 401) {
            $log.debug('couchdb:login:failure:invalid-credentials', err);
            return $q.reject(new Error('Invalid Credentials'));
          } else {
            $log.debug('couchdb:login:failure:unknown', err);
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
      return clearLocalUser().then(function() {
        eventBus.$broadcast('authenticationStateChange');
        return true;
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

      if (config.email && config.callbackUrl) {
        return $q.when(Restangular
                       .all('reset-password')
                       .customPOST({
                         email: config.email,
                         callbackUrl: config.callbackUrl
                       }));
      } else {
        return $q.reject('You must provide both email and callbackUrl ' +
                         'properties in the payload');
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
          $log.debug(err);
          return $q.reject(err);
        });
    }

    function setCurrentUser(user) {
      if (user) {
        currentUser =  user;
        return setLocalUser(user);
      }

      $q.reject('No user found');
    }

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
      trigger: eventBus.$broadcast.bind(eventBus),
      isAuthenticated: function() {
        if (!currentUser) {
          return $q.reject();
        }

        return getSession();
      }
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
          if (user && !user.hasRole(roles)) {
            ehaCouchDbAuthService.trigger('unauthorized');
            return $q.reject('unauthorized');
          }
          return user;
        })
        .catch(function(err) {
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
