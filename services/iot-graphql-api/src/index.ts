// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import express from 'express';
import http from 'http';
import { buildGraphbackAPI } from 'graphback';
import { loadDBConfig, connectDB } from './db';
import { migrateDB, removeNonSafeOperationsFilter } from 'graphql-migrations';
import { createKnexDbProvider } from '@graphback/runtime-knex';
import { loadConfigSync } from 'graphql-config';

const app = express();
const HTTP_PORT = process.env.HTTP_PORT

app.use(cors());

const graphbackExtension = 'graphback';
const config = loadConfigSync({
  extensions: [
    () => ({
      name: graphbackExtension
    })
  ]
});

const projectConfig = config.getDefault();
const graphbackConfig = projectConfig.extension(graphbackExtension);
const modelDefs = projectConfig.loadSchemaSync(graphbackConfig.model);

const db = connectDB();
const dbConfig = loadDBConfig();

const { typeDefs, resolvers, contextCreator } = buildGraphbackAPI(modelDefs, {
  dataProviderCreator: createKnexDbProvider(db)
});

migrateDB(dbConfig, typeDefs, {
  operationFilter: removeNonSafeOperationsFilter
}).then(() => {
  console.log('Migrated database');
});

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers: [resolvers],
  context: contextCreator
});

apolloServer.applyMiddleware({ app });

const httpServer = http.createServer(app);
apolloServer.installSubscriptionHandlers(httpServer);

httpServer.listen({ port: HTTP_PORT }, () => {
  console.log(`🚀  Server ready at http://localhost:${HTTP_PORT}/graphql`);
});
