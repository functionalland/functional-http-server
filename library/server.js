import { gray, red } from "https://deno.land/std@0.79.0/fmt/colors.ts";
import { serve, serveTLS } from "https://deno.land/std@0.79.0/http/server.ts";
import { cond, curry, reduce, toPairs } from "https://deno.land/x/ramda@v0.27.2/mod.ts";
import { encodeText } from "https://deno.land/x/functional@v1.3.2/library/utilities.js";
import Request from "https://deno.land/x/functional_io@v1.1.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";

const destructureHeaders = headers => reduce(
  (accumulator, [ key, value ]) => Object.defineProperty(accumulator, key, { enumerable: true, value }),
  {},
  headers.entries()
);

/**
 * ## Server
 */

/**
 * ### `stream`
 * `(Request -> Task Response) -> AsyncIterator -> _|_`
 *
 * This function takes a unaryFunction -- which itself takes a
 * [`Request`](https://github.com/sebastienfilion/functional-io#request) and, returns a Task of a
 * [`Response`](https://github.com/sebastienfilion/functional-io#Response) -- and, an Async Iterator of a
 * [Deno HTTP request](https://deno.land/std@0.82.0/http). The function doesn't resolve to a value.
 */
export const stream = curry(
  async (unaryFunction, iterator) => {
    for await (const _request of iterator) {
      const { body = new Uint8Array([]), headers, method, url } = _request;

      const handleResponse = response => _request.respond(
        {
          body: response.raw,
          headers: response.headers instanceof Headers ? response.headers : new Headers(toPairs(response.headers)),
          status: response.headers.status
        }
      );
      const handleError = error =>
        console.error(red(`An error occurred in an handler: ${error.message}\n${gray(error.stack)}`))
        || _request.respond({ status: 500, body: encodeText(error.message) })

      try {
        unaryFunction(Request({ ...destructureHeaders(headers), method, url }, await Deno.readAll(body)))
          .run()
          .then(
            container =>
              container.fold({
                Left: cond([
                  [ Response.is, handleResponse ],
                  [ _ => true, handleError ]
                ]),
                Right: handleResponse
              }),
          );
      } catch (error) {
        handleError(error);
      }
    }
  }
);

/**
 * ### `startHTTPServer`
 * `Object -> (Request -> Response) -> Listener`
 *
 * This function takes an object of options and, a unary function -- which itself takes a
 * [`Request`](https://github.com/sebastienfilion/functional-io#request) and, returns a Task of a
 * [`Response`](https://github.com/sebastienfilion/functional-io#Response). The function will return a server instance
 * that can be closed (`server.close()`). [See the Deno server library](https://deno.land/std@0.82.0/http) for reference.
 *
 * ```js
 * import Task from "https://deno.land/x/functional@v1.3.2/library/Task.js";
 * import Response from "https://deno.land/x/functional_io@v1.1.0/library/Response.js";
 * import startHTTPServer from "https://deno.land/x/functional_http_server@v0.3.1/library/server.js";
 *
 * startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
 * ```
 */
export const startHTTPServer = (options, unaryFunction) => {
  const server = options.certificatePath && options.keyPath
    ? serveTLS(options)
    : serve(options)

  stream(unaryFunction, server);

  return server;
};

export default startHTTPServer;
