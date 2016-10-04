/*jshint expr: true*/
/*global afterEach */
describe('eha.couchdb-auth.service', function() {
  'use strict';

  var service;
  var $timeout;
  var $httpBackend;
  var $rootScope;
  var $localForage;
  var $http;
  var instanceVersion = 0;
  var config;
  var $q;

  var triggerDigests = function() {
    return setInterval(function() {
      $rootScope.$digest();
    }, 10);
  };
  var stopDigests = function(interval) {
    window.clearInterval(interval);
  };

  beforeEach(module('eha.couchdb-auth',
    function(ehaCouchDbAuthServiceProvider, $provide) {
      config = {
        auth: {
          api: {
            url: 'http://localhost:5000'
          }
        }
      };
      ehaCouchDbAuthServiceProvider
        .config({
          url: config.auth.api.url,
          localStorageNamespace: 'mnutrition-app',
        });
    })
  );

  beforeEach(inject(function(ehaCouchDbAuthService,
                             _$timeout_,
                             _$httpBackend_,
                             _$rootScope_,
                             _$localForage_,
                             _$http_,
                             _$q_) {

    service = ehaCouchDbAuthService;
    $timeout = _$timeout_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    $localForage = _$localForage_;
    $http = _$http_;
    $q = _$q_;
  }));

  describe('Public API', function() {
    describe('logIn()', function() {
      it('should be defined', function() {
        expect(service.logIn).to.be.defined;
      });
    });
    describe('logOut()', function() {
      it('should be defined', function() {
        expect(service.logOut).to.be.defined;
      });
    });

    describe('getCurrentUser()', function() {
      var TEST_USER;

      it('should be defined', function() {
        expect(service.getCurrentUser).to.be.defined;
      });

      describe('no currentUser', function() {

        it('should getCurrentUser()', function() {
          $httpBackend.whenGET('http://localhost:5000/_session')
          .respond(true);
          service.getCurrentUser()
          .should.be.rejectedWith('User not found');
        });
      });

    });
    it('resetPassword() should be defined', function() {
      expect(service.resetPassword).to.be.defined;
    });

    it('accounts.add() should be defined', function() {
      expect(service.accounts.add).to.be.defined;
    });
    it('accounts.remove() should be defined', function() {
      expect(service.accounts.remove).to.be.defined;
    });
  });
});
