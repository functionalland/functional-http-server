import { assert, assertEquals } from "https://deno.land/std@0.79.0/testing/asserts.ts"
import { curry } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import Request from "https://deno.land/x/functional_io@v1.0.0/library/Request.js";
import Response from "https://deno.land/x/functional_io@v1.0.0/library/Response.js";
import Task from "https://deno.land/x/functional@v1.2.1/library/Task.js";
import { decodeRaw, encodeText, safeExtract } from "https://deno.land/x/functional@v1.2.1/library/utilities.js";

import {
  explodeRequest,
  factorizeMiddleware,
  parseBody,
  parseQueryString,
  parseURLParameters
} from "./utilities.js";

Deno.test(
  "explodeRequest",
  () => {
    assert(
      Task.is(
        explodeRequest(
          (context, body) =>  {
            assertEquals(context, { 'content-type': 'application/json', url: '/' });
            assertEquals(body, {});

            return Task.of(Response.OK({}, new Uint8Array([])))
          },
          {}
        )
        (
          Request(
            { 'content-type': 'application/json', url: '/' },
            new Uint8Array([])
          )
        )
      )
    );

    assert(
      Task.is(
        explodeRequest(
          (context, body) =>  {
            assertEquals(context, { 'content-type': 'application/json', hoge: 'hoge', url: '/?hoge=hoge' });
            assertEquals(body, { piyo: 'piyo' });

            return Task.of(Response.OK({}, new Uint8Array([])))
          },
          {}
        )
        (
          Request(
            { 'content-type': 'application/json', url: '/?hoge=hoge' },
            encodeText(JSON.stringify({ piyo: 'piyo' }))
          )
        )
      )
    );

    assert(
      Task.is(
        explodeRequest(
          (context, body) =>  {
            assertEquals(
              context,
              { 'content-type': 'application/json', fuga: 'fuga', ID: 'piyo', url: '/hoge/piyo?fuga=fuga' }
            );
            assertEquals(body, { piyo: 'piyo' });

            return Task.of(Response.OK({}, new Uint8Array([])))
          },
          {
            pattern: /\/hoge\/(?<ID>.+?)$/
          }
        )
        (
          Request(
            { 'content-type': 'application/json', url: '/hoge/piyo?fuga=fuga' },
            encodeText(JSON.stringify({ piyo: 'piyo' }))
          )
        )
      )
    );
  }
);

Deno.test(
  "factorizeMiddleware",
  async () => {
    const middleware = factorizeMiddleware(_ => Task.of({ hoge: 'hoge' }));
    const handler = middleware(
      curry((options, _) => Task.of(Response.OK({}, encodeText(JSON.stringify(options)))))
    );
    const request = Request({}, new Uint8Array([]));

    const container = await handler(request).run()

    const response = safeExtract("Failed to extract the response.", container);

    assertEquals(
      JSON.parse(decodeRaw(response.raw)),
      { hoge: "hoge" }
    );
  }
)

Deno.test(
  "parseBody",
  () => {
    assertEquals(
      parseBody({})(Request({}, new Uint8Array([]))),
      {}
    );

    assertEquals(
      parseBody({})(
        Request({ 'content-type': 'application/json' }, encodeText(JSON.stringify({ piyo: 'piyo' })))
      ),
      { piyo: 'piyo' }
    );
  }
);

Deno.test(
  "parseQueryString",
  () => {
    assertEquals(
      parseQueryString(Request({ url: '/' }, new Uint8Array([]))),
      {}
    );

    assertEquals(
      parseQueryString(Request({ url: '/?hoge=hoge' }, new Uint8Array([]))),
      { hoge: 'hoge' }
    );
  }
);

Deno.test(
  "parseURLParameters",
  () => {
    const pattern = /\/hoge\/(?<ID>.+?)$/

    assertEquals(
      parseURLParameters(pattern, Request({ url: '/' }, new Uint8Array([]))),
      {}
    );

    assertEquals(
      parseURLParameters(pattern, Request({ url: '/hoge/piyo' }, new Uint8Array([]))),
      { ID: 'piyo' }
    );
  }
);
