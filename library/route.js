import {
  both,
  complement,
  compose,
  cond,
  equals,
  identity,
  ifElse,
  match,
  path,
  prop,
  test
} from "https://deno.land/x/ramda@v0.27.2/mod.ts";
import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
import Request from "https://deno.land/x/functional_io@v1.1.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";

import { assertIsRegex } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";

const factorizeHandler = method => (pattern, naryFunction) =>
  [
    both(
      compose(equals(method), path([ 'headers', 'method' ])),
      compose(
        ifElse(_ => assertIsRegex(pattern), test(pattern), equals(pattern)),
        prop(1),
        match(/(^.*?)(?:\?.*){0,1}$/),
        path([ 'headers', 'url' ])
      )
    ),
    (request, options = {}) =>
      naryFunction.length === 2 ? naryFunction({ pattern, ...options }, request) : naryFunction(request)
  ]

// * :: a -> (Request -> Response) -> [ (Request -> boolean), (Request -> Response) ]
// * :: a -> ((Request, RegExp) -> Response) -> [ (Request -> boolean), (Request -> Response) ]
/**
 * ## Routing
 *
 * The main routing tool that comes bundled with this library is conveniently called `route`.
 * It takes a non-zero number of arguments which are defined by a pair of functions.
 * The first function of the pair is used to assert whether or not to execute the second function.
 * The assertion function takes a `Request` and return a `Boolean`, the handling function takes a `Request` and
 * must return a `Task` of a `Response`.
 *
 * ```js
 * import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
 * import { encodeText } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
 * import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
 * import { route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     [
 *       request => request.headers.method === 'GET',
 *       _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!")))
 *     ]
 *   );
 * );
 * ```
 *
 * ### Routing handlers
 *
 * Because the pattern is common, this library also offers a collection of handler that automatically creates
 * the assertion function. Each handler takes a `String` or a `RegExp` and a unary function.
 *
 * ```js
 * import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
 * import { encodeText } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
 * import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
 * import { handlers, route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     handlers.get('/', _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!"))))
 *   )
 * );
 * ```
 *
 * #### handlers`.delete`
 * `String|RegExp -> (Request -> Task Response) -> Task Response`
 *
 * This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
 * `Response`. The handler will apply the unary function to a HTTP requests that uses the `DELETE` method if the path
 * equals or match the first argument.
 *
 * ```js
 * import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer({ port: 8080 }, handlers.delete(/\/hoge\/(?<ID>[a-z]+)$/, handleDestroyHoge));
 * ```
 *
 * #### handlers`.get`
 * `String|RegExp -> (Request -> Task Response) -> Task Response`
 *
 * This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
 * `Response`. The handler will apply the unary function to a HTTP requests that uses the `GET` method if the path
 * equals or match the first argument.
 *
 * ```js
 * import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer({ port: 8080 }, handlers.get(/\/hoge\/(?<ID>[a-z]+)$/, handleRetrieveHoge));
 * ```
 *
 * #### handlers`.patch`
 * `String|RegExp -> (Request -> Task Response) -> Task Response`
 *
 * This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
 * `Response`. The handler will apply the unary function to a HTTP requests that uses the `PATCH` method if the path
 * equals or match the first argument.
 *
 * ```js
 * import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer({ port: 8080 }, handlers.patch(/\/hoge\/(?<ID>[a-z]+)$/, handleUpdateHoge));
 * ```
 *
 * #### handlers`.post`
 * `String|RegExp -> (Request -> Task Response) -> Task Response`
 *
 * This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
 * `Response`. The handler will apply the unary function to a HTTP requests that uses the `POST` method if the path
 * equals or match the first argument.
 *
 * ```js
 * import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer({ port: 8080 }, handlers.post('/hoge', handleCreateHoge));
 * ```
 *
 * #### handlers`.put`
 * `String|RegExp -> (Request -> Task Response) -> Task Response`
 *
 * This function takes a string or a regex and a unary function that takes a `Request` and return a task of a
 * `Response`. The handler will apply the unary function to a HTTP requests that uses the `PUT` method if the path
 * equals or match the first argument.
 *
 * ```js
 * import { handlers } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer({ port: 8080 }, handlers.put(/\/hoge\/(?<ID>[a-z]+)$/, handleUpdateHoge));
 * ```
 */
export const handlers = {
  delete: factorizeHandler('DELETE'),
  get: factorizeHandler('GET'),
  patch: factorizeHandler('PATCH'),
  post: factorizeHandler('POST'),
  put: factorizeHandler('PUT')
};


/**
 * #### `route`
 * `([ (Request -> Boolean), (Request -> Task Response) ],...) -> Task Response`
 *
 * This functions takes an arbitrary amount of array pairs of functions and return a task of a `Response`. The first
 * function of the pair is a predicate, it takes a `Request` and returns a `Boolean`. The second function of the pair
 * is a unary function that takes a `Request` and return a task of a `Response`; it will be executed only if the first
 * function returns `true`.
 *
 * ```js
 * import { route } from "https://deno.land/x/functional_http_server@v0.3.1/library/route.js";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     [
 *       request => request.headers.method === "POST" && request.headers.url === "/hoge",
 *       request => Task.of(Response.Created({}, encodeText("Created")))
 *     ]
 *   )
 * );
 * ```
 *
 * The handler can be easily composed using the spread operator.
 *
 * ```js
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     ...hogeRouteHandlers,
 *     ...piyoRouteHandlers,
 *     ...fugaRouteHandlers
 *   )
 * );
 * ```
 *
 * The handler will be short-circuited if it's not passed a `Request`. This makes it easy to write a
 * function to preflight a request.
 *
 * For example, if you needed to discard any request that doesn't accept `application/json`, you could
 * do the following.
 *
 * ```js
 * import { compose } from "https://deno.land/x/ramda@v0.27.2/mod.ts";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   compose(
 *     route(...routes),
 *     request => request.headers.accept !== 'application/json'
 *       ? Task.of(Response.BadRequest({}, new Uint8Array([])))
 *       : request
 *   )
 * );
 * ```
 */
export const route = (...routeList) => cond(
  [
    [
      complement(Request.is),
      identity
    ],
    ...routeList.map(([ assert, unaryFunction ]) => [ both(Request.is, assert), unaryFunction ]),
    [
      _ => true,
      _ => Task.of(Response.NotFound({}, new Uint8Array([])))
    ]
  ]
);
