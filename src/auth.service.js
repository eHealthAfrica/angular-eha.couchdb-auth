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
          name: user.name,
          password: user.password
        }))
        .then(setCurrentUser)
        .then(function(user) {
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
          console.log(user);

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
        .then(clearLocalUser);
    }

    function resetPassword() {
      return $q.reject('NOT_IMPLEMENTED');
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

    function getCurrentUser() {
      if (currentUser) {
        return $q.when(currentUser);
      }

      return getLocalUser()
        .then(function(user) {
          if (user) {
            currentUser = user;
            return user;
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
  function ehaCouchDbAuthService($localForageProvider,
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
