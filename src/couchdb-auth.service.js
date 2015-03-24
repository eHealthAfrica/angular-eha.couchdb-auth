;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name ehaCouchdbAuthService
   * @module eha.couchdb-auth
   */
  var ngModule = angular
  .module('eha.couchdb-auth.service', []);

  ngModule.factory('ehaCouchdbAuthService', function() {

    function signIn() {

    }

    function signOut() {

    }

    function resetPassword() {

    }

    return {
      signIn: signIn,
      signOut: signOut,
      resetPassword: resetPassword
    };
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
