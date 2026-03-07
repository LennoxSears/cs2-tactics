FROM node:20-alpine

WORKDIR /app

COPY index.html server.js ./

# Copy map images and navmesh data
COPY data/ data/

EXPOSE 8080
CMD ["node", "server.js"]
