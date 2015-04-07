;(function() {
  'use strict';
  var ngModule = angular.module('eha.couchdb-auth', [
    'eha.couchdb-auth.http-interceptor',
    'eha.couchdb-auth.auth.service',
    'eha.couchdb-auth.show-for-role.directive',
    'eha.couchdb-auth.show-authenticated.directive'
  ]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
