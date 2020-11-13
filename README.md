# Function HTTP server

## Simple HTTP server

The fastest way to start a HTTP server is to use the `startHTTPServer` function.
The function takes two arguments; the first argument is the options, and the second is a unary
function that takes a `Request` and return a `Task` of a `Response`.

```js
import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";
import startHTTPServer from "./library/server.js";

startHTTPServer({ port: 8080 }, request => Task.of(Response.OK({}, request.raw)));
```

You can test this simple server by executing it your file

```bash
$ deno run --allow-net server.js
```

```bash
$ curl localhost:8080 -d "Hello, Hoge!"
> Hello, Hoge!
```

## Routing

The main routing tool that comes bundled with this library is conveniently called `route`.
It takes a non-zero number of arguments which are defined by a pair of functions.
The first function of the pair is used to assert whether or not to execute the second function.
The assertion function takes a `Request` and return a `Boolean`, the handling function takes a `Request` and
must return a `Task` of a `Response`.

```js
import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";
import { route } from "./library/route.js";
import { encodeText } from "./library/utilities.js";

startHTTPServer(
  { port: 8080 },
  route(
    [
      request => request.headers.method === 'GET',
      _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!")))
    ]
  );
);
```

### Routing handlers

Because the pattern is common, this library also offers a collection of handler that automatically creates
the assertion function. Each handler takes a `String` or a `RegExp` and a unary function.

```js
import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";
import { handlers, route } from "./library/route.js";
import { encodeText } from "./library/utilities.js";

startHTTPServer(
  { port: 8080 },
  route(
    handlers.get('/', _ => Task.of(Response.OK({ 'content-type': 'text/plain' }, encodeText("Hello, Hoge!"))))
  );
);
```

#### Routing with the `explodeRequest` utility

The function `explodeRequest` is a utility that will parse the headers and serialize the body of a `Request`, for
convenience. The function takes two arguments; a binary function that returns a `Task` of `Response` and a `Request`.

The binary function handler will be called with an object containing the original headers, the parsed query string
and other parameters; the second argument is the body of request serialized based on the content type.

```js
import { explodeRequest } from "./library/utilities.js";

startHTTPServer(
  { port: 8080 },
  route(
    handlers.get('/users', explodeRequest(({ filters }) => retrieveUsers(filters))),
    handlers.post(/\/users\/(?<userID>.+)$/, explodeRequest(({ userID }, { data: user }) => updateUser(userID, user)))
  )
);
```

For this sample, a `GET` request made with a query string will be parsed as an object.

```bash
$ curl localhost:8080/users?filters[status]=active
```

And, a `POST` request with a body as JSON will be parsed as well.

```bash
$ curl localhost:8080/users/hoge -X POST -H "Content-Type: application/json" -d "{\"data\":{\"fullName\":\"Hoge\"}}"
```

 The function `explodeRequest` should cover most use-cases but if you need to create your own parser, check out the
 [`parseRequest`](#parsing-requests) function.

#### Composing routes

Finally, you can compose your routes for increased readability.

```js
const userRoutes = [ handlers.get('/', handleRetrieveUsers), ... ];
const sensorRoutes = [ handlers.get('/', handleRetrieveSensors), ... ];

startHTTPServer({ port: 8080 }, route(...userRoutes, ...sensorRoutes));
```

### Middleware

Before talking about middlewares, I think it is important to talk about the power of function composition and couple of
things special about `startHTTPServer` and `route`:

  1. The function `startHTTPServer` takes a unary function that must return a `Task` of `Response`.
  2. The function `route`, will always return early if the argument is not a `Request`.

So for example, if you needed to discard any request with a content type that is not `application/json`, you could
do the following.

```js
import { compose } from "https://x.nest.land/ramda@0.27.0/source/index.js";

startHTTPServer(
  { port: 8080 },
  compose(
    route(...routes),
    request => request.headers.accept !== 'application/json'
      ? Task.of(Response.BadRequest({}, new Uint8Array([])))
      : request
  )
);
```


## Deno

This codebase uses [Deno](https://deno.land/#installation).

### MIT License

Copyright © 2020 - Sebastien Filion

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.