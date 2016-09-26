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
    describe('signIn()', function() {
      var couchResSuccess;
      var couchResFail;
      it('should be defined', function() {
        expect(service.signIn).to.be.defined;
      });

      beforeEach(function() {
        couchResSuccess = {
          'ok':true,
          'userCtx': {
            'name':'test',
            'roles':[]
          },
          'info': {
            'authentication_db':'_users',
            'authentication_handlers':[
              'oauth',
              'cookie',
              'default'
            ],
            'authenticated':'cookie'
          },
          'authToken': 'AUTH_TOKEN'
        };

        couchResFail = {
          'data':{

          },
          'status':401,
          'config':{
            'method':'POST',
            'transformRequest':[
              null
            ],
            'transformResponse':[
              null
            ],
            'headers':{
              'Accept':'application/json, text/plain, */*',
              'Content-Type':'application/json;charset=utf-8'
            },
            'url':config.auth.api.url + '/_session',
            'data':{
              'name':'test',
              'password':'wrong'
            }
          },
          'statusText':''
        };
      });

      describe('valid credentials', function() {

        beforeEach(function() {
          $httpBackend
            .whenPOST(config.auth.api.url + '/_session', {
              name: 'test',
              password: 'test'
            })
            .respond(couchResSuccess);

          $httpBackend
            .whenGET(config.auth.api.url + '/_session')
            .respond(couchResSuccess);
        });

        afterEach(function() {
          $httpBackend.verifyNoOutstandingExpectation();
          $httpBackend.verifyNoOutstandingRequest();
        });

        it('should log in with valid credentials', function() {

          var login = service.signIn({
            username: 'test',
            password: 'test'
          });

          login.should.become({
            name: couchResSuccess.userCtx.name,
            roles: couchResSuccess.userCtx.roles,
          }).and.notify(function() {
            stopDigests(interval);
            done();
          });

          $httpBackend.flush();
        });
      });

      describe('invalid credentials', function() {
        beforeEach(function() {
          $httpBackend
            .whenPOST(config.auth.api.url + '/_session', {
              name: 'test',
              password: 'wrong'
            })
            .respond(401, couchResFail);
        });
        afterEach(function() {
          $httpBackend.verifyNoOutstandingExpectation();
          $httpBackend.verifyNoOutstandingRequest();
        });

        it('should not log in with invalid credentials', function() {
          service.signIn({
            username: 'test',
            password: 'wrong'
          }).should.be.rejectedWith('Invalid Credentials');
          $httpBackend.flush();
        });
      });

    });

    describe('getUserFromSession()', function() {
      var couchResSuccess;
      var couchResFail;
      it('should be defined', function() {
        expect(service.signIn).to.be.defined;
      });

      beforeEach(function() {
        couchResSuccess = {
          'ok':true,
          'userCtx': {
            'name':'test',
            'roles':[]
          },
          'info': {
            'authentication_db':'_users',
            'authentication_handlers':[
              'oauth',
              'cookie',
              'default'
            ],
            'authenticated':'cookie'
          },
          'authToken': 'AUTH_TOKEN'
        };

        couchResFail = {
          'data':{

          },
          'status':401,
          'config':{
            'method':'POST',
            'transformRequest':[
              null
            ],
            'transformResponse':[
              null
            ],
            'headers':{
              'Accept':'application/json, text/plain, */*',
              'Content-Type':'application/json;charset=utf-8'
            },
            'url':config.auth.api.url + '/_session',
            'data':{
              'name':'test',
              'password':'wrong'
            }
          },
          'statusText':''
        };
      });

      describe('valid credentials', function() {

        beforeEach(function() {
          $httpBackend
            .whenGET(config.auth.api.url + '/_session')
            .respond(couchResSuccess);
        });

        afterEach(function() {
          $httpBackend.verifyNoOutstandingExpectation();
          $httpBackend.verifyNoOutstandingRequest();
        });

        it('should log in with valid credentials', function() {

          var login = service.getUserFromSession();
          login.should.become({
            name: couchResSuccess.userCtx.name,
            roles: couchResSuccess.userCtx.roles,
          }).and.notify(function() {
            stopDigests(interval);
            done();
          });

          $httpBackend.flush();
        });
      });

      describe('invalid credentials', function() {
        beforeEach(function() {
          $httpBackend
            .whenPOST(config.auth.api.url + '/_session', {
              name: 'test',
              password: 'wrong'
            })
            .respond(401, couchResFail);
        });
        afterEach(function() {
          $httpBackend.verifyNoOutstandingExpectation();
          $httpBackend.verifyNoOutstandingRequest();
        });

        it('should not log in with invalid credentials', function() {
          service.signIn({
            username: 'test',
            password: 'wrong'
          }).should.be.rejectedWith('Invalid Credentials');
          $httpBackend.flush();
        });
      });

    });

    describe('signOut()', function() {

      var couchResSuccess;
      var couchResFail;

      beforeEach(function() {
        couchResSuccess = {
          ok: true
        };
        couchResFail = {};

      });

      it('should be defined', function() {
        expect(service.signOut).to.be.defined;
      });

      it('should log out', function(done) {
        triggerDigests();
        expect(service.signOut()).to.be.fulfilled.and.notify(function() {
          stopDigests();
          done();
        });
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
