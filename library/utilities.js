import {
  always,
  ap,
  chain,
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
} from "https://x.nest.land/ramda@0.27.0/source/index.js";
import { assertIsRegex, decodeRaw, encodeText, log } from "https://deno.land/x/functional@v1.1.0/library/utilities.js";
import Request from "https://deno.land/x/functional_io@v0.5.0/library/Request.js";

/**
 * ### Parsing Requests
 */

// parseBody :: Options -> Request -> a
export const parseBody = _ => ap(
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
        test(/text\/plain/),
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

// parseQueryString :: Request -> { k: string }
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
export const explodeRequest = parseRequest([ parseMeta, parseBody ]);

// factorizeMiddleware :: (Request -> Task a) -> (Request -> a -> Task Response) -> Request -> Task Response
export const factorizeMiddleware = middlewareFunction => handlerFunction =>
    request => middlewareFunction(request).chain(options => handlerFunction(options, request));
