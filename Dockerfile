# This is a test dockerfile to work w/ redis as a container
FROM node

ENV REDIS_HOST=redis

COPY ./ ./

RUN npm ci

CMD ["npm", "run", "test"]
