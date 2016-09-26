# angular-eha.couchdb-auth

[![Build Status](https://travis-ci.org/eHealthAfrica/angular-eha.couchdb-auth.svg?&branch=master)](https://travis-ci.org/eHealthAfrica/angular-eha.couchdb-auth)

A simple Angular.js CouchDB auth interface.  Works great directly with a CouchDB instance, works even better with a [CouchDB proxy/wrapper API](https://github.com/eHealthAfrica/hapi-couchdb-auth-bearer-plugin).

## Installation

Install with npm:

    npm install --save angular-eha.couchdb-auth

Or alternatively bower:

    bower install --save angular-eha.couchdb-auth

## Usage

If you're using wiredep, then all you need to do is add `eha.couchdb-auth` as an angular module dependency somewhere sensible in your app. In the absense of wiredep, you'll need to manually bundle `dist/couchdb-auth.js`.

### Configuration

The module can be configured through the `ehaCouchDbAuthServiceProvider` via a `config` block:

```javascript
app.config(function(ehaCouchDbAuthServiceProvider) {
  ehaCouchDbAuthServiceProvider.config({
    url: 'http://mycouchdb.com',            // CouchDB/Proxy URL exposing _session endpoints
    localStorageNamespace: 'mnutrition',    // Namespace for localstorage (default: lf)
    adminRoles: ['admin'],                  // 'Admin' CouchDB role. (default: `['_admin']`)
    userRoles: ['data_provider', 'analyst'],// Roles other than admin roles
    sessionEndpoint: '_session',            // Configurable session endpoint (default: `'_session'`)
    interceptor: {                          // Enable HTTP Interceptor (default: false)
      hosts: [                              // Configure hostnames that should be intercepted
        'http://mycouchdb.com'
      ]
    },
    defaultHttpFields: {                    // Passed through to Angular's $http config (default: unset)
      withCredentials: true                 // See: https://docs.angularjs.org/api/ng/service/$http#usage
    }
  });
});
```

_Note_: `userRoles` can be camelcase, or hyphenized strings (with '_' or '-' but not with both).

Configuring an interceptor will internally add an `$http` interceptor,
which will automatically add the bearer token to outcoming requests,
and handle authentication errors (code 401) in the responses. You can
react to intercepted errors using the `.on` method, see
[below](#onevent-handler). The interceptor will act on communications
with locations matching one of the values in `hosts`.

### ehaCouchDbAuthService

#### `signIn(params)`

_Promise/A+_ Attempt to create a new CouchDB session with given credentials.

##### Params

- **username** - CouchDB user `name`
- **password** - CouchDB user `password`

#### `signOut()`

_Promise/A+_ Attempt to destroy a CouchDB sessions and reset local authenitcation status.

####  `resetPassword(params)`

_Promise/A+_ Password reset features. Typical pattern; request reset token by email, follow link, change password.

**n.b. CouchDB does not provide this functionality. To leverage this functionality you require a compatible 'backend'**

##### Params

- **email** - Email address of account for which you wish to reset the password
- **callbackUrl** - The URL that the `resetToken` should be appended to in order to complete the flow
- **token** - A valid `resetToken`
- **password** - The new password

##### Reset token flow

Calling `resetPassword()` with `email` and `callbackUrl` parameters will initiate the password reset token request flow.

##### Change password flow

Calling `resetPassword()` with a valid `token` and a new `password` will initiate the change password flow.

#### `getSession()`

_Promise/A+_ Makes a GET request to the `_session/` endpoint of the CouchDB url provided during configuration. _Returns a promise._


#### `getUserFromSession()`

Intended to be used with a couchdb proxy auth setup.

_Promise/A+_ Makes a GET request to the `_session/` endpoint of the CouchDB url provided during configuration. _Returns a promise._
If session is returned, the user will be persisted.

#### `getCurrentUser()`

_Promise/A+_ Checks the local environment for a user, failing that checks local storage and finally attempts to GET the `_session/` endpoint of the CouchDB url.

_Returns a promise_

#### `on(EVENT, handler)`

Event subscription handler

- *EVENT* _string_ the name of the event you wish to handle
- *handler* _function_ the event handler

##### Supported events:

- `unauthenticated` - fired whenever an unauthenticated user / session attempts to access a resource that requires authentication.
- `unauthorized` - fired whenever the current user / session is unauthorised to access a resource

### ehaCouchDBAuthServiceProvider

The provider exposes some functions suitable to be used as values for
the `resolve` option of the `when` method of the `$routeProvider`, or
as values for analogous options passed to the Angular UI router. Check
[Angular's
documentation](https://docs.angularjs.org/api/ngRoute/provider/$routeProvider)
for more information. Note that `requireAdminUser`,
`requireAuthenticatedUser` and `requireUserWithRoles` are designed to work this way, and need to
have their arguments injected by `$routeProvider`, so use them for
example like this:

```js
var auth = ehaCouchDbAuthServiceProvider.requireAuthenticatedUser;
$routeProvider
  .when('/page', {
    templateUrl: 'views/page.html',
    controller: 'PageCtrl',
    resolve: auth
  })
  ...
```

#### `requireAdminUser`

_Promise/A+_ Check if the user is an admin (has one of the `adminRoles` provided in the config).

#### `require<role-name>User`

E.g. the function for the `data_provider` role will be `requireDataProviderUser`.

_Promise/A+_ Check if the user has a particular role.

_Note_: These functions are created dynamically during the configuration of the module. These can cause problems when using the function within `angular-ui-router` if the routes are loaded before configuring the module. This can be avoided by providing the configuration for the roles when initializing the routes:

```
  .config(function($stateProvider, ehaCouchDbAuthServiceProvider) {
    ehaCouchDbAuthServiceProvider.config({
      userRoles: [
        'data_provider',
        'analyst'
      ]
    });
    $stateProvider
    .state('upload', {
      url: '/upload',
      resolve: {
        isDataProvider: ehaCouchDbAuthServiceProvider.requireDataProviderUser
      },
      views: {
        ...
      }
    });
  }
```

#### `requireUserWithRoles`

_Promise/A+_ Check if the user is has a role in the given set.

Similar to [require<role-name>User](#requirerole-nameuser) but supports checking against multiple roles, for example:

```js
// Within a $stateProvider.state declaration
resolve: {
  authorization: ehaCouchDbAuthServiceProvider.requireUserWithRoles([
    'data_provider',
    'analyst'
  ])
}
```

#### `requireAuthenticatedUser`

_Promise/A+_ Check if the user is authenticated.

### `eha-show-authenticated` directive

A simple directive to hide dom elements and show only for authenticated sessions.

e.g:

```html
  <div eha-show-authenticated>Only show me for authenticated sessions</div>
```

### `eha-show-for-role` directive

A simple directive to hide/show dom elements for users depending on their access control (role) level.  Accepts either a single string or an array of strings.

e.g:

```html
  <!-- single string. must be an expression. n.b. `'`s are required -->
  <div eha-show-for-role="'admin'"></div>

  <!-- an array of strings -->
  <div eha-show-for-role="['role1', 'role2']"></div>
```

## License

Copyright 2015 Matt Richards <matt.richards@ehealthnigeria.org>

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the License for the specific language governing permissions and limitations under the License.
