FROM node:20-alpine

# PostgreSQL-Client installieren (fuer psql)
RUN apk add --no-cache postgresql-client

WORKDIR /usr/src/app
COPY server.js .

# Port und Env-Datei werden von docker-compose uebergeben
EXPOSE 3000
CMD ["node", "server.js"]
