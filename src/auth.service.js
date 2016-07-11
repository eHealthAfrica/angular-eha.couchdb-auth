;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name ehaUmsService
   * @module eha.ums-auth
   */
  var ngModule = angular
  .module('eha.ums-auth.auth.service', [
    'restangular',
    'LocalForageModule'
  ]);

  function UmsAuthService(options, Restangular, $log, $q, $localForage, $rootScope) {

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

    function clearLocalUser() {
      currentUser = null;
      return $localForage.removeItem('user');
    }

    function setLocalUser(user) {
      return $localForage.setItem('user', user);
    }

    function getLocalUser() {
      var user = $localForage.getItem('user');
      console.log('angular-eha.ums-auth getLocalUser user=', user);
      return user;
    }

    function signOut() {
      return clearLocalUser().then(function() {
        // TODO: also delete casSession cookie!
        // document.cookie = 'casSession=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        eventBus.$broadcast('authenticationStateChange');
        return true;
      });
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
        return true;
        // return this.hasRole(options.adminRoles);
      };

      console.log('user after decoration=', user);
      console.log('isAdmin=', user.isAdmin());
      return user;
    }

    function hasUmsSessionCookie() {
      var regex = new RegExp('casSession=.+');
      return regex.test(document.cookie);
    }

    function getCurrentUser() {
      console.log('angular-eha.ums-auth getCurrentUser called');
      if (currentUser) {
        return $q.when(decorateUser(currentUser));
      } else if (hasUmsSessionCookie()) {
        var sessionUrl = options.url + '/' + options.sessionEndpoint;
        return $q.when(Restangular
          .oneUrl('session', sessionUrl)
          .get())
          .then(function(session) {
            console.log('getCurrentUser: session=', session);
            var user = session.userCtx;
            if (user) {
              currentUser = user;
              setLocalUser(user);
              return decorateUser(user);
            } else {
              $q.reject('Session not found');
            }
          });
      } else {
        console.error('angular-eha.ums-auth: We have neither a session cookie nor a user in localForage.');
      }
    }

    /*
    function getCurrentUser() {
      console.log('angular-eha.ums-auth getCurrentUser called');
      if (currentUser) {
        return $q.when(decorateUser(currentUser));
      }

      return getLocalUser()
        .then(function(user) {
          if (user) {
            currentUser = user;
            return decorateUser(user);
          } else {
            // TODO: get session
            return getSession();
            //return $q.reject('User not found');
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
    */

    return {
      signOut: signOut,
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

  ngModule.provider('ehaUmsAuthService',
  function ehaUmsAuthService($localForageProvider) {

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

    function requireUserWithRoles(ehaUmsAuthService, $q, roles) {
      return ehaUmsAuthService.getCurrentUser()
        .then(function(user) {
          if (user && !user.isAdmin() && !user.hasRole(roles)) {
            ehaUmsAuthService.trigger('unauthorized');
            return $q.reject('unauthorized');
          }
          return user;
        })
        .catch(function(err) {
          if (err === 'unauthorized') {
            throw err;
          }
          ehaUmsAuthService.trigger('unauthenticated');
          return $q.reject('unauthenticated');
        });
    }

    this.config = function(config) {
      options = angular.extend(options, config);

      $localForageProvider.config({
        name: options.localStorageNamespace,
        storeName: options.localStorageStoreName
      });

      if (config.userRoles) {
        config.userRoles.forEach(function(role) {
          var functionName = 'require' + camelCase(role) + 'User';
          this[functionName] = function(ehaUmsAuthService, $q) {
            return requireUserWithRoles(ehaUmsAuthService, $q, [role]);
          };
        }.bind(this));
      }
    };

    this.requireAdminUser = function(ehaUmsAuthService, $q) {
      return requireUserWithRoles(
        ehaUmsAuthService, $q, options.adminRoles);
    };

    this.requireAuthenticatedUser = function(ehaUmsAuthService, $q) {
      return ehaUmsAuthService.getCurrentUser()
        .then(function(user) {
          return user;
        })
        .catch(function(err) {
          ehaUmsAuthService.trigger('unauthenticated');
          return $q.reject('unauthenticated');
        });
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaUmsAuthService, $q) {
        return requireUserWithRoles(ehaUmsAuthService, $q, roles);
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

      return new UmsAuthService(options, restangular, $log, $q, $localForage, $rootScope);
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
