import {
  always,
  ap,
  compose,
  cond,
  converge,
  curry,
  identity,
  ifElse,
  fromPairs,
  map,
  match,
  path,
  prop,
  split,
  test
} from "https://deno.land/x/ramda@v0.27.2/mod.ts";
import { assertIsRegex, decodeRaw } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";

/**
 * ## Utilities
 */

/**
 * ### `parseBody`
 * `Request -> a`
 *
 * This function takes a `Request` and return the most appropriate parsing of the body;
 * an object if the content-type of the request is `application/json` or, a string if the content type of the request is
 * `text/*`.
 *
 * ```js
 * import { parseBody } from "https://deno.land/x/functional_http_server@v0.3.1/library/utilities.js";
 *
 * assertEquals(
 *   parseBody(
 *     Request({ 'content-type': 'application/json' }, encodeText(JSON.stringify({ piyo: 'piyo' })))
 *   ),
 *   { piyo: 'piyo' }
 * );
 * ```
 */
export const parseBody = ap(
  curry((request, parse) =>
    request.raw.length > 0 ? parse(request.raw) : {}),
  cond([
    [
      compose(
        test(/application\/json/),
        path([ 'headers', 'content-type' ])
      ),
      always(compose(JSON.parse, decodeRaw))
    ],
    [
      compose(
        test(/text\/.*/),
        path([ 'headers', 'content-type' ])
      ),
      always(decodeRaw)
    ],
    [
      _ => true,
      always(identity)
    ]
  ])
);

/**
 * ### `parseQueryString`
 * `Request -> Record`
 *
 * This function takes a `Request` and return an record of the query string.
 *
 * ```js
 * import { parseQueryString } from "https://deno.land/x/functional_http_server@v0.3.1/library/utilities.js";
 *
 * assertEquals(
 *   parseQueryString(Request({ url: '/?hoge=hoge' }, new Uint8Array([]))),
 *   { hoge: 'hoge' }
 * );
 * ```
 */
export const parseQueryString = ifElse(
  test(/\?/),
  compose(
    fromPairs,
    map(split('=')),
    split('&'),
    prop(1),
    match(/\?(.+)?/),
    path([ 'headers', 'url' ])
  ),
  always({})
);

// parseURLParameters :: RegExp -> Request -> { k: string }
export const parseURLParameters = curry(
  (pattern, request) => {
    const sliceIndex = request.headers.url.indexOf('?');
    return request.headers.url
      .slice(0, sliceIndex >= 0 ? sliceIndex : request.headers.url.length)
      .match(pattern)?.groups
    || {};
  }
);

// parseMeta :: Options -> Request -> { v: String }
const parseMeta = options => converge(
  (queryString, parameters, headers) => ({ ...headers, ...parameters, ...queryString }),
  [
    parseQueryString,
    assertIsRegex(options?.pattern) ? parseURLParameters(options?.pattern) : always({}),
    prop('headers')
  ]
);

// parseRequest :: [ Options -> Request -> a,... ] -> ((a, ...) -> Task Response) -> { pattern: String|RegExp } -> Request -> Task Response
export const parseRequest = parsers => curry(
  (naryFunction, context, request) => converge(naryFunction, parsers.map(parser => parser(context)))(request)
);

// explodeRequest :: ({ k: string }, a) -> Task Response) -> Options -> Request -> Task Response
export const explodeRequest = parseRequest([ parseMeta, _ => parseBody ]);

// factorizeMiddleware :: (Request -> Task a) -> (Request -> a -> Task Response) -> Request -> Task Response
export const factorizeMiddleware = middlewareFunction => handlerFunction =>
    request => middlewareFunction(request).chain(options => handlerFunction(options, request));
