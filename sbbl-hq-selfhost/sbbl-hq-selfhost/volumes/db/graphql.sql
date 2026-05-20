-- PostgREST resolves /graphql/v1 by switching to the graphql_public
-- schema (via Content-Profile: graphql_public set by Kong). If this
-- schema does not exist, PostgREST returns "schema graphql_public
-- does not exist" for every /graphql/v1 request.
--
-- The pg_graphql extension creates the `graphql` schema (the engine
-- itself), NOT `graphql_public` (the public-facing wrapper that
-- exposes graphql.resolve as RPC). The latter must be created
-- separately so PostgREST can find it.
--
-- This file is idempotent and safe to re-run on existing DBs.

CREATE EXTENSION IF NOT EXISTS pg_graphql;

CREATE SCHEMA IF NOT EXISTS graphql_public;

GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;
GRANT ALL  ON SCHEMA graphql_public TO postgres;
