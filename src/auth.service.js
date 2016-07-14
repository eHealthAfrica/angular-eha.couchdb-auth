;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name ehaUmsService
   * @module eha.ums-auth
   */
  var ngModule = angular
  .module('eha.ums-auth.auth.service', ['restangular']);

  function UmsAuthService(options, Restangular, $log, $q, $rootScope) {

    var SESSION_URL = options.url + '/' + options.sessionEndpoint;
    var COOKIE_NAME = options.sessionCookieName;
    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

    /*
     * Fetch the session endpoint and check if the response contains .userCtx (former couchdb user document data).
     */
    function getSession() {
      return $q.when(Restangular
        .oneUrl('session', SESSION_URL)
        .get())
        .then(function(session) {
          if (session.userCtx) {
            return session;
          } else {
            $q.reject('Session not found');
        }
        });
    }

    /*
     * Delete the session cookie and broadcast that the authentication state has changed.
     */
    function signOut() {
      console.log('angular-eha.ums-auth: deleting vanSession cookie');
      document.cookie = COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      eventBus.$broadcast('authenticationStateChange');
    }

    /*
     * Attach the methods .hasRole and .isAdmin to the user object.
     */
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

      //console.log('user after decoration=', user);
      //console.log('isAdmin=', user.isAdmin());
      return user;
    }

    function hasSessionCookie() {
      var regex = new RegExp(COOKIE_NAME + '=.+');
      return regex.test(document.cookie);
    }

    function getCurrentUser() {
      //console.log('angular-eha.ums-auth getCurrentUser called');
      if (currentUser) {
        console.log('angular-eha.ums-auth: getCurrentUser: currentUser found:', currentUser.name);
        return $q.when(decorateUser(currentUser));
        // If $q.when() is passed a non-promise object, it is effectively the same as creating an immediately resolved promise object
      } else if (hasSessionCookie()) {
        console.log('angular-eha.ums-auth: getCurrentUser: currentUser not found, but we have a session cookie.');
        var sessionUrl = options.url + '/' + options.sessionEndpoint;
        return $q.when(Restangular
          .oneUrl('session', sessionUrl)
          .get())
          .then(function(session) {
            //console.log('getCurrentUser: session=', session);
            var user = session.userCtx;
            if (user) {
              currentUser = user;
              return decorateUser(user);
            } else {
              $q.reject('Session not found');
            }
          });
      } else {
        console.error('angular-eha.ums-auth: We do not have a session cookie');
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
  function ehaUmsAuthService() {

    var options = {
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

    this.$get = function(Restangular, $log, $q, $rootScope) {

      var restangular = Restangular.withConfig(
        function(RestangularConfigurer) {
          RestangularConfigurer.setBaseUrl(options.url);
          if (options.defaultHttpFields) {
            RestangularConfigurer
              .setDefaultHttpFields(options.defaultHttpFields);
          }
        }
      );

      return new UmsAuthService(options, restangular, $log, $q, $rootScope);
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
