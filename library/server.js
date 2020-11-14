import { gray, red } from "https://deno.land/std@0.76.0/fmt/colors.ts";
import { serve, serveTLS } from "https://deno.land/std@0.74.0/http/server.ts";
import { cond, curry, reduce } from "https://x.nest.land/ramda@0.27.0/source/index.js";
import { encodeText } from "https://deno.land/x/functional@v1.1.0/library/utilities.js";
import Request from "https://deno.land/x/functional_io@v0.5.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";

/**
 * ## Simple HTTP server
 *
 * The fastest way to start a HTTP server is to use the `startHTTPServer` function.
 * The function takes two arguments; the first argument is the options, and the second is a unary
 * function that takes a `Request` and return a `Task` of a `Response`.
 *
 * ```js
 * import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
 * import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";
 * import startHTTPServer from "./library/server.js";
 *
 * startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
 * ```
 *
 * You can test this simple server by executing it your file
 *
 * ```bash
 * $ deno run --allow-net server.js
 * ```
 *
 * ```bash
 * $ curl localhost:8080 -d "Hello, Hoge!"
 * > Hello, Hoge!
 * ```
 */

const destructureHeaders = headers => reduce(
  (accumulator, [ key, value ]) => Object.defineProperty(accumulator, key, { enumerable: true, value }),
  {},
  headers.entries()
);

// stream :: (Request -> Task Response) -> AsyncIterator -> _|_
export const stream = curry(
  async (unaryFunction, iterator) => {
    for await (const _request of iterator) {
      const { body = new Uint8Array([]), headers, method, url } = _request;

      const handleResponse = response => _request.respond({ ...response.headers, body: response.raw });
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

// startServer :: Options -> (Request -> Response) -> _|_
export const startHTTPServer = (options, unaryFunction) => {
  const server = options.certificatePath && options.keyPath
    ? serveTLS(options)
    : serve(options)

  stream(unaryFunction, server);

  return server;
};

export default startHTTPServer;
