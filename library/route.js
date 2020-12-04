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
} from "https://x.nest.land/ramda@0.27.0/source/index.js";
import Task from "https://deno.land/x/functional@v1.2.1/library/Task.js";
import Request from "https://deno.land/x/functional_io@v1.0.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.0.0/library/Response.js";

import { assertIsRegex } from "https://deno.land/x/functional@v1.2.1/library/utilities.js";

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
 * import Task from "https://deno.land/x/functional@v1.2.1/library/Task.js";
 * import Response from "https://deno.land/x/functional_io@v1.0.0/library/Response.js";
 * import { route } from "./library/route.js";
 * import { encodeText } from "./library/utilities.js";
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
 * import Task from "https://deno.land/x/functional@v1.2.1/library/Task.js";
 * import Response from "https://deno.land/x/functional_io@v1.0.0/library/Response.js";
 * import { handlers, route } from "./library/route.js";
 * import { encodeText } from "./library/utilities.js";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     handlers.get('/', _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!"))))
 *   );
 * );
 * ```
 *
 * #### Routing with the `explodeRequest` utility
 *
 * The function `explodeRequest` is a utility that will parse the headers and serialize the body of a `Request`, for
 * convenience. The function takes two arguments; a binary function that returns a `Task` of `Response` and a `Request`.
 *
 * The binary function handler will be called with an object containing the original headers, the parsed query string
 * and other parameters; the second argument is the body of request serialized based on the content type.
 *
 * ```js
 * import { explodeRequest } from "./library/utilities.js";
 *
 * startHTTPServer(
 *   { port: 8080 },
 *   route(
 *     handlers.get('/users', explodeRequest(({ status }) => retrieveUsers({ filters: { status } }))),
 *     handlers.post(/\/users\/(?<userID>.+)$/, explodeRequest(({ userID }, { data: user }) => updateUser(userID, user)))
 *   )
 * );
 * ```
 *
 * For this sample, a `GET` request made with a query string will be parsed as an object.
 *
 * ```bash
 * $ curl localhost:8080/users?status=active
 * ```
 *
 * And, a `POST` request with a body as JSON will be parsed as well.
 *
 * ```bash
 * $ curl localhost:8080/users/hoge -X POST -H "Content-Type: application/json" -d "{\"data\":{\"fullName\":\"Hoge\"}}"
 * ```
 *
 *  The function `explodeRequest` should cover most use-cases but if you need to create your own parser, check out the
 *  [`parseRequest`](#parsing-requests) function.
 *
 * #### Composing routes
 *
 * Finally, you can compose your routes for increased readability.
 *
 * ```js
 * const userRoutes = [ handlers.get('/', handleRetrieveUsers), ... ];
 * const sensorRoutes = [ handlers.get('/', handleRetrieveSensors), ... ];
 *
 * startHTTPServer({ port: 8080 }, route(...userRoutes, ...sensorRoutes));
 * ```
 *
 * ### Middleware
 *
 * Before talking about middlewares, I think it is important to talk about the power of function composition and couple of
 * things special about `startHTTPServer` and `route`:
 *
 * 1. The function `startHTTPServer` takes a unary function that must return a `Task` of `Response`.
 * 2. The function `route`, will always return early if the argument is not a `Request`.
 *
 * So for example, if you needed to discard any request with a content type that is not `application/json`, you could
 * do the following.
 *
 * ```js
 * import { compose } from "https://x.nest.land/ramda@0.27.0/source/index.js";
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
export const handlers = {
  delete: factorizeHandler('DELETE'),
  get: factorizeHandler('GET'),
  post: factorizeHandler('POST'),
  put: factorizeHandler('PUT')
};


// route :: ([ (Request -> Boolean), (Request -> Task Response) ]...) -> Task Response
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