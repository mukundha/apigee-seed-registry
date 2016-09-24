FROM mhart/alpine-node:6

RUN apk add --no-cache git 

RUN npm install -g gulp

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app/

RUN git clone {{repo}} sample
WORKDIR /usr/src/app/sample/{{apifolder}}

RUN npm install

ENTRYPOINT [ "gulp" ]