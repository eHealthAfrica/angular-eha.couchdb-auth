;(function() {

  var ngModule = angular.module('eha.couchdb-auth', [
    'eha.couchdb-auth.service'
  ]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
