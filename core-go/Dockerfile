# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/privyqd ./cmd/privyqd

FROM alpine:3.20
RUN adduser -D -u 10001 privyq
COPY --from=build /out/privyqd /usr/local/bin/privyqd
USER privyq
EXPOSE 50051
ENV GRPC_PORT=50051 KEY_STORAGE=local KEY_STORAGE_PATH=/app/data/keys
VOLUME ["/app/data"]
ENTRYPOINT ["privyqd"]
