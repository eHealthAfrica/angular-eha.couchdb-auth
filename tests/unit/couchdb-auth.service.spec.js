/*jshint expr: true*/
describe('eha.couchdb-auth.service', function() {
  'use strict';

  var service;

  beforeEach(module('eha.couchdb-auth.service'));
  beforeEach(inject(function(_ehaCouchdbAuthService_) {
    service = _ehaCouchdbAuthService_;
  }));

  describe('Public API', function() {
    it('signIn() should be defined', function() {
      expect(service.signIn).to.be.defined;
    });
    it('signOut() should be defined', function() {
      expect(service.signOut).to.be.defined;
    });
    it('resetPassword() should be defined', function() {
      expect(service.resetPassword()).to.be.defined;
    });
  });

});
