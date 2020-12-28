export FL_TITLE="Functional HTTP Server"
export FL_DESCRIPTION="A simple HTTP server inspired by Express and in tune with Functional Programming principles in \
JavaScript for Deno."
export FL_GITHUB_URL="https://github.com/sebastienfilion/functional-http-server"
export FL_DENO_URL="https://deno.land/x/functional_http_server"
export FL_VERSION="v0.3.1"

deno run --allow-all --unstable ../@functional:generate-documentation/cli.js document \
"$FL_TITLE" \
"$FL_DESCRIPTION" \
$FL_GITHUB_URL \
$FL_DENO_URL \
$FL_VERSION \
./.github/readme-fragment-usage.md \
./library/*.js \
./.github/readme-fragment-license.md
