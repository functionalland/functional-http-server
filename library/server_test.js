import { assert, assertEquals } from "https://deno.land/std@0.70.0/testing/asserts.ts";
import { compose, converge, mergeRight } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import Either from "https://deno.land/x/functional@v1.1.0/library/Either.js";
import Task from "https://deno.land/x/functional@v1.1.0/library/Task.js";
import { decodeRaw, encodeText, safeExtract } from "https://deno.land/x/functional@v1.1.0/library/utilities.js";
import { fetch } from "https://deno.land/x/functional_io@v0.5.0/library/browser_safe.js";
import Request from "https://deno.land/x/functional_io@v0.5.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v0.5.0/library/Response.js";

import { handlers, route } from "./route.js";
import { startHTTPServer } from "./server.js";
import { factorizeMiddleware, explodeRequest } from "./utilities.js";

const authorize = factorizeMiddleware(request =>
  request.headers["accept"] === 'application/json'
    ? Task.of({ authorizationToken: "hoge" })
    : Task(_ => Either.Left(Response.BadRequest({}, new Uint8Array([]))))
);

const routeHandlers = [
  handlers.get('/', _ => Task.of(Response.OK({}, new Uint8Array([])))),
  handlers.post('/hoge', request => Task.of(Response.OK({}, request.raw))),
  handlers.get(
    '/hoge',
    explodeRequest(
      ({ status }) =>
        Task.of(Response.OK({}, encodeText(JSON.stringify({ status }))))
    )
  ),
  handlers.get(
    /\/hoge\/(?<ID>.*?)$/,
    explodeRequest(({ ID }) => Task.of(Response.OK({}, encodeText(JSON.stringify({ ID })))))
  ),
  handlers.put(
    '/hoge',
    explodeRequest((meta, body) => Task.of(Response.OK({}, encodeText(JSON.stringify(body)))))
  ),
  handlers.post(
    '/fuga/piyo',
    authorize(
      ({ authorizationToken }) =>
        Task.of(Response.OK({}, encodeText(JSON.stringify({ authorizationToken }))))
    )
  )
];

Deno.test(
  "startHTTPServer: GET /",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);

    server.close();
  }
);

Deno.test(
  "startHTTPServer: POST /hoge",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request.POST('http://localhost:8080/hoge', encodeText("Hello, Hoge!"))
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(decodeRaw(response.raw), "Hello, Hoge!");

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: GET /hoge?status=active",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/hoge?status=active')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { status: "active" });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: GET /\\/hoge\\/(?<ID>.*?)$/",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(Request.GET('http://localhost:8080/hoge/piyo')).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { ID: "piyo" });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: PUT /hoge",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
          },
          method: 'PUT',
          url: 'http://localhost:8080/hoge'
        },
        encodeText(JSON.stringify({ username: 'hoge' }))
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { username: 'hoge' });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: POST /fuga/piyo",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
          },
          method: 'POST',
          url: 'http://localhost:8080/fuga/piyo'
        },
        new Uint8Array([])
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 200);
    assertEquals(JSON.parse(decodeRaw(response.raw)), { authorizationToken: 'hoge' });

    server.close();
  }
);

Deno.test(
  "startHTTPServer with explodeRequest: POST /fuga/piyo -- unauthorized",
  async () => {
    const server = startHTTPServer({ port: 8080 }, route(...routeHandlers));

    const container = await fetch(
      Request(
        {
          headers: {
            'accept': 'text/plain',
            'content-type': 'application/json'
          },
          method: 'POST',
          url: 'http://localhost:8080/fuga/piyo'
        },
        new Uint8Array([])
      )
    ).run()

    const response = safeExtract("Failed to unpack the response", container);

    assert(Response.is(response));
    assertEquals(response.headers.status, 400);

    server.close();
  }
);
